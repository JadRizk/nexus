#!/usr/bin/env node
// Fails when the figures quoted in the docs and the showcase drift from the
// code. This used to be a three-way parity check across tokens.css, tokens.json
// and the contrast table in index.ts — that part is gone, because tokens.css
// and contrast.gen.ts are now generated from tokens.json and cannot disagree
// with it by construction. What is left is the drift no generator can prevent:
// prose that quotes a number.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), "utf8");

const problems = [];

const tokenCount = new Set(
  Array.from(read("packages/tokens/src/tokens.css").matchAll(/^\s*(--nx-[a-z0-9-]+)\s*:/gm), (m) => m[1]),
).size;

// Counted from the component folders, which is now the real inventory: one
// folder per component, each exporting itself through its own index.ts.
const componentsDir = join(root, "packages/react/src/components");
const componentCount = readdirSync(componentsDir, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory(),
).length;

const quoted = `${tokenCount} tokens · ${componentCount} components`;

for (const file of ["apps/showcase/src/App.tsx", "reference/preview.jsx"]) {
  const claim = read(file).match(/\d+ tokens · \d+ components/);
  if (claim && claim[0] !== quoted) {
    problems.push(`${file} advertises "${claim[0]}" — the code has ${quoted}`);
  }
}

// The version quoted in the showcase chrome is the third figure that drifts
// silently — it read "DS v1.0" through a major bump. Checked against the
// package it actually describes rather than kept in step by hand.
const version = JSON.parse(read("packages/react/package.json")).version;
const shortVersion = version.split(".").slice(0, 2).join(".");
for (const file of ["apps/showcase/src/App.tsx", "reference/preview.jsx"]) {
  const claim = read(file).match(/DS v(\d+\.\d+)/);
  if (claim && claim[1] !== shortVersion) {
    problems.push(`${file} advertises "DS v${claim[1]}" — @nexus/react is ${version}`);
  }
}

const readme = read("README.md").match(/@nexus\/react\s+(\d+) components/);
if (readme && Number(readme[1]) !== componentCount) {
  problems.push(`README.md advertises ${readme[1]} components — the code exports ${componentCount}`);
}

if (problems.length) {
  console.error("Documentation disagrees with the code:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`Docs OK — ${quoted}.`);
