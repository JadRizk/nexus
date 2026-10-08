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
  // The header names the section, which is current for every page under it.
  await expect(nav(page).getByRole("link", { name: "Components" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("the header nav is links with real hrefs, and Home is the bare URL", async ({ page }) => {
  await gotoPage(page, "home");
  await expect(nav(page).getByRole("link", { name: "Home" })).toHaveAttribute("href", "#/");
  await expect(nav(page).getByRole("link", { name: "Components" })).toHaveAttribute(
    "href",
    "#/components",
  );
  await expect(nav(page).getByRole("link", { name: "Graph" })).toHaveAttribute(
    "href",
    "#/labs/graph",
  );
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
  await nav(page).getByRole("link", { name: "Components" }).click();
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
