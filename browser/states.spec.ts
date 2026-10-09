import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { banner, focusVisible, gotoPage, homeMask, setTheme, spec, settle } from "./harness.js";

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
    await gotoPage(page, "components/button");
    await focusVisible(spec(page, "Button").getByRole("button").first());
    await expect(spec(page, "Button")).toHaveScreenshot("focus-button.png");
  });

  test("slider thumb shows a focus ring", async ({ page }) => {
    // The thumb ring needs two vendor-prefixed pseudo-element rules to exist.
    // Losing one is invisible in every other kind of test.
    await gotoPage(page, "components/slider");
    await focusVisible(spec(page, "Slider").getByRole("slider").first());
    await expect(spec(page, "Slider")).toHaveScreenshot("focus-slider.png");
  });

  test("toggle row draws the ring on the row, not the hidden checkbox", async ({ page }) => {
    // The input is visually hidden, so the ring comes from :focus-within on the
    // label with a negative offset that keeps it inside a tightly stacked list.
    await gotoPage(page, "components/toggle-row");
    await focusVisible(spec(page, "ToggleRow").getByRole("checkbox").first());
    await expect(spec(page, "ToggleRow")).toHaveScreenshot("focus-togglerow.png");
  });

  test("tab strip shows the ring on the selected tab under roving tabindex", async ({ page }) => {
    await gotoPage(page, "components/tab-strip");
    await focusVisible(spec(page, "TabStrip").getByRole("tab").first());
    await expect(spec(page, "TabStrip")).toHaveScreenshot("focus-tabstrip.png");
  });

  test("the skip link is the first focusable element in the document", async ({ page }) => {
    // Asserted structurally rather than by pressing Tab: the question is where
    // the skip link sits in the document, not how the browser happens to walk
    // it on a given run.
    await page.goto("/");
    await settle(page);

    const firstFocusable = await page.evaluate(() => {
      const SEL =
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," +
        'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      const el = document.querySelector<HTMLElement>(SEL);
      return el ? `${el.tagName}.${el.className}` : null;
    });
    expect(firstFocusable).toBe("A.nx-skip");
  });

  test("the skip link is off-screen until focused, then visible", async ({ page }) => {
    await gotoPage(page, "components/button");
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
    await gotoPage(page, "components/button");
    await spec(page, "Button").getByRole("button").first().hover();
    await expect(spec(page, "Button")).toHaveScreenshot("hover-button.png");
  });

  test("toggle row hover", async ({ page }) => {
    await gotoPage(page, "components/toggle-row");
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
    await expect(page).toHaveScreenshot("crt-off.png", { fullPage: false, mask: homeMask(page) });
  });

  test("on", async ({ page }) => {
    // Enabled before navigating, like the theme, so the shot is of the page
    // as it loads rather than of a toggle being clicked.
    await gotoPage(page, "home", "hud-aa", { crt: true });
    await expect(page.locator(".nx-root")).toHaveAttribute("data-nx-crt", "on");
    await settle(page);
    await expect(page).toHaveScreenshot("crt-on.png", { fullPage: false, mask: homeMask(page) });
  });
});

test.describe("theme swap", () => {
  // Direct cover for the bug that shipped for the entire life of the library:
  // NexusProvider sets data-nx-theme on its own div, and every semantic token
  // was declared once on :root — so the attribute changed and nothing a
  // component reads moved. These two shots must differ.

  // The baselines keep their console-* names from when Home was a console.
  test("Home in the AA theme", async ({ page }) => {
    await gotoPage(page, "home", "hud-aa");
    await expect(page).toHaveScreenshot("console-hud-aa.png", { mask: homeMask(page) });
  });

  test("Home in the prototype theme", async ({ page }) => {
    // The theme is set before navigating rather than switched here, so the
    // shot is of the page as it loads.
    await gotoPage(page, "home", "hud");
    await expect(page).toHaveScreenshot("console-hud.png", { mask: homeMask(page) });
  });

  test("switching theme changes the muted ramp on screen, not just in the DOM", async ({
    page,
  }) => {
    await gotoPage(page, "foundations/typography", "hud-aa");

    const disabled = () =>
      page
        .locator(".nx-root")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--nx-fg-disabled").trim());

    const aa = await disabled();
    await setTheme(page, "hud");
    const hud = await disabled();

    expect(aa).not.toBe(hud);
    // primitive.ramp.grey-300 in each theme. The hud-aa value moved from
    // #6B7F61 when the contrast guard started asserting floors on the raised
    // surface as well as the panel; #6B7F61 was 4.25:1 there, under 1.4.3.
    expect(aa.toUpperCase()).toBe("#6F8465");
    expect(hud.toUpperCase()).toBe("#3D4C39");
  });
});

test.describe("token reference", () => {
  // These tables are taller than the scrolling <main> at the default 800px,
  // and an element screenshot is clipped to its scroll container, so the
  // rows below the fold would be captured as blank. A viewport tall enough
  // to hold the whole table is what makes the baseline cover every row.
  test.use({ viewport: { width: 1280, height: 2400 } });

  test("the palette table", async ({ page }) => {
    await gotoPage(page, "foundations/colour");
    await expect(spec(page, "Palette")).toHaveScreenshot("tokens-palette.png");
  });

  test("the text roles, graded in both themes", async ({ page }) => {
    await gotoPage(page, "foundations/colour");
    await expect(spec(page, "Text & icon roles")).toHaveScreenshot("tokens-text-roles.png");
  });

  test("the layer cards", async ({ page }) => {
    await gotoPage(page, "foundations/tokens");
    await expect(spec(page, "Layers")).toHaveScreenshot("tokens-layers.png");
  });

  test("the themes table", async ({ page }) => {
    await gotoPage(page, "foundations/tokens");
    await expect(spec(page, "Themes")).toHaveScreenshot("tokens-themes.png");
  });

  test("the AA comparison table", async ({ page }) => {
    await gotoPage(page, "foundations/tokens");
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
    await gotoPage(page, "components/button");
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
    await gotoPage(page, "components/panel");
    const panel = spec(page, "Panel").locator(".nx-panel").first();

    await expect(panel).toHaveCSS("padding-top", "12px");
    await restyle(page, "--nx-panel-padding: 3px;");
    await expect(panel).toHaveCSS("padding-top", "3px");
  });

  test("a component token override does not leak into the semantic layer", async ({ page }) => {
    // Component tokens are a layer below the semantic one: overriding a
    // button's border must not move --nx-border-default for anything else.
    await gotoPage(page, "components/button");
    await restyle(page, "--nx-btn-border: rgb(255, 0, 0);");
    const semantic = await page
      .locator(".nx-root")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--nx-border-default").trim());
    expect(semantic).not.toBe("rgb(255, 0, 0)");
  });
});

test.describe('Panel corners="none" suppression', () => {
  // Not a screenshot: the corner-tick variables default to transparent, so a
  // panel with the pseudo-element wrongly generated and one with it actually
  // suppressed render pixel-identical — a diff cannot tell them apart. That
  // is exactly how this bug shipped invisibly the first time. Only the
  // computed `content` value of the pseudo-element itself distinguishes
  // "generated, painting nothing" from "never generated", and jsdom does not
  // support pseudo-element computed styles at all, so this has to run here.
  test("no ::before pseudo-element is generated for a none-corners panel", async ({ page }) => {
    await gotoPage(page, "components/panel");
    const header = banner(page);
    await expect(header).toHaveAttribute("data-nx-corners", "none");
    const content = await header.evaluate((el) => getComputedStyle(el, "::before").content);
    expect(content).toBe("none");
  });

  test("a corners panel does generate the pseudo-element", async ({ page }) => {
    // The contrasting case, so the assertion above is known to be
    // discriminating rather than trivially true for every element.
    await gotoPage(page, "components/panel");
    const panel = spec(page, "Panel").locator(".nx-panel").first();
    await expect(panel).toHaveAttribute("data-nx-corners", "tl br");
    const content = await panel.evaluate((el) => getComputedStyle(el, "::before").content);
    expect(content).toBe('""');
  });
});

test.describe("Drawer stacking", () => {
  // Not a screenshot: the bug is which element is on top at a pixel, and the
  // answer is the same in every theme. Drawer is `position: fixed`; Panel is
  // `position: relative`. With the drawer on z-index 0 any positioned content
  // later in the document painted over it (and over its scrim), so a Drawer
  // rendered next to its trigger opened underneath the cards that followed.
  // The showcase no longer mounts a Drawer anywhere that would show it, so the
  // overlap is built here: a positioned panel appended after the drawer's
  // elements and sized to cover the whole viewport.

  const COVER = `
    position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
    margin: 0; pointer-events: auto;`;

  async function coverViewport(page: Page) {
    await page.evaluate((css) => {
      const drawer = document.querySelector(".nx-drawer");
      if (!drawer?.parentElement) throw new Error("no .nx-drawer to mount the cover after");
      const cover = document.createElement("div");
      cover.className = "nx-panel";
      cover.id = "stacking-cover";
      cover.setAttribute("style", css);
      // Last child of the drawer's parent: later in the DOM than both the
      // scrim and the dialog, which is exactly the order that used to win.
      drawer.parentElement.appendChild(cover);
    }, COVER);
  }

  /** What is painted at (x, y): the nearest component part, or the cover. */
  function topmostAt(page: Page, x: number, y: number) {
    return page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px!, py!);
        if (!el) return "none";
        if (el.closest("#stacking-cover")) return "cover";
        if (el.closest(".nx-drawer")) return "drawer";
        if (el.classList.contains("nx-drawer__scrim")) return "scrim";
        return el.tagName.toLowerCase();
      },
      [x, y],
    );
  }

  test("an open drawer and its scrim are above positioned content that follows them", async ({
    page,
  }) => {
    await gotoPage(page, "components/drawer");

    // Opened before the cover goes in: the cover is page content too, and
    // would sit over the trigger.
    await page.getByRole("button", { name: "Open drawer" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await coverViewport(page);

    // The drawer slides in over 220ms; poll rather than sleep so the check
    // runs against the settled position.
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        if (!box) return "no box";
        return topmostAt(page, box.x + box.width / 2, box.y + box.height / 2);
      }, "drawer should be topmost at its own centre")
      .toBe("drawer");

    // Left of the drawer there is only the scrim between the page and the
    // viewer. If the cover were above it, the page would be clickable through
    // the "modal".
    const box = (await dialog.boundingBox())!;
    expect(await topmostAt(page, box.x / 2, box.y + box.height / 2)).toBe("scrim");
  });

  test("a closed drawer does not intercept the page", async ({ page }) => {
    // The counterpart: the drawer has a real layer now, so closing it must
    // leave nothing on that layer that can catch a pointer.
    await gotoPage(page, "components/drawer");
    await coverViewport(page);
    const vp = page.viewportSize()!;
    expect(await topmostAt(page, vp.width - 20, vp.height / 2)).toBe("cover");
    expect(await topmostAt(page, 20, vp.height / 2)).toBe("cover");
  });

  test("Escape still closes the drawer and the cover is reachable again", async ({ page }) => {
    await gotoPage(page, "components/drawer");
    const opener = page.getByRole("button", { name: "Open drawer" });

    await opener.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await coverViewport(page);
    // Focus moved into the dialog and is held there.
    expect(await page.evaluate(() => !!document.activeElement?.closest(".nx-drawer"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(opener).toBeFocused();

    const vp = page.viewportSize()!;
    await expect.poll(() => topmostAt(page, vp.width - 20, vp.height / 2)).toBe("cover");
  });
});
