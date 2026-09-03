#!/usr/bin/env node
// Fails a pull request that changes a published package without saying why.
//
// This is advisory in spirit, not bureaucratic: it only fires when files under
// packages/*/src change, and a one-line `npx changeset` satisfies it. Version
// bumps are cheap to get right at the moment of the change and expensive to
// reconstruct months later from a diff.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main";

let changed;
try {
  changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
} catch {
  console.log(`Could not diff against ${base} — skipping.`);
  process.exit(0);
}

const touchesPackages = changed.some((f) => /^packages\/[^/]+\/src\//.test(f));
if (!touchesPackages) {
  console.log("No package source changed — no changeset needed.");
  process.exit(0);
}

const dir = join(root, ".changeset");
const pending = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md")
  : [];

if (pending.length === 0) {
  console.error(
    "This branch changes package source but adds no changeset.\n\n" +
      "  npx changeset\n\n" +
      "Pick the packages, pick the bump, and describe the change as something a\n" +
      "person upgrading would want to read. If the change genuinely cannot\n" +
      "affect a consumer — a test, a comment — add an empty changeset with\n" +
      "`npx changeset --empty` to say so deliberately.\n",
  );
  process.exit(1);
}

console.log(`${pending.length} changeset(s) present.`);
