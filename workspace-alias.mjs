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
  { find: /^@nexus\/tokens$/, replacement: src("tokens", "index.ts") },
  { find: /^@nexus\/tokens\/(.*)$/, replacement: src("tokens", "$1") },
  { find: /^@nexus\/react$/, replacement: src("react", "index.ts") },
  { find: /^@nexus\/react\/(.*)$/, replacement: src("react", "$1") },
  { find: /^@nexus\/graph$/, replacement: src("graph", "index.ts") },
];
