import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { banner, gotoPage, settle } from "./harness.js";

/* ============================================================================
   Routing.

   Every page has a URL. These are the behaviours that make that worth
   having — a deep link opens the page, the nav is made of real links, history
   works — plus the resets a full page load would have done for free.
   ========================================================================== */

const nav = (page: Page) => banner(page).getByRole("navigation", { name: "Sections" });

test("a deep link opens its page and marks it current in the nav", async ({ page }) => {
  await gotoPage(page, "tokens");
  await expect(page.getByRole("heading", { level: 1, name: "Tokens" })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Tokens" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page).toHaveTitle("Tokens — Nexus Cyberdeck");
});

test("the nav is links with real hrefs, and Home is the bare URL", async ({ page }) => {
  await gotoPage(page, "home");
  await expect(nav(page).getByRole("link", { name: "Home" })).toHaveAttribute("href", "#/");
  await expect(nav(page).getByRole("link", { name: "Primitives" })).toHaveAttribute(
    "href",
    "#/primitives",
  );
});

test("back and forward move between pages", async ({ page }) => {
  await gotoPage(page, "home");
  await nav(page).getByRole("link", { name: "Primitives" }).click();
  await expect(page).toHaveURL(/#\/primitives$/);
  await nav(page).getByRole("link", { name: "Tokens" }).click();

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Primitives" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: "Tokens" })).toBeVisible();
});

test("changing page starts the new one at the top, with focus in it", async ({ page }) => {
  await gotoPage(page, "primitives");
  const main = page.locator("main");
  await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await nav(page).getByRole("link", { name: "Overlays" }).click();
  await expect(main).toBeFocused();
  expect(await main.evaluate((el) => el.scrollTop)).toBe(0);
});

test("the skip link focuses the page without changing the route", async ({ page }) => {
  await gotoPage(page, "tokens");
  // gotoPage leaves focus on the theme button it clicked, so the skip link is
  // focused directly rather than reached by Tab.
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/#\/tokens$/);
});

test("an unknown route says so and links home", async ({ page }) => {
  await page.goto("/#/nowhere");
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "No such page" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(page).toHaveURL(/#\/$/);
});
