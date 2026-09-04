import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { banner, focusVisible, gotoPage, setTheme, spec, settle, versionMask } from "./harness.js";

/* ============================================================================
   Interaction states, the CRT layer, and the theme swap.

   These are the cases where the unit tests assert a fact about the DOM and the
   pixel test asserts the consequence. `toHaveAttribute("data-active", "1")`
   passes whether or not the active style is still wired to a token that
   exists; only a screenshot knows whether the button actually inverted.
   ========================================================================== */

test.describe("focus rings", () => {
  // WCAG 2.4.7. The ring is defined once, globally, on `.nx-root :focus-visible`
  // and is deliberately not removable per component — which also means one
  // stray `outline: none` anywhere would silently delete it everywhere.

  test("button shows a focus ring on keyboard focus", async ({ page }) => {
    await gotoPage(page, "primitives");
    await focusVisible(spec(page, "Button").getByRole("button").first());
    await expect(spec(page, "Button")).toHaveScreenshot("focus-button.png");
  });

  test("slider thumb shows a focus ring", async ({ page }) => {
    // The thumb ring needs two vendor-prefixed pseudo-element rules to exist.
    // Losing one is invisible in every other kind of test.
    await gotoPage(page, "primitives");
    await focusVisible(spec(page, "Slider").getByRole("slider").first());
    await expect(spec(page, "Slider")).toHaveScreenshot("focus-slider.png");
  });

  test("toggle row draws the ring on the row, not the hidden checkbox", async ({ page }) => {
    // The input is visually hidden, so the ring comes from :focus-within on the
    // label with a negative offset that keeps it inside a tightly stacked list.
    await gotoPage(page, "primitives");
    await focusVisible(spec(page, "ToggleRow").getByRole("checkbox").first());
    await expect(spec(page, "ToggleRow")).toHaveScreenshot("focus-togglerow.png");
  });

  test("tab strip shows the ring on the selected tab under roving tabindex", async ({ page }) => {
    await gotoPage(page, "primitives");
    await focusVisible(spec(page, "TabStrip").getByRole("tab").first());
    await expect(spec(page, "TabStrip")).toHaveScreenshot("focus-tabstrip.png");
  });

  test("the skip link is the first focusable element in the document", async ({ page }) => {
    // Asserted structurally rather than by pressing Tab. On a fresh load of
    // Home the drawer mounts open and its focus trap pulls focus inside, so
    // the first Tab lands in the drawer and the skip link is never reached —
    // see the note on Drawer-as-docked-panel in the review. That is a defect
    // in the showcase, not in the skip link, and encoding it as the expected
    // tab order here would quietly bless it.
    await page.goto("/");
    await settle(page);

    const firstFocusable = await page.evaluate(() => {
      const SEL =
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
        'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const el = document.querySelector<HTMLElement>(SEL);
      return el ? `${el.tagName}.${el.className}` : null;
    });
    expect(firstFocusable).toBe("A.nx-skip");
  });

  test("the skip link is off-screen until focused, then visible", async ({ page }) => {
    await gotoPage(page, "primitives");
    const skip = page.getByRole("link", { name: "Skip to content" });

    const offscreen = await skip.evaluate((el) => el.getBoundingClientRect().x);
    expect(offscreen).toBeLessThan(-1000);

    await focusVisible(skip);
    const onscreen = await skip.evaluate((el) => el.getBoundingClientRect().x);
    expect(onscreen).toBeGreaterThanOrEqual(0);

    // No version mask here, unlike the console shots: the focused skip link
    // sits on top of the version and hides it, so masking would paint over
    // the skip link itself — the one thing this baseline exists to show.
    await expect(page).toHaveScreenshot("focus-skip-link.png", {
      clip: { x: 0, y: 0, width: 420, height: 120 },
    });
  });
});

test.describe("hover states", () => {
  test("button hover", async ({ page }) => {
    await gotoPage(page, "primitives");
    await spec(page, "Button").getByRole("button").first().hover();
    await expect(spec(page, "Button")).toHaveScreenshot("hover-button.png");
  });

  test("toggle row hover", async ({ page }) => {
    await gotoPage(page, "primitives");
    // Hover the row, not the checkbox: the input is visually hidden at 1px and
    // clipped, so it is the label that actually receives the pointer.
    await spec(page, "ToggleRow").locator(".nx-row").first().hover();
    await expect(spec(page, "ToggleRow")).toHaveScreenshot("hover-togglerow.png");
  });
});

test.describe("CRT layer", () => {
  // The one place the rolling bar is wanted. Playwright pins animations to
  // their final frame, so the composite is captured at a fixed point rather
  // than wherever the bar happened to be.

  test("off", async ({ page }) => {
    await gotoPage(page, "home");
    await expect(page).toHaveScreenshot("crt-off.png", { fullPage: false, mask: versionMask(page) });
  });

  test("on", async ({ page }) => {
    // Enabled before navigating: on Home the docked drawer covers the header,
    // so the CRT control cannot be clicked once we are there.
    await gotoPage(page, "home", "hud-aa", { crt: true });
    await expect(banner(page).getByRole("button", { name: "CRT", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await settle(page);
    await expect(page).toHaveScreenshot("crt-on.png", { fullPage: false, mask: versionMask(page) });
  });
});

test.describe("theme swap", () => {
  // Direct cover for the bug that shipped for the entire life of the library:
  // NexusProvider sets data-nx-theme on its own div, and every semantic token
  // was declared once on :root — so the attribute changed and nothing a
  // component reads moved. These two shots must differ.

  test("the console in the AA theme", async ({ page }) => {
    await gotoPage(page, "home", "hud-aa");
    await expect(page).toHaveScreenshot("console-hud-aa.png", { mask: versionMask(page) });
  });

  test("the console in the prototype theme", async ({ page }) => {
    // The theme is set before navigating rather than switched here: on Home
    // the docked drawer covers the header controls (see harness).
    await gotoPage(page, "home", "hud");
    await expect(page).toHaveScreenshot("console-hud.png", { mask: versionMask(page) });
  });

  test("switching theme changes the muted ramp on screen, not just in the DOM", async ({
    page,
  }) => {
    await gotoPage(page, "primitives", "hud-aa");

    const disabled = () =>
      page
        .locator(".nx-root")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--nx-fg-disabled").trim());

    const aa = await disabled();
    await setTheme(page, "hud");
    const hud = await disabled();

    expect(aa).not.toBe(hud);
    expect(aa.toUpperCase()).toBe("#6B7F61");
    expect(hud.toUpperCase()).toBe("#3D4C39");
  });
});

test.describe("token reference", () => {
  test("the tokens page renders the full palette", async ({ page }) => {
    await gotoPage(page, "tokens");
    await expect(spec(page, "Signature colours")).toHaveScreenshot("tokens-signature.png");
  });

  test("the AA comparison table", async ({ page }) => {
    await gotoPage(page, "tokens");
    await expect(spec(page, "AA compliance")).toHaveScreenshot("tokens-aa.png");
  });
});

test.describe("component tokens", () => {
  /* Whether a consumer can restyle a component without forking it is the whole
     point of the component token layer, and it is not observable in jsdom —
     inheritance through custom properties only happens in a real cascade. */

  const restyle = (page: Page, css: string) =>
    page.addStyleTag({ content: `.nx-root { ${css} } ` });

  test("a consumer retheme of Button reaches every state", async ({ page }) => {
    await gotoPage(page, "primitives");
    const button = spec(page, "Button").getByRole("button").first();

    const before = await button.evaluate((el) => getComputedStyle(el).borderTopColor);
    await restyle(page, "--nx-btn-border: rgb(23, 226, 229);");
    await expect(button).toHaveCSS("border-top-color", "rgb(23, 226, 229)");
    expect(before).not.toBe("rgb(23, 226, 229)");

    // The hover state reads the same token rather than restating the property,
    // so a retheme cannot leave one state behind.
    await button.hover();
    await expect(button).toHaveCSS("border-top-color", "rgb(198, 241, 53)");
  });

  test("Panel's padding is reachable from a stylesheet", async ({ page }) => {
    // The specific complaint in the review: Panel styled itself inline, so its
    // padding could not be changed from CSS at all.
    await gotoPage(page, "primitives");
    const panel = spec(page, "Panel").locator(".nx-panel").first();

    await expect(panel).toHaveCSS("padding-top", "12px");
    await restyle(page, "--nx-panel-padding: 3px;");
    await expect(panel).toHaveCSS("padding-top", "3px");
  });

  test("a component token override does not leak into the semantic layer", async ({ page }) => {
    // Component tokens are a layer below the semantic one: overriding a
    // button's border must not move --nx-border-default for anything else.
    await gotoPage(page, "primitives");
    await restyle(page, "--nx-btn-border: rgb(255, 0, 0);");
    const semantic = await page
      .locator(".nx-root")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--nx-border-default").trim());
    expect(semantic).not.toBe("rgb(255, 0, 0)");
  });
});

test.describe("Panel corners=\"none\" suppression", () => {
  // Not a screenshot: the corner-tick variables default to transparent, so a
  // panel with the pseudo-element wrongly generated and one with it actually
  // suppressed render pixel-identical — a diff cannot tell them apart. That
  // is exactly how this bug shipped invisibly the first time. Only the
  // computed `content` value of the pseudo-element itself distinguishes
  // "generated, painting nothing" from "never generated", and jsdom does not
  // support pseudo-element computed styles at all, so this has to run here.
  test("no ::before pseudo-element is generated for a none-corners panel", async ({ page }) => {
    await gotoPage(page, "primitives");
    const header = banner(page);
    await expect(header).toHaveAttribute("data-nx-corners", "none");
    const content = await header.evaluate(
      (el) => getComputedStyle(el, "::before").content,
    );
    expect(content).toBe("none");
  });

  test("a corners panel does generate the pseudo-element", async ({ page }) => {
    // The contrasting case, so the assertion above is known to be
    // discriminating rather than trivially true for every element.
    await gotoPage(page, "primitives");
    const panel = spec(page, "Panel").locator(".nx-panel").first();
    await expect(panel).toHaveAttribute("data-nx-corners", "tl br");
    const content = await panel.evaluate((el) => getComputedStyle(el, "::before").content);
    expect(content).toBe('""');
  });
});
