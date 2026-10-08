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
      // -> 98% once the barrels stopped being counted (excluding them did not
      // add coverage, it stopped twenty re-export files from hiding it). The
      // Prettier sweep then expanded lines without changing what runs, which
      // cost statements 0.7pp; the Drawer and CommandPalette tests more than
      // earned it back, and the floor moved up to 99/92/95. Branches rose to 94
      // once useHotkey's platform handling was tested.
      //
      // Vitest 4 then changed how v8 coverage is counted: it remaps to the
      // source AST instead of line ranges, so the same code reports about 310
      // statements where it used to report about 800. The percentages are not
      // comparable across that change, and statements read 98.4 on the new
      // counting with nothing less tested (the new counting also showed two
      // real gaps, since closed). The floors below are set just under the new
      // baseline, as above, so they ratchet from here.
      thresholds: {
        statements: 98,
        branches: 94,
        functions: 99,
        lines: 99,
      },
    },
  },
});
