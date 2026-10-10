import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { DOC_ROUTES, gotoPage, spec } from "./harness.js";
import type { Route } from "./harness.js";

/* ============================================================================
   Accessibility, first half: axe-core over the real rendered page, per route,
   per component and per open overlay.

   axe is a floor, not a ceiling: it finds contrast and malformed ARIA, and it
   is silent about whether a modal steals focus at page load or whether six
   shapes are actually distinguishable from one another. The claims it cannot
   make are asserted directly in a11y-claims.spec.ts.
   ========================================================================== */

// A full axe pass costs a couple of seconds on its own and closer to ten
// under parallel load, and this file runs twenty-five of them. The default
// 30s budget is sized for interaction tests, not for static analysis of a
// rendered page — raising it here is honest, whereas cutting the number of
// scans to fit would just be reducing coverage to satisfy a timer.
// Playwright validates the shape of this argument at runtime and rejects
// anything but an object destructuring pattern, so the empty pattern is
// required rather than an oversight.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => testInfo.setTimeout(120_000));

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const audit = (page: Page) => new AxeBuilder({ page }).withTags(WCAG);

/** Renders a failure that names the rule and the element, not just a count. */
function report(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map(
      (v) =>
        `${v.id} (${v.impact}) — ${v.help}\n` +
        v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n"),
    )
    .join("\n\n");
}

/* ---------------------------------------------------------------- by route */

// "graph" mounts GraphCanvas's WebGL scene (NX-13): the root's role/name,
// the label pool's aria-hidden, and the tooltip's contrast are all only
// live once boot() actually runs against a real GPU, which is exactly what
// this route's axe pass covers alongside every documentation page.
const ROUTES: Route[] = ["home", "labs/graph", ...DOC_ROUTES];

for (const route of ROUTES) {
  test(`${route} has no axe violations`, async ({ page }) => {
    await gotoPage(page, route, "hud-aa");
    const { violations } = await audit(page).analyze();
    expect(report(violations), report(violations)).toBe("");
  });
}

/* ------------------------------------------------------------ by component */

// One scan per named example, scoped to that example. Scoping is what makes a
// failure actionable: a page-level scan says "the Overlays page has a
// violation", this says which component owns it.
const COMPONENTS: [Route, string][] = [
  ["components/panel", "Panel"],
  ["foundations/typography", "Typography"],
  ["components/button", "Button"],
  ["components/tab-strip", "TabStrip"],
  ["components/slider", "Slider"],
  ["components/toggle-row", "ToggleRow"],
  ["components/glyph", "Glyph"],
  ["components/link-glyph", "LinkGlyph"],
  ["components/tooltip", "Tooltip"],
  ["components/key-value", "KeyValue"],
  ["components/stat", "Stat"],
  ["components/hazard-rule", "HazardRule"],
  ["components/section-heading", "SectionHeading"],
  ["components/wordmark", "Wordmark"],
  ["components/blink-cursor", "BlinkCursor"],
  ["components/graph-outline", "GraphOutline"],
  ["components/legend", "Legend"],
  ["components/nexus-provider", "NexusProvider"],
  ["components/drawer", "Drawer"],
  ["components/command-palette", "CommandPalette"],
  ["components/meter-row", "MeterRow"],
  ["foundations/tokens", "Layers"],
  ["foundations/tokens", "Themes"],
  ["foundations/tokens", "AA compliance"],
  ["foundations/colour", "Text & icon roles"],
  ["foundations/colour", "Palette"],
  ["foundations/colour", "Muted ramp"],
  ["foundations/typography", "Type scale"],
  ["foundations/motion", "Motion"],
  ["foundations/component-tokens", "Button tokens"],
  ["hooks/use-hotkey", "useHotkey"],
  ["hooks/use-focus-trap", "useFocusTrap"],
  ["hooks/rank-items", "rankItems"],
  ["start", "Install"],
  ["start", "First panel"],
];

for (const [route, name] of COMPONENTS) {
  test(`${name} has no axe violations`, async ({ page }) => {
    await gotoPage(page, route, "hud-aa");
    await expect(spec(page, name)).toBeVisible();
    const { violations } = await audit(page).include(`[data-spec="${name}"]`).analyze();
    expect(report(violations), report(violations)).toBe("");
  });
}

/* --------------------------------------------------------- overlay states */

test.describe("overlays while open", () => {
  test("drawer", async ({ page }) => {
    await gotoPage(page, "components/drawer", "hud-aa");
    await page.getByRole("button", { name: "Open drawer" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const { violations } = await audit(page).analyze();
    expect(report(violations), report(violations)).toBe("");
  });

  test("command palette with results", async ({ page }) => {
    await gotoPage(page, "components/command-palette", "hud-aa");
    await page.getByRole("button", { name: "Open palette" }).click();
    await page.getByRole("combobox").fill("atlas");
    await expect(page.getByRole("option").first()).toBeVisible();
    const { violations } = await audit(page).analyze();
    expect(report(violations), report(violations)).toBe("");
  });

  test("command palette with no results still announces the count", async ({ page }) => {
    await gotoPage(page, "components/command-palette", "hud-aa");
    await page.getByRole("button", { name: "Open palette" }).click();
    await page.getByRole("combobox").fill("zzzzz");
    await expect(page.getByRole("status")).toHaveText(/0 results/);
    const { violations } = await audit(page).analyze();
    expect(report(violations), report(violations)).toBe("");
  });
});

/* ------------------------------------------------------- the theme bargain */

test.describe("the contrast trade-off between themes", () => {
  // The README's central accessibility claim is that hud-aa meets AA and hud
  // knowingly does not. Both halves are asserted, because a claim that only
  // ever gets checked in the direction you hope for is not being checked.

  test("hud-aa passes axe's colour-contrast rule", async ({ page }) => {
    await gotoPage(page, "foundations/typography", "hud-aa");
    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(report(violations), report(violations)).toBe("");
  });

  test("hud genuinely fails it — the documented trade-off, not an oversight", async ({ page }) => {
    await gotoPage(page, "foundations/typography", "hud");
    const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(
      violations.length,
      "hud is documented as failing AA. If this passes, either the ramp was " +
        "quietly fixed (update the README and tokens.json) or the test stopped " +
        "measuring anything.",
    ).toBeGreaterThan(0);
    expect(violations[0]?.id).toBe("color-contrast");
  });
});
