import { expect, test } from "@playwright/test";
import { gotoPage, spec, THEMES } from "./harness.js";

/* ============================================================================
   Component appearance, per theme.

   jsdom renders none of this. Panel's corner ticks in particular are eight
   stacked gradients positioned by an attribute-substring selector, so a
   one-character change to that selector passes typecheck, passes every unit
   test, and ships a panel with no corners. A pixel diff is the only thing that
   catches it.
   ========================================================================== */

for (const theme of THEMES) {
  test.describe(`${theme}`, () => {
    test("panel corner ticks in all four configurations", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "Panel")).toHaveScreenshot(`panel-${theme}.png`);
    });

    test("typography scale and the muted ramp", async ({ page }) => {
      // The ramp is the visible difference between the two themes, and the
      // type scale is the other. Until the token generator landed, switching
      // theme changed neither — this pair is the regression guard for that.
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "Typography")).toHaveScreenshot(`typography-${theme}.png`);
    });

    test("buttons", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "Button")).toHaveScreenshot(`button-${theme}.png`);
    });

    test("tab strip", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "TabStrip")).toHaveScreenshot(`tabstrip-${theme}.png`);
    });

    test("slider", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "Slider")).toHaveScreenshot(`slider-${theme}.png`);
    });

    test("toggle rows", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "ToggleRow")).toHaveScreenshot(`togglerow-${theme}.png`);
    });

    test("glyph silhouettes", async ({ page }) => {
      // WCAG 1.4.1 lives here: six distinguishable shapes, so category never
      // depends on colour alone. A shape collapsing into another is invisible
      // to every other kind of test in this repo.
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "Glyph")).toHaveScreenshot(`glyph-${theme}.png`);
    });

    test("link glyphs", async ({ page }) => {
      await gotoPage(page, "primitives", theme);
      await expect(spec(page, "LinkGlyph")).toHaveScreenshot(`linkglyph-${theme}.png`);
    });

    test("meter rows", async ({ page }) => {
      await gotoPage(page, "overlays", theme);
      await expect(spec(page, "MeterRow")).toHaveScreenshot(`meterrow-${theme}.png`);
    });
  });
}

test.describe("overlays", () => {
  test("drawer", async ({ page }) => {
    // The Overlays page mounts the drawer open, so this is its default state
    // rather than something the test has to arrange.
    await gotoPage(page, "overlays", "hud-aa");
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveScreenshot("drawer.png");
  });

  test("drawer closed is hidden from assistive tech and off-screen", async ({ page }) => {
    await gotoPage(page, "overlays", "hud-aa");
    await page.getByRole("button", { name: "Close drawer" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("command palette", async ({ page }) => {
    await gotoPage(page, "overlays", "hud-aa");
    await page.getByRole("button", { name: "Open palette" }).click();
    const palette = page.getByRole("dialog", { name: "SEARCH" });
    await expect(palette).toBeVisible();
    await expect(palette).toHaveScreenshot("command-palette.png");
  });

  test("command palette with a query and a highlighted option", async ({ page }) => {
    await gotoPage(page, "overlays", "hud-aa");
    await page.getByRole("button", { name: "Open palette" }).click();
    await page.getByRole("combobox").fill("atlas");
    await page.getByRole("combobox").press("ArrowDown");
    await expect(page.getByRole("dialog", { name: "SEARCH" })).toHaveScreenshot(
      "command-palette-query.png",
    );
  });
});
