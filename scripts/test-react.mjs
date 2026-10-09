#!/usr/bin/env node
// Runs the typecheck and the unit tests against a React major other than the
// one the repository builds with: `node scripts/test-react.mjs 18`.
//
// The packages promise `react: "^18.3.0 || ^19.0.0"`, and every other job in
// this repository installs the single React pinned in devDependencies, so on
// its own CI only ever runs a component on that one major. This runs the same
// typecheck and the same unit tests on the other one, with its own @types, so
// both halves of the peer range are exercised by real renders and a real
// compile, not by a type check alone.
//
// It works in a scratch COPY of the tracked files, never in the working tree:
// it rewrites package.json files and installs, which must not touch a
// contributor's checkout or lockfile.
//
// The one thing that goes wrong, and the reason for the assertion below:
// changing the React devDependencies on top of an existing lockfile can leave
// the old React behind, hoisted at the root, and @testing-library/react (a peer
// of both) binds to THAT one. The components then run on one major while the
// test renderer runs on the other, and the suite fails in ways that look like
// React bugs and are not. `npm dedupe` fixes it; the assertion makes sure it
// did, so a green or red result here always means a single React was under
// test. (The same split broke Dependabot's first grouped bump to 19 in the
// repository itself; see #67.)
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Exact versions, the same literals check-consumer.mjs uses: a scratch install
// has no lockfile, and a moving target would turn unrelated pull requests red.
// Bump them together, deliberately.
const MAJORS = {
  18: {
    react: "18.3.1",
    "react-dom": "18.3.1",
    "@types/react": "18.3.31",
    "@types/react-dom": "18.3.7",
  },
  19: {
    react: "19.3.0",
    "react-dom": "19.3.0",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
  },
};

const major = process.argv[2];
const PINS = MAJORS[major];
if (!PINS) {
  console.error(`Usage: node scripts/test-react.mjs <${Object.keys(MAJORS).join("|")}>`);
  process.exit(2);
}
const REACT = PINS.react;

// Only the workspaces that depend on React; tokens has no React at all.
const WORKSPACES = ["packages/react", "packages/graph", "apps/showcase"];

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

const dir = mkdtempSync(join(tmpdir(), `nx-react${major}-tests-`));

try {
  // Tracked files only: no node_modules, no build output, no stray local state.
  // The screenshots are the one large thing the unit tests never read.
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((file) => file && !file.startsWith("browser/__screenshots__/"));
  for (const file of tracked) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    cpSync(join(root, file), join(dir, file));
  }

  for (const workspace of WORKSPACES) {
    const path = join(dir, workspace, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    // The showcase lists react and react-dom under `dependencies`, the packages
    // under `devDependencies`; missing either section leaves the other React behind.
    for (const section of ["dependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries(PINS)) {
        if (manifest[section]?.[name]) manifest[section][name] = version;
      }
    }
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  }

  // Drop the React family from the copied lockfile so npm resolves it afresh
  // at the pinned versions. Left in, the repository's own React stays hoisted
  // at the root and @testing-library/react, whose peer range accepts either
  // major, keeps binding to it while the workspaces get the pinned one nested:
  // two Reacts that `npm dedupe` cannot merge, because the root copy still
  // satisfies that peer. Everything else stays locked.
  const lockPath = join(dir, "package-lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const FAMILY = new Set([...Object.keys(PINS), "scheduler"]);
  for (const key of Object.keys(lock.packages)) {
    const name = key.split("node_modules/").pop();
    if (key.includes("node_modules/") && FAMILY.has(name)) delete lock.packages[key];
  }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");

  console.log(`Installing React ${REACT} into a scratch copy of the repository…`);
  run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--silent"], dir);
  run("npm", ["dedupe", "--no-audit", "--no-fund", "--ignore-scripts", "--silent"], dir);

  // Every installed copy of react and react-dom, wherever npm put it. `npm ls`
  // exits non-zero when any peer is unmet; the tree is still on stdout, and the
  // assertion below is the real check, so take it either way.
  let listing;
  try {
    listing = execFileSync("npm", ["ls", "react", "react-dom", "--all", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
  } catch (error) {
    listing = error.stdout;
  }
  const tree = JSON.parse(listing);
  const seen = new Map();
  const walk = (node, name) => {
    if (name === "react" || name === "react-dom") {
      if (node.version) seen.set(name, (seen.get(name) ?? new Set()).add(node.version));
    }
    for (const [child, value] of Object.entries(node.dependencies ?? {})) walk(value, child);
  };
  walk(tree, "");
  for (const name of ["react", "react-dom"]) {
    const versions = [...(seen.get(name) ?? [])];
    if (versions.length !== 1 || versions[0] !== PINS[name]) {
      console.error(
        `Expected exactly one ${name}, at ${PINS[name]}; found ${versions.join(", ") || "none"}. ` +
          "Two Reacts in one tree makes every result below meaningless.",
      );
      process.exit(1);
    }
  }
  console.log(`  one copy of react and react-dom, both ${REACT}.`);

  console.log(`Typechecking on React ${major}…`);
  run("npm", ["run", "typecheck"], dir);
  console.log(`Running the unit tests on React ${major}…`);
  run("npm", ["run", "test"], dir);
  console.log(`OK — the typecheck and every unit test pass on React ${REACT}.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
