import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "../../workspace-alias.mjs";
import { componentCount, shortVersion, tokenCount } from "../../scripts/ds-figures.mjs";
import { componentCssFiles, componentLayer } from "../../scripts/component-layer.mjs";

// The component token layer as a module: parsed from the component
// stylesheets here, at build time, so the bundle carries the result rather
// than the raw CSS. Each stylesheet is watched, so editing one in dev
// regenerates the module.
const COMPONENT_LAYER_ID = "virtual:nx-component-layer";
function componentLayerModule(): Plugin {
  return {
    name: "nx-component-layer",
    resolveId: (id) => (id === COMPONENT_LAYER_ID ? `\0${id}` : undefined),
    load(id) {
      if (id !== `\0${COMPONENT_LAYER_ID}`) return undefined;
      for (const file of componentCssFiles()) this.addWatchFile(file);
      return `export default ${JSON.stringify(componentLayer())};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), componentLayerModule()],
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
