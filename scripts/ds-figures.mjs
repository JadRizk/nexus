// The three figures the showcase chrome and reference/preview.jsx advertise,
// read from the code rather than typed by hand. Consumed by the showcase's
// Vite config (as compile-time constants), scripts/build-preview.mjs (which
// stamps them into the hand-authored tail of preview.jsx), and
// scripts/check-docs.mjs (which verifies nothing else quotes stale copies).
//
// This exists because the "chore: version packages" merge bumped
// @nexus-cyberdeck/react to 3.0.0 and left the header reading "DS v2.0" — the
// docs check caught it, but a check that fails on every release is a check
// that gets deleted. Deriving the figures is what makes it unnecessary.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), "utf8");

export const version = JSON.parse(read("packages/react/package.json")).version;
/** "3.0" — what the chrome shows; the patch number is noise there. */
export const shortVersion = version.split(".").slice(0, 2).join(".");

export const tokenCount = new Set(
  Array.from(
    read("packages/tokens/src/tokens.css").matchAll(/^\s*(--nx-[a-z0-9-]+)\s*:/gm),
    (m) => m[1],
  ),
).size;

export const componentCount = readdirSync(join(root, "packages/react/src/components"), {
  withFileTypes: true,
}).filter((entry) => entry.isDirectory()).length;
