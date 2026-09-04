import { defineConfig, devices } from "@playwright/test";

/* ============================================================================
   Visual regression configuration.

   The hard problem with pixel baselines is that they are only comparable when
   the renderer is. Chromium on macOS and Chromium on Ubuntu disagree about
   font hinting and antialiasing, so a baseline captured on a laptop fails on
   CI for reasons that have nothing to do with the change under review — which
   is how visual suites end up permanently red and then permanently ignored.

   So there is exactly one supported renderer: the official Playwright
   container, pinned to the same version as the @playwright/test dependency.
   CI runs the job inside that image; `npm run test:visual` runs the same image
   locally over Docker. Baselines are therefore captured once, on Linux, and
   are byte-comparable everywhere.

   Running `npx playwright test` directly on a host machine is deliberately not
   supported and will say so rather than producing misleading diffs.
   ========================================================================== */

const IN_CONTAINER = process.env.PLAYWRIGHT_BROWSERS_PATH === "/ms-playwright";

/**
 * When the runner is containerised but the dev server is on the host — the
 * local `npm run test:visual` path — the browser reaches it by this name.
 */
const BASE_URL = process.env.PW_BASE_URL ?? "http://127.0.0.1:4173";

if (!IN_CONTAINER && !process.env.PW_ALLOW_HOST) {
  throw new Error(
    "Visual tests must run in the pinned Playwright container so baselines stay " +
      "comparable.\n\n  npm run test:visual           run the suite\n" +
      "  npm run test:browser:update   re-record baselines after an intended change\n\n" +
      "Set PW_ALLOW_HOST=1 only to debug locally; never commit baselines produced that way.",
  );
}

export default defineConfig({
  testDir: "./browser",
  outputDir: "./browser/.results",

  // Baselines are Linux-only by design (see above), so the platform segment
  // Playwright adds by default would be noise. Naming them by test keeps the
  // directory readable as a catalogue of what is covered.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    // A fixed viewport and DPR: a screenshot is only a regression signal if
    // every input except the code is held still.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    trace: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      // Strict on purpose. The renderer is pinned to one container image, so
      // two runs of unchanged code produce identical bytes — which means any
      // tolerance here is not absorbing noise, it is absorbing regressions.
      //
      // The first draft of this config allowed a 0.2% pixel ratio, which
      // sounds conservative and is not: on a panel screenshot it permits ~360
      // changed pixels, and Panel's four corner ticks are about 120 pixels in
      // total. Deleting the entire corner-tick system passed. A visual suite
      // calibrated that way is worse than none, because it is a green light
      // nobody re-examines.
      //
      // If this ever goes flaky, the fix is to stabilise the input — wait for
      // a font, disable an animation, pin a viewport — not to widen this.
      maxDiffPixels: 0,
      threshold: 0.1,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // In CI everything is inside the container, so the server is a sibling
  // process. Locally the server runs on the host and PW_BASE_URL points at it.
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        // Builds first: `vite preview` serves dist/, which does not exist in a
        // fresh checkout, and a server that 404s is a much more confusing
        // failure than a missing build step.
        //
        // --host 127.0.0.1 is required too — vite preview otherwise binds IPv6
        // localhost only, and the url below is IPv4.
        command:
          "npm run build -w apps/showcase && " +
          "npm run preview -w apps/showcase -- --port 4173 --strictPort --host 127.0.0.1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
