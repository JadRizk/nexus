import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { workspaceAlias } from "../../workspace-alias.mjs";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAlias },
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
