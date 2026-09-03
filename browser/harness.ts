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

export type Route = "home" | "primitives" | "overlays" | "tokens";

const NAV_LABEL: Record<Route, string> = {
  home: "Home",
  primitives: "Primitives",
  overlays: "Overlays",
  tokens: "Tokens",
};

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
  await page.goto("/");

  // Theme and CRT are set from the Primitives page, not from wherever we are
  // going. On Home the docked Drawer is `position: fixed` in the top-right and
  // sits over the site header, so the theme and CRT buttons are underneath it
  // and cannot be clicked at this viewport. Both controls live in the provider
  // and persist across routes, so setting them somewhere unobstructed is
  // equivalent — and avoids `force: true`, which would paper over exactly the
  // kind of overlap a visual suite is supposed to notice.
  await page.getByRole("button", { name: "Primitives", exact: true }).click();

  const crtButton = banner(page).getByRole("button", { name: "CRT", exact: true });
  if ((await crtButton.getAttribute("aria-pressed")) === String(!crt)) await crtButton.click();
  await expect(crtButton).toHaveAttribute("aria-pressed", String(crt));

  await setTheme(page, theme);

  if (route !== "primitives") {
    await page.getByRole("button", { name: NAV_LABEL[route], exact: true }).click();
  }

  await settle(page);
}

/**
 * The site header. Scoping to it matters: the Home page renders its own
 * theme panel with AA/HUD buttons of the same name, so an unscoped locator is
 * ambiguous the moment a test visits Home.
 */
export function banner(page: Page): Locator {
  return page.getByRole("banner");
}

export async function setTheme(page: Page, theme: Theme) {
  await banner(page)
    .getByRole("button", { name: theme === "hud-aa" ? "AA" : "HUD", exact: true })
    .click();
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
