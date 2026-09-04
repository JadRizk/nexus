import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "../../workspace-alias.mjs";
import { componentCount, shortVersion, tokenCount } from "../../scripts/ds-figures.mjs";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAlias },
  // The figures the chrome advertises, read from the code at build time so a
  // version bump or a new component can never leave the header stale. See
  // scripts/ds-figures.mjs for why this is not a hand-typed string.
  define: {
    __NX_VERSION__: JSON.stringify(shortVersion),
    __NX_TOKENS__: JSON.stringify(tokenCount),
    __NX_COMPONENTS__: JSON.stringify(componentCount),
  },
  server: {
    port: 5173,
  },
  preview: {
    // The visual suite serves the built showcase here and points a browser in
    // the pinned Playwright container at it, which arrives with a
    // host.docker.internal Host header. Vite's host check rejects that by
    // default; this is the only extra name allowed, and only for `preview`.
    allowedHosts: ["host.docker.internal"],
  },
  test: {
    environment: "node",
  },
});
