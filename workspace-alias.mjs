import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* ============================================================================
   Shared Vite/Vitest alias for the workspace packages.

   package.json now points `main`/`exports` at dist/, which is what a consumer
   installing from a registry needs. Local tooling must not inherit that, or
   every `npm run dev` and every test run would depend on a prior build and
   quietly serve stale output when one was skipped.

   These aliases map the package names back to source, so tsc (via the `paths`
   in tsconfig.base.json), Vite and Vitest all read the same files the editor
   does. Nothing here ships.
   ========================================================================== */

const root = dirname(fileURLToPath(import.meta.url));
const src = (pkg, file) => join(root, "packages", pkg, "src", file);

export const workspaceAlias = [
  { find: /^@nexus-cyberdeck\/tokens$/, replacement: src("tokens", "index.ts") },
  { find: /^@nexus-cyberdeck\/tokens\/(.*)$/, replacement: src("tokens", "$1") },
  { find: /^@nexus-cyberdeck\/react$/, replacement: src("react", "index.ts") },
  { find: /^@nexus-cyberdeck\/react\/(.*)$/, replacement: src("react", "$1") },
  { find: /^@nexus-cyberdeck\/graph$/, replacement: src("graph", "index.ts") },
];

/**
 * The same mapping, shaped for esbuild's `alias` build option (an exact-match
 * package-name → path object, not Vite's regex/replacement pairs).
 *
 * scripts/build-preview.mjs bundles packages/react/src/index.ts with esbuild,
 * which re-exports from the bare specifier "@nexus-cyberdeck/tokens" — left to plain
 * package resolution, that goes through packages/tokens/package.json's
 * `exports` field, which (correctly, for a real consumer) points at dist/.
 * Local tooling has to bypass that the same way Vite and Vitest already do
 * above, or the preview generator ends up depending on packages/tokens
 * having been built first, and silently bundling whatever dist/ happened to
 * contain rather than the source that was just edited.
 */
export const esbuildAlias = {
  "@nexus-cyberdeck/tokens": src("tokens", "index.ts"),
  "@nexus-cyberdeck/react": src("react", "index.ts"),
  "@nexus-cyberdeck/graph": src("graph", "index.ts"),
};
