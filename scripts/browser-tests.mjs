#!/usr/bin/env node
/* ============================================================================
   Runs the browser suite — visual regression and accessibility — inside the
   pinned Playwright container.

   Two things have to be true for a pixel baseline to mean anything: the
   renderer must be identical everywhere it runs, and the page under test must
   be the built artefact rather than a dev server with HMR injected into it.
   This script arranges both, so `npm run test:visual` on a laptop and the CI
   job produce the same bytes.

   The showcase is built and served on the host — its toolchain has native
   binaries for the host platform and cannot run in the container — while the
   browser runs in the container and reaches the server through the host
   gateway. Only the rendering needs to be Linux; the bundler does not.
   ========================================================================== */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const version = (pkg.devDependencies["@playwright/test"] ?? "").replace(/^[^\d]*/, "");
if (!version) {
  console.error("@playwright/test is not in devDependencies — cannot pin a container version.");
  process.exit(1);
}
const IMAGE = `mcr.microsoft.com/playwright:v${version}-noble`;
const PORT = 4173;

const passthrough = process.argv.slice(2);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  console.error(
    "Docker is not running.\n\n" +
      "The visual suite runs in a pinned container so baselines stay comparable " +
      "between machines and CI. Start Docker and try again.\n",
  );
  process.exit(1);
}

// A previous run killed mid-flight can leave its detached preview server
// holding the port. With --strictPort the new server then fails to bind, the
// browser has nothing to talk to, and every test in the suite times out — a
// wall of red that looks exactly like a catastrophic regression and is not
// one. Fail here instead, with the reason.
const held = spawnSync("lsof", ["-ti", `:${PORT}`], { encoding: "utf8" }).stdout.trim();
if (held) {
  console.error(
    `Port ${PORT} is already in use by PID ${held.split("\n").join(", ")}.\n\n` +
      "That is almost always a preview server left behind by an interrupted run.\n" +
      `Stop it and try again:  kill ${held.split("\n")[0]}\n`,
  );
  process.exit(1);
}

// Build once, on the host, and serve the real artefact.
if (run("npm", ["run", "build", "-w", "apps/showcase"]) !== 0) process.exit(1);

const server = spawn(
  "npm",
  [
    "run", "preview", "-w", "apps/showcase", "--",
    "--port", String(PORT),
    "--strictPort",
    // Bound to all interfaces so the containerised browser can reach it
    // through the host gateway; vite preview otherwise binds IPv6 localhost
    // only. Short-lived and serving a static showcase, but it is a real
    // listener on the LAN for the duration of the run.
    "--host", "0.0.0.0",
  ],
  { cwd: root, stdio: "inherit", detached: true },
);

const stop = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
};
process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

// Wait for the preview server rather than sleeping a guessed interval.
const deadline = Date.now() + 60_000;
let up = false;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    if (res.ok) {
      up = true;
      break;
    }
  } catch {
    /* not listening yet */
  }
  await new Promise((r) => setTimeout(r, 250));
}
if (!up) {
  console.error(`Preview server never came up on :${PORT}.`);
  stop();
  process.exit(1);
}

const status = run("docker", [
  "run",
  "--rm",
  "--init",
  "--ipc=host", // Chromium crashes on the default 64MB /dev/shm
  "-v",
  `${root}:/work`,
  "-w",
  "/work",
  "--add-host",
  "host.docker.internal:host-gateway",
  "-e",
  `PW_BASE_URL=http://host.docker.internal:${PORT}`,
  ...(process.env.CI ? ["-e", "CI=1"] : []),
  IMAGE,
  "npx",
  "playwright",
  "test",
  ...passthrough,
]);

stop();
process.exit(status);
