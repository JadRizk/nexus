import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { banner, DOC_ROUTES, gotoPage, settle } from "./harness.js";

/* ============================================================================
   Routing.

   Every page has a URL. These are the behaviours that make that worth
   having — a deep link opens the page, the nav is made of real links, history
   works — plus the resets a full page load would have done for free.
   ========================================================================== */

const nav = (page: Page) => banner(page).getByRole("navigation", { name: "Sections" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Documentation" });
const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

test("a deep link opens its page and marks it current in both navs", async ({ page }) => {
  await gotoPage(page, "components/slider");
  await expect(h1(page, "Slider")).toBeVisible();
  await expect(page).toHaveTitle("Slider — Nexus Cyberdeck");
  await expect(sidebar(page).getByRole("link", { name: "Slider" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Docs is one header entry, current for every page under the sidebar.
  await expect(nav(page).getByRole("link", { name: "Docs" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("the header nav is links with real hrefs, and the wordmark is Home", async ({ page }) => {
  await gotoPage(page, "home");
  const home = banner(page).getByRole("link", { name: "Nexus, home" });
  await expect(home).toHaveAttribute("href", "#/");
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(nav(page).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "#/start");
  await expect(nav(page).getByRole("link", { name: "Graph" })).toHaveAttribute(
    "href",
    "#/labs/graph",
  );
});

test("the header links the repository to star", async ({ page }) => {
  await gotoPage(page, "home");
  await expect(banner(page).getByRole("link", { name: "Star Nexus on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/JadRizk/nexus",
  );
});

test("a phone is not offered the labs, which have no phone layout", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoPage(page, "home");
  for (const name of ["Graph", "Glitch Lab"]) {
    await expect(nav(page).getByRole("link", { name })).toBeHidden();
    await expect(page.locator(".sc-route", { hasText: name })).toBeHidden();
  }
  await expect(nav(page).getByRole("link", { name: "Docs" })).toBeVisible();
  // The header still fits one row: nothing pushes the page sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("on a phone the docs sidebar folds behind a toggle and closes on a choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoPage(page, "components/button");
  const toggle = page.getByRole("button", { name: /Pages/ });
  const sidebar = page.getByRole("navigation", { name: "Documentation" });
  await expect(toggle).toContainText("Button");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await sidebar.getByRole("link", { name: "Slider" }).click();
  await expect(page).toHaveURL(/#\/components\/slider$/);
  await expect(toggle).toContainText("Slider");
  await expect(sidebar).toBeHidden();
  // The page has the width the sidebar used to take.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("the sidebar lists exactly the pages the suite tests", async ({ page }) => {
  // DOC_ROUTES drives the per-page axe and keyboard tests. A page added to the
  // site but not to that list would be reachable and untested; this is the
  // check that stops it.
  await gotoPage(page, "start");
  const hrefs = await sidebar(page)
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs).toEqual(DOC_ROUTES.map((r) => `#/${r}`));
});

test("back and forward move between pages", async ({ page }) => {
  await gotoPage(page, "home");
  await nav(page).getByRole("link", { name: "Docs" }).click();
  await expect(page).toHaveURL(/#\/start$/);
  await sidebar(page).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/#\/components$/);
  await page
    .getByRole("link", { name: /^Button/ })
    .first()
    .click();
  await expect(h1(page, "Button")).toBeVisible();

  await page.goBack();
  await expect(h1(page, "Components")).toBeVisible();
  await page.goForward();
  await expect(h1(page, "Button")).toBeVisible();
});

test("a short page does not scroll to fit the sidebar", async ({ page }) => {
  // The sidebar is longer than most pages. It scrolls on its own, capped at
  // <main>'s visible height, so it must never set the page's scroll height.
  await gotoPage(page, "components/hazard-rule");
  const main = page.locator("main");
  const sizes = await main.evaluate((el) => {
    const nav = el.querySelector<HTMLElement>(".sc-sidebar")!;
    return { main: [el.scrollHeight, el.clientHeight], nav: [nav.scrollHeight, nav.clientHeight] };
  });
  expect(sizes.main[0]).toBe(sizes.main[1]);
  expect(sizes.nav[0]).toBeGreaterThan(sizes.nav[1]);
});

test("a deep link scrolls its own sidebar entry into view, not the page", async ({ page }) => {
  await gotoPage(page, "hooks/rank-items");
  const current = sidebar(page).getByRole("link", { name: "rankItems" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toBeInViewport();
  expect(await page.locator("main").evaluate((el) => el.scrollTop)).toBe(0);
});

test("every page renders when reached by client-side navigation", async ({ page }) => {
  // Direct loads are covered page by page elsewhere; this walks the sidebar
  // in one session, so each page mounts after a different one. A page whose
  // hooks leaked into the shell rendered fine on a direct load and crashed
  // the whole app here.
  test.setTimeout(60_000);
  await gotoPage(page, "start");
  for (const route of DOC_ROUTES) {
    await sidebar(page).locator(`a[href="#/${route}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#/${route}$`));
    await expect(page.locator("main h1"), route).toBeVisible();
  }
});

test("changing page starts the new one at the top, with focus in it", async ({ page }) => {
  await gotoPage(page, "foundations/tokens");
  const main = page.locator("main");
  await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await sidebar(page).getByRole("link", { name: "Typography" }).click();
  await expect(main).toBeFocused();
  expect(await main.evaluate((el) => el.scrollTop)).toBe(0);
});

test("the skip link focuses the page without changing the route", async ({ page }) => {
  await gotoPage(page, "foundations/tokens");
  // gotoPage leaves focus on the theme button it clicked, so the skip link is
  // focused directly rather than reached by Tab.
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/#\/foundations\/tokens$/);
});

test("a malformed escape in the URL reaches the not-found page, not a blank one", async ({
  page,
}) => {
  await page.goto("/#/%E0");
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "No such page" })).toBeVisible();
});

test("an unknown route says so and links home", async ({ page }) => {
  await page.goto("/#/components/nowhere");
  await settle(page);
  await expect(h1(page, "No such page")).toBeVisible();
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test.describe("site palette", () => {
  // ⌘K / Ctrl+K and "/" open one palette on every route: the site's pages
  // plus the header's actions. ControlOrMeta is ⌘ on macOS and Ctrl elsewhere,
  // which is what useHotkey's "mod" means.
  const palette = (page: Page) => page.getByRole("dialog", { name: "Search the site" });

  test("goes to a page from any route", async ({ page }) => {
    await gotoPage(page, "foundations/colour");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.type("slid");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeHidden();
    await expect(h1(page, "Slider")).toBeVisible();
  });

  test("runs the site's actions, the only theme and CRT controls", async ({ page }) => {
    await gotoPage(page, "home", "hud-aa");
    // The header button is the palette's visible way in.
    await banner(page)
      .getByRole("button", { name: /^Search/ })
      .click();
    await page.keyboard.type("switch to the hud");
    await page.keyboard.press("Enter");
    await expect(page.locator(".nx-root")).toHaveAttribute("data-nx-theme", "hud");
  });

  test("stands aside on the CommandPalette page, which demonstrates its own", async ({ page }) => {
    await gotoPage(page, "components/command-palette");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(palette(page)).toHaveCount(0);
  });
});
