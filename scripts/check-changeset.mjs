#!/usr/bin/env node
// Fails a pull request that changes a published package without saying why.
//
// This is advisory in spirit, not bureaucratic: it only fires when files under
// packages/*/src change, and a one-line `npx changeset` satisfies it. Version
// bumps are cheap to get right at the moment of the change and expensive to
// reconstruct months later from a diff.
//
// The rule is that the pull request ITSELF adds a changeset — a `.changeset/*.md`
// file that is new between the merge base with the base branch and HEAD. The
// entries already pending on main do not count. An earlier version of this
// check only asked whether the folder held any entry at all, and it usually
// holds a couple of dozen waiting for the next "Version Packages" pull request,
// so a pull request that changed package source and wrote nothing passed on
// the strength of somebody else's changeset.
//
// It also fails closed. If the base ref cannot be diffed against, that is a
// checkout problem to fix in ci.yml, not a reason to pass: the earlier version
// printed "skipping" and exited 0, and because the test job checked out with
// the default depth of 1 — no origin/main in the clone — it skipped on every
// run it ever had.
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baseBranch = process.env.GITHUB_BASE_REF || "main";
const base = `origin/${baseBranch}`;

// `${base}...HEAD` is the merge-base form: it lists what this branch changed
// relative to where it forked, so commits that landed on the base branch since
// are never attributed to the pull request.
function changedFiles(options = [], paths = []) {
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", ...options, `${base}...HEAD`, "--", ...paths],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
      .split("\n")
      .filter(Boolean);
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    console.error(
      `Could not diff against ${base}: the ref is not in this checkout.\n\n` +
        `  ${detail.split("\n").join("\n  ")}\n\n` +
        "The changeset check compares the pull request with its base branch, so the\n" +
        "base ref has to exist locally. In CI, .github/workflows/ci.yml must check out\n" +
        "with enough history to contain it: `fetch-depth: 0` on actions/checkout, or an\n" +
        `explicit \`git fetch origin ${baseBranch}\` before this step. Locally, run\n` +
        `\`git fetch origin ${baseBranch}\`. Refusing to pass a gate that could not look.\n`,
    );
    process.exit(1);
  }
}

const changed = changedFiles();
const touchesPackages = changed.some((f) => /^packages\/[^/]+\/src\//.test(f));
if (!touchesPackages) {
  console.log("No package source changed — no changeset needed.");
  process.exit(0);
}

// Only files the pull request ADDS count (`--diff-filter=A`), and only entries:
// the folder also holds README.md and config.json, which are not changesets
// however they got there. Everything else in the folder stays visible to the
// release workflow as usual; it just does not satisfy this check.
const notAnEntry = new Set([".changeset/README.md", ".changeset/config.json"]);
const added = changedFiles(["--diff-filter=A"], [".changeset"]).filter(
  (f) => f.endsWith(".md") && !notAnEntry.has(f),
);

if (added.length === 0) {
  console.error(
    "This pull request changes package source but adds no changeset.\n\n" +
      "  npx changeset\n\n" +
      "Pick the packages, pick the bump, and describe the change as something a\n" +
      "person upgrading would want to read. If the change genuinely cannot\n" +
      "affect a consumer — a test, a comment — add an empty changeset with\n" +
      "`npx changeset --empty` to say so deliberately.\n\n" +
      "Changesets already pending in .changeset/ from other work do not count:\n" +
      "the entry has to be one this pull request adds.\n",
  );
  process.exit(1);
}

console.log(
  `${added.length} changeset(s) added by this pull request:\n` +
    added.map((f) => `  ${f}`).join("\n"),
);
