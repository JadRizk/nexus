import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { DOC_ROUTES, gotoPage } from "./harness.js";

/* ============================================================================
   Token reference coverage.

   The Foundations pages are generated from tokens.json, but each table picks
   its tokens by group, so a group added to the JSON and not to a page would
   be built, shipped and never documented — with every other test green. This
   holds the reference to the generated stylesheet: every custom property
   tokens.css defines appears in exactly one row across the Foundations pages.
   ========================================================================== */

test("every token in tokens.css appears exactly once on the Foundations pages", async ({
  page,
}) => {
  // The suite runs from the repository root, locally and in CI alike.
  const css = readFileSync(join(process.cwd(), "packages/tokens/src/tokens.css"), "utf8");
  const defined = [
    ...new Set(Array.from(css.matchAll(/^\s*(--nx-[a-z0-9-]+)\s*:/gm), (m) => m[1])),
  ];

  const shown: string[] = [];
  for (const route of DOC_ROUTES.filter((r) => r.startsWith("foundations/"))) {
    await gotoPage(page, route);
    shown.push(
      ...(await page
        .locator("tr[data-token]")
        .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-token") ?? ""))),
    );
  }

  expect(
    shown.filter((n, i) => shown.indexOf(n) !== i),
    "tokens listed twice",
  ).toEqual([]);
  expect(
    defined.filter((n) => !shown.includes(n)),
    "tokens missing from the reference",
  ).toEqual([]);
  expect(
    shown.filter((n) => !defined.includes(n)),
    "rows for tokens tokens.css lacks",
  ).toEqual([]);
});
