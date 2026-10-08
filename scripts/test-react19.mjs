#!/usr/bin/env node
// Runs the typecheck and the unit tests against React 19.
//
// The packages promise `react: "^18.3.0 || ^19.0.0"`, and every job in this
// repository installs the React 18 pinned in devDependencies, so until this
// existed the 19 half of that promise was checked by types only
// (check-react19-types.mjs reads the source against @types/react 19) and by a
// server-render smoke test (check-consumer.mjs). Neither runs a component. This
// does: the same typecheck and the same unit tests, on a real React 19.
//
// It works in a scratch COPY of the tracked files, never in the working tree:
// it rewrites package.json files and installs, which must not touch a
// contributor's checkout or lockfile.
//
// The one thing that goes wrong, and the reason for the assertion below: bumping
// the React devDependencies on top of an existing lockfile leaves an old React
// 18 behind, hoisted at the root, and @testing-library/react (a peer of both)
// binds to THAT one. The components then run on 19 while the test renderer runs
// on 18, and the suite fails in ways that look like React 19 bugs and are not.
// `npm dedupe` fixes it; the assertion makes sure it did, so a green or red
// result here always means a single React 19 was under test.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// The same literal, for the same reason, as check-react19-types.mjs and
// check-consumer.mjs: a moving target would turn unrelated pull requests red.
// Bump the three together, deliberately.
const REACT_19 = "19.3.0";

// Only the workspaces that depend on React; tokens has no React at all.
const WORKSPACES = ["packages/react", "packages/graph", "apps/showcase"];
const PINNED = ["react", "react-dom", "@types/react", "@types/react-dom"];

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

const dir = mkdtempSync(join(tmpdir(), "nx-react19-tests-"));

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
    // under `devDependencies`; missing either section leaves a React 18 behind.
    for (const section of ["dependencies", "devDependencies"]) {
      for (const name of PINNED) {
        if (manifest[section]?.[name]) manifest[section][name] = REACT_19;
      }
    }
    writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(`Installing React ${REACT_19} into a scratch copy of the repository…`);
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
    if (versions.length !== 1 || versions[0] !== REACT_19) {
      console.error(
        `Expected exactly one ${name}, at ${REACT_19}; found ${versions.join(", ") || "none"}. ` +
          "Two Reacts in one tree makes every result below meaningless.",
      );
      process.exit(1);
    }
  }
  console.log(`  one copy of react and react-dom, both ${REACT_19}.`);

  console.log("Typechecking on React 19…");
  run("npm", ["run", "typecheck"], dir);
  console.log("Running the unit tests on React 19…");
  run("npm", ["run", "test"], dir);
  console.log(`OK — the typecheck and every unit test pass on React ${REACT_19}.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
