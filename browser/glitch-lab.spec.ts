import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoPage } from "./harness.js";

/* ============================================================================
   Glitch Lab (effects/GlitchLab.jsx).

   Its picture is a shader pipeline on the frame clock, so the route is never
   screenshotted. These cover what it does instead: the engine mounts without
   a shader fault, a preset sets the resting stack, and an event fired from
   its trigger or its hotkey opens in the inspector. Written before the lab's
   TypeScript move (#90), so that move can show it changed none of this.

   Only uncaught page errors fail the run. console.error is not checked:
   firing an event that is already live logs a duplicate-key warning, which is
   known and out of scope here.

   The engine runs on a software WebGL renderer in the container, so the test
   is marked slow: a full parallel run starves it.
   ========================================================================== */

const panel = (page: Page, heading: string) =>
  page.locator(".nx-panel").filter({ hasText: heading });
const inspector = (page: Page) =>
  page.locator(".nx-panel").filter({ has: page.getByRole("tab", { name: "Event" }) });

test("the lab mounts, takes a preset, and opens fired events in the inspector", async ({
  page,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await gotoPage(page, "labs/glitch");

  // The engine appended its canvas, and did not fall back to the fault screen.
  await expect(page.locator("main canvas")).toHaveCount(1);
  await expect(page.getByText("SHADER FAULT")).toHaveCount(0);

  // CLEAN is the CRT layer alone.
  await page.getByRole("button", { name: "CLEAN", exact: true }).click();
  await expect(panel(page, "/// STACK").getByText("1 ON", { exact: true })).toBeVisible();

  // The triggers fire on mousedown, not click.
  await page.getByRole("button", { name: /^DROPOUT/ }).hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(inspector(page).getByText("DROPOUT", { exact: true })).toBeVisible();
  await expect(inspector(page).getByText(/220MS · CHAOS 0\.35/)).toBeVisible();

  // Key 2 is SIGNAL LOSS: it fires and opens in the inspector.
  await page.keyboard.press("2");
  await expect(inspector(page).getByText("SIGNAL LOSS", { exact: true })).toBeVisible();
  await expect(inspector(page).getByText("DROPOUT", { exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
});
