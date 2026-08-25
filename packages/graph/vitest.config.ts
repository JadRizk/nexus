import { defineConfig } from "vitest/config";

// The testable surface here is pure math — physics stepping, camera
// projection — no DOM or WebGL context needed.
export default defineConfig({
  test: { environment: "node" },
});
