#!/usr/bin/env node
// Typechecks @nexus-cyberdeck/react and @nexus-cyberdeck/graph against
// @types/react@19 — the other half of the `react: "^18.3.0 || ^19.0.0"` peer
// range both packages declare.
//
// Every other job in this repository — the workspace `typecheck` script, the
// build, the tests — installs only the @types/react@18 pinned in
// devDependencies. That is a real gap, not a theoretical one: useFocusTrap
// used to declare `RefObject<T>` as its return type, which is what
// `useRef<T>(null)` actually returns under @types/react 18 (its `RefObject<T>`
// already bakes `| null` into `current`). @types/react 19 made `RefObject<T>`
// exact instead (`current: T`, no null) and moved the nullability onto the
// ref-prop types, so `useRef<T>(null)` returns `RefObject<T | null>` there.
// The old annotation was a real type error for a 19 consumer, and nothing in
// CI could ever have caught it — this script is that missing check.
//
// Modelled on scripts/check-peer-floor.mjs: a scratch project built from the
// packages' own source (so the compiled .d.ts each package last published is
// never what's under test — the source always is), with no lockfile of its
// own so it can install a different major than the workspace root has.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Hardcoded rather than read live from the registry (e.g. `npm view
// @types/react@19 version`). check-peer-floor.mjs's floor is pinned from
// package-lock.json for the same reason this is pinned here as a literal:
// a moving target can turn a pull request that never touched React types red
// on a day nobody was looking, and a network call to the registry is one
// more way for CI to fail for a reason that has nothing to do with the
// change under review. @types/react and react move in lockstep majors, so
// one constant covers both; @types/react-dom and react-dom track the same
// minor/patch cadence upstream, so the same version applies there too.
// Latest 19.x release of each as of 2026-09-10 (`npm view <pkg>@19 version`);
// bump deliberately, not automatically.
const REACT_19 = "19.3.0";

// Pinned from the lockfile, not from the caret ranges in package.json, for
// the same reason scripts/check-peer-floor.mjs pins `three` that way: a
// scratch install with no lockfile of its own would otherwise resolve the
// newest match on every run, and a new TypeScript (or Three.js) release could
// turn every open pull request red over a diagnostic in code it never
// touched.
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages;
const pinned = (name) => {
  const version = lock[`node_modules/${name}`]?.version;
  if (!version) {
    console.error(`${name} is not in package-lock.json — run npm install.`);
    process.exit(1);
  }
  return `${name}@${version}`;
};

// Derived from the repository's own compiler settings rather than a second
// copy of them, exactly as check-peer-floor.mjs does. baseUrl and paths are
// dropped from the copy and replaced below with a mapping that only ever
// points inside this scratch directory — never back into the real
// workspace, which is the one thing a floor/ceiling check like this must not
// do (it would let the wrong package version's types leak in unnoticed).
const compilerOptions = JSON.parse(
  readFileSync(join(root, "tsconfig.base.json"), "utf8"),
).compilerOptions;
delete compilerOptions.baseUrl;
delete compilerOptions.paths;

const dir = mkdtempSync(join(tmpdir(), "nx-react19-"));

try {
  // @nexus-cyberdeck/graph has no workspace dependencies — three and React
  // are its only peers. @nexus-cyberdeck/react depends on
  // @nexus-cyberdeck/tokens (a plain TS/CSS source with no further workspace
  // dependencies of its own), so that comes along too, addressed through a
  // scratch-local path mapping rather than an npm install: it isn't
  // published, so there is nothing on the registry to install.
  cpSync(join(root, "packages/react/src"), join(dir, "react/src"), { recursive: true });
  cpSync(join(root, "packages/graph/src"), join(dir, "graph/src"), { recursive: true });
  cpSync(join(root, "packages/tokens/src"), join(dir, "tokens/src"), { recursive: true });

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "react19-types-check", private: true, type: "module" }) + "\n",
  );
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: undefined,
        compilerOptions: {
          ...compilerOptions,
          baseUrl: ".",
          paths: {
            "@nexus-cyberdeck/tokens": ["./tokens/src/index.ts"],
            "@nexus-cyberdeck/tokens/*": ["./tokens/src/*"],
          },
        },
        include: ["react/src", "graph/src"],
        // The unit tests import vitest and @testing-library, which a
        // consumer never installs; the point here is the published surface
        // (the same reasoning check-peer-floor.mjs gives for excluding
        // graph's tests).
        exclude: ["**/*.test.ts", "**/*.test.tsx"],
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `Typechecking @nexus-cyberdeck/react and @nexus-cyberdeck/graph against @types/react@${REACT_19} ` +
      "(the React 19 half of the declared peer range)…",
  );
  execFileSync(
    "npm",
    [
      "install",
      "--silent",
      "--no-audit",
      "--no-fund",
      `react@${REACT_19}`,
      `react-dom@${REACT_19}`,
      `@types/react@${REACT_19}`,
      `@types/react-dom@${REACT_19}`,
      pinned("three"),
      pinned("@types/three"),
      pinned("typescript"),
    ],
    { cwd: dir, stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: dir, stdio: "inherit" });
  console.log(
    `OK — @nexus-cyberdeck/react and @nexus-cyberdeck/graph compile against @types/react@${REACT_19}.`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
