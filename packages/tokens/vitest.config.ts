import { defineConfig } from "vitest/config";

// Pure logic — accessor functions and contrast data, no DOM involved.
export default defineConfig({
  test: { environment: "node" },
});
