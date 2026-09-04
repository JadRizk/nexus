#!/usr/bin/env node
// Fails when the figures quoted in the docs drift from the code.
//
// The showcase reads its figures at build time (vite.config.ts `define`) and
// scripts/build-preview.mjs stamps them into reference/preview.jsx, so those
// two cannot drift by construction any more. What is left is prose that
// quotes a number — the README — plus a belt-and-braces check that the
// stamped preview really was regenerated after the last change.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { componentCount, shortVersion, tokenCount, version } from "./ds-figures.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), "utf8");

const problems = [];
const quoted = `${tokenCount} tokens · ${componentCount} components`;

const preview = read("reference/preview.jsx");
const claim = preview.match(/\d+ tokens · \d+ components/);
if (claim && claim[0] !== quoted) {
  problems.push(`reference/preview.jsx advertises "${claim[0]}" — the code has ${quoted}`);
}
const previewVersion = preview.match(/DS v(\d+\.\d+)/);
if (previewVersion && previewVersion[1] !== shortVersion) {
  problems.push(
    `reference/preview.jsx advertises "DS v${previewVersion[1]}" — @nexus-cyberdeck/react is ${version}`,
  );
}

const readme = read("README.md").match(/@nexus-cyberdeck\/react\s+(\d+) components/);
if (readme && Number(readme[1]) !== componentCount) {
  problems.push(
    `README.md advertises ${readme[1]} components — the code exports ${componentCount}`,
  );
}

if (problems.length) {
  console.error("Documentation disagrees with the code:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`Docs OK — DS v${shortVersion}, ${quoted}.`);
