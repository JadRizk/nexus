#!/usr/bin/env node
// Typechecks @nexus-cyberdeck/graph against the OLDEST three it claims to
// support.
//
// A peer range is a promise, and this one used to be inherited rather than
// tested: `^0.170.0` was written when 0.170 was current, and under 0.x semver
// it silently meant `<0.171.0` — so it rejected the 0.185 this repository
// itself develops against. Widening the range fixed that, but left the floor
// asserted by nobody: the only version any job installed was the
// devDependency.
//
// This builds a scratch project from the graph package's own source, installs
// the floor version of three and its types, and compiles. It is deliberately
// the floor and not a matrix: the ceiling is optimistic by design (three ships
// breaking changes in minors and a narrow upper bound turns into an ERESOLVE
// failure for consumers on a newer release), while the floor is a claim that
// can be checked, so it is.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, "packages/graph/package.json"), "utf8"));
const range = pkg.peerDependencies?.three;

const floor = range?.match(/>=\s*(\d+\.\d+\.\d+)/)?.[1];
if (!floor) {
  console.error(
    `Could not read a floor version out of the three peer range ${JSON.stringify(range)}.\n` +
      "This check expects a range of the form '>=X.Y.Z <A.B.C'. If the shape of the\n" +
      "range changed deliberately, update scripts/check-peer-floor.mjs to match.",
  );
  process.exit(1);
}

const react = JSON.parse(
  readFileSync(join(root, "packages/graph/package.json"), "utf8"),
).devDependencies;
const dir = mkdtempSync(join(tmpdir(), "nx-peer-floor-"));

try {
  cpSync(join(root, "packages/graph/src"), join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "peer-floor", private: true, type: "module" }) + "\n",
  );
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: undefined,
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          isolatedModules: true,
        },
        include: ["src"],
        // The unit tests import vitest, which a consumer never installs; the
        // point here is the published surface, not the suite.
        exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `Typechecking @nexus-cyberdeck/graph against three@${floor} (the declared floor of ${range})…`,
  );
  execFileSync(
    "npm",
    [
      "install",
      "--silent",
      "--no-audit",
      "--no-fund",
      `three@${floor}`,
      `@types/three@${floor}`,
      `typescript@${react.typescript}`,
      `react@${react.react}`,
      `@types/react@${react["@types/react"]}`,
    ],
    { cwd: dir, stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: dir, stdio: "inherit" });
  console.log(`OK — the graph package compiles against three@${floor}.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
