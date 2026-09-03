import { defineConfig } from "vitest/config";
import { workspaceAlias } from "../../workspace-alias.mjs";

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Barrels re-export and nothing else. v8 records no execution for
        // them, so twenty of them drag the ratio down while representing no
        // untested logic whatsoever — they measure the folder structure, not
        // the code.
        "src/**/index.ts",
      ],
      reporter: ["text-summary", "lcov"],
      // Set just under the measured baseline so the gate ratchets rather than
      // blocks: it cannot silently fall, and every component that gains a test
      // raises the floor. 65% -> 92% when every component got tests, then
      // -> 98% once the barrels stopped being counted; excluding them did not
      // add coverage, it stopped twenty re-export files from hiding it.
      thresholds: {
        statements: 97,
        branches: 87,
        functions: 85,
        lines: 97,
      },
    },
  },
});
