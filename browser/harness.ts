import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/* ============================================================================
   Shared setup for the visual suite.

   Everything here exists to hold inputs still. A screenshot test is only a
   signal about the code if nothing else can move underneath it — so fonts are
   awaited, animations are pinned, and each example is located by its own
   anchor rather than by position on the page.
   ========================================================================== */

export const THEMES = ["hud-aa", "hud"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * A showcase route: the hash path without "#/". "home" is the bare URL.
 */
export type Route = "home" | (typeof DOC_ROUTES)[number] | "labs/graph" | "labs/glitch";

/**
 * Every documentation page, in sidebar order. Listed by hand so tests can be
 * declared per page; routing.spec.ts fails if it ever disagrees with the
 * sidebar, so a page added to the site cannot quietly go untested.
 */
export const DOC_ROUTES = [
  "start",
  "foundations/tokens",
  "foundations/colour",
  "foundations/typography",
  "foundations/space",
  "foundations/motion",
  "foundations/depth",
  "foundations/component-tokens",
  "components",
  "components/panel",
  "components/hazard-rule",
  "components/section-heading",
  "components/wordmark",
  "components/blink-cursor",
  "components/button",
  "components/tab-strip",
  "components/slider",
  "components/toggle-row",
  "components/key-value",
  "components/stat",
  "components/meter-row",
  "components/legend",
  "components/tooltip",
  "components/glyph",
  "components/link-glyph",
  "components/graph-outline",
  "components/drawer",
  "components/command-palette",
  "components/nexus-provider",
  "hooks/use-hotkey",
  "hooks/use-focus-trap",
  "hooks/rank-items",
] as const;

/**
 * Loads a showcase route in a known theme with CRT off.
 *
 * CRT is disabled for every test but the one that covers it: it composites a
 * rolling refresh bar over the whole shell, and a bar caught mid-travel is a
 * diff that means nothing.
 */
export async function gotoPage(
  page: Page,
  route: Route,
  theme: Theme = "hud-aa",
  { crt = false }: { crt?: boolean } = {},
) {
  // Every page has its own URL, so a test opens the page under test directly
  // rather than landing on Home and clicking through the nav.
  await page.goto(route === "home" ? "/" : `/#/${route}`);

  // Theme and CRT live in the provider, so they are set once the page is up,
  // through the site palette: the only control for either, on every route.
  const root = page.locator(".nx-root");
  if ((await root.getAttribute("data-nx-crt")) !== (crt ? "on" : "off")) {
    await runSiteAction(page, crt ? "Turn the CRT layer on" : "Turn the CRT layer off");
  }
  await expect(root).toHaveAttribute("data-nx-crt", crt ? "on" : "off");

  await setTheme(page, theme);

  await settle(page);
}

/** The site header: the section nav and the Search button. */
export function banner(page: Page): Locator {
  return page.getByRole("banner");
}

/**
 * Runs one of the site palette's actions by its exact label, opened from the
 * header's Search button. Focus and pointer are moved off the button
 * afterwards, or its focus ring or hover state would be in every shot.
 */
export async function runSiteAction(page: Page, label: string) {
  await banner(page)
    .getByRole("button", { name: /^Search/ })
    .click();
  const palette = page.getByRole("dialog", { name: "Search the site" });
  await expect(palette).toBeVisible();
  await page.keyboard.type(label);
  await expect(page.getByRole("option").first()).toHaveText(new RegExp(label, "i"));
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // The pointer is still over Search, whose hover state would be in the shot.
  await page.mouse.move(0, 0);
}

export async function setTheme(page: Page, theme: Theme) {
  if ((await page.locator(".nx-root").getAttribute("data-nx-theme")) !== theme) {
    await runSiteAction(
      page,
      theme === "hud" ? "Switch to the HUD theme" : "Switch to the AA theme",
    );
  }
  // Assert the switch actually took effect rather than trusting the click.
  // This is the bug the token generator fixed: the control was live, the
  // attribute changed, and none of the values a component reads moved.
  await expect(page.locator(".nx-root")).toHaveAttribute("data-nx-theme", theme);
}

/**
 * Focuses an element the way a keyboard user would, so `:focus-visible`
 * actually matches.
 *
 * This is not incidental. Chromium only treats focus as "visible" when the
 * last input modality was the keyboard, so a plain `locator.focus()` after the
 * navigation clicks leaves `:focus-visible` false and the ring unpainted. The
 * first version of these tests did exactly that: they screenshotted an element
 * with no ring, recorded that as the baseline, and then passed happily when
 * the global focus ring was deleted outright. Pressing a key first sets the
 * modality; the subsequent focus() then matches.
 */
export async function focusVisible(target: Locator) {
  const page = target.page();
  await page.keyboard.press("Tab");
  await target.focus();
  await expect(target).toBeFocused();
  // Fail loudly here rather than silently capturing a ringless baseline.
  await expect(
    target,
    "element is focused but not :focus-visible — the ring would not be captured",
  ).toHaveCSS("outline-style", "solid");
}

/**
 * The rendered package version, masked out of every screenshot that contains
 * the site chrome.
 *
 * The version is derived from packages/react/package.json at build time, so
 * without this a `changeset version` bump would change the pixels in five
 * baselines while nothing about the design moved — and re-recording needs
 * Docker, on a pull request opened by a bot. Masking keeps the release path
 * clear without weakening the zero-pixel threshold anywhere it is measuring
 * the design. Everything else the chrome advertises (the token and component
 * counts) stays compared: those move only when the code moves, and the pull
 * request that moves them re-records the baselines anyway.
 *
 * The mask covers the rendered digits, not the space they take: a version
 * whose width changes — 3.9 to 3.10, or 9.x to 10.x — widens the masked box
 * and shifts the blink cursor and nav beside it, so those baselines need
 * re-recording once. Every bump that keeps the same width, which is all of
 * them in between, moves nothing.
 */
export function versionMask(page: Page): Locator[] {
  // The figure counters (token and component counts, rendered on Home) are
  // masked for the same reason the version is: they change
  // whenever a token or component is added, and a one-glyph change in a
  // full-page baseline at maxDiffPixels: 0 would otherwise force a re-record
  // on every such PR (NX-25 was the first to hit it).
  return [page.locator("[data-nx-version]"), page.locator("[data-nx-figure]")];
}

/** One named example from a showcase page. */
export function spec(page: Page, name: string): Locator {
  return page.locator(`[data-spec="${name}"]`);
}

/**
 * Waits for the things that would otherwise be captured mid-flight: webfonts
 * resolving, the blink animation, and any pending layout.
 */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/**
 * Masks for a shot of Home: the version and figures, plus the hero's live
 * signal. That canvas is Glitch Lab's shader pipeline running on the frame
 * clock, so no two captures of it agree; Glitch Lab's own route is not
 * screenshotted for the same reason. The frame around it, its controls and
 * its caption stay compared.
 */
export function homeMask(page: Page): Locator[] {
  return [...versionMask(page), page.locator(".sc-monitor__host")];
}
