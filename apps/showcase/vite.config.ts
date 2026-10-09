import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "../../workspace-alias.mjs";
import { componentCount, shortVersion, tokenCount } from "../../scripts/ds-figures.mjs";
import { componentCssFiles, componentLayer } from "../../scripts/component-layer.mjs";
import { BRAND, manifestJson, renderHead } from "../../scripts/brand-meta.mjs";

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

// The brand head block and the web app manifest, filled from
// scripts/brand-meta.mjs so the strings and the ground colour are never
// hand-copied into a file a crawler or an OS reads. `pre` runs before Vite's
// own HTML processing, so the icon links, which are public files, still get
// the base prefixed after. The manifest is not a public file, so its link
// takes the base from here: without it the built page links /site.webmanifest
// and Pages answers 404.
function brandHead(): Plugin {
  let base = "/";
  return {
    name: "nx-brand-head",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: { order: "pre", handler: (html) => renderHead(html, { base }) },
    configureServer(server) {
      server.middlewares.use(`${server.config.base}site.webmanifest`, (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json");
        res.end(manifestJson());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "site.webmanifest", source: manifestJson() });
    },
  };
}

export default defineConfig({
  plugins: [react(), componentLayerModule(), brandHead()],
  resolve: { alias: workspaceAlias },
  // The figures the chrome advertises, read from the code at build time so a
  // version bump or a new component can never leave the header stale. See
  // scripts/ds-figures.mjs for why this is not a hand-typed string.
  define: {
    __NX_VERSION__: JSON.stringify(shortVersion),
    __NX_TOKENS__: JSON.stringify(tokenCount),
    __NX_COMPONENTS__: JSON.stringify(componentCount),
    __NX_TITLE__: JSON.stringify(BRAND.title),
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
