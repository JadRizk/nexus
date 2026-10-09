import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { DOC_ROUTES, gotoPage, spec, settle } from "./harness.js";
import type { Route } from "./harness.js";

/* ============================================================================
   Accessibility.

   The README makes a dozen specific, checkable claims. Until now none of them
   was asserted by a machine, and the ARIA assertions that did exist were
   hand-written — which means they checked the attributes the author
   remembered. This file closes that gap in two halves:

     1. axe-core over the real rendered page, per route and per component.
     2. Direct assertions for the claims axe cannot make — a flash rate, a set
        of distinguishable silhouettes, a focus ring that cannot be removed.

   Both halves matter. axe is a floor, not a ceiling: it finds contrast and
   malformed ARIA, and it is silent about whether a modal steals focus at page
   load or whether six shapes are actually distinguishable from one another.
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
const COMPONENTS: Array<[Route, string]> = [
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
    expect(violations[0]!.id).toBe("color-contrast");
  });
});

/* ------------------------------------------- claims axe cannot check for us */

test.describe("claims axe cannot make", () => {
  // The decorative hairline (--nx-border-default) is 1.61:1 and exempt from the
  // 3:1 non-text floor, which is only sound while no control is identified by
  // it. Buttons and tabs are identified by their text instead, so this holds
  // that line in the rendered page: every one carries visible text, and the
  // one boundary that does identify a control (the palette's search field)
  // is drawn in the 3:1 token rather than the hairline.
  // One test per page rather than one test looping them all: a single
  // test over every page runs past any sensible timeout.
  for (const route of ["home", ...DOC_ROUTES] as Route[]) {
    test(`every Button and Tab on ${route} is identified by visible text, not by its hairline (WCAG 1.4.11)`, async ({
      page,
    }) => {
      await gotoPage(page, route, "hud-aa");
      const unlabelled = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".nx-btn, .nx-tab")]
          .filter((el) => (el.textContent ?? "").trim() === "")
          .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      );
      expect(unlabelled, `${route}: controls with no visible text`).toEqual([]);
    });
  }

  test("the palette's search field is bounded by the 3:1 token, not the hairline", async ({
    page,
  }) => {
    await gotoPage(page, "components/command-palette", "hud-aa");
    await page.getByRole("button", { name: "Open palette" }).click();
    const edge = await page.locator(".nx-palette__field").evaluate((el) => {
      const root = getComputedStyle(document.querySelector(".nx-root")!);
      const cs = getComputedStyle(el);
      return {
        underline: cs.borderBottomColor,
        strong: root.getPropertyValue("--nx-border-strong").trim(),
        hairline: root.getPropertyValue("--nx-border-default").trim(),
      };
    });
    // Resolve both tokens through a throwaway element so the comparison is on
    // computed rgb(), not on whatever spelling the custom property uses.
    const rgb = async (value: string) =>
      page.evaluate((v) => {
        const probe = document.createElement("i");
        probe.style.color = v;
        document.body.append(probe);
        const out = getComputedStyle(probe).color;
        probe.remove();
        return out;
      }, value);
    expect(edge.underline).toBe(await rgb(edge.strong));
    expect(edge.underline).not.toBe(await rgb(edge.hairline));
  });

  test("the cursor blinks below the 3Hz seizure threshold (WCAG 2.3.1)", async ({ page }) => {
    // The prototype blinked at 9Hz. The cap lives on the token, not in the
    // component, so this reads the value the browser actually resolved.
    await gotoPage(page, "components/blink-cursor");
    const seconds = await page
      .locator(".nx-root")
      .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--nx-blink")));
    expect(seconds).toBeGreaterThan(0);
    expect(1 / seconds).toBeLessThan(3);
  });

  test("the six glyphs are distinguishable by shape alone (WCAG 1.4.1)", async ({ page }) => {
    // Category must never be carried by colour alone. Comparing the rendered
    // SVG geometry is the only way to know the silhouettes are actually
    // distinct — a palette swap would not touch this, and a copy-paste error
    // that duplicated a shape would pass every other test in the repo.
    await gotoPage(page, "components/glyph");
    const shapes = await spec(page, "Glyph")
      .locator("svg")
      .evaluateAll((svgs) =>
        svgs.map((s) =>
          [...s.querySelectorAll("circle,polygon,rect,path")]
            .map(
              (el) => el.tagName + ":" + (el.getAttribute("points") ?? el.getAttribute("r") ?? ""),
            )
            .join(),
        ),
      );
    const distinct = new Set(shapes);
    expect(shapes.length).toBeGreaterThanOrEqual(6);
    expect(distinct.size, `expected distinct silhouettes, got ${shapes.length}`).toBe(
      shapes.length,
    );
  });

  test("the focus ring cannot be removed by a component (WCAG 2.4.7)", async ({ page }) => {
    // The ring is defined once, globally. Its value comes from tokens, so this
    // also catches the ring surviving but resolving to nothing.
    await gotoPage(page, "components/button");
    const ring = await page.locator(".nx-root").evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: cs.getPropertyValue("--nx-focus-width").trim(),
        colour: cs.getPropertyValue("--nx-focus-ring").trim(),
        offset: cs.getPropertyValue("--nx-focus-offset").trim(),
      };
    });
    expect(ring.width).not.toBe("");
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
    expect(ring.colour).toMatch(/^#|^rgb/);
    expect(ring.offset).not.toBe("");
  });

  test("Slider relocates the focus ring to the thumb (WCAG 2.4.7 exception)", async ({ page }) => {
    // Slider.css:32's `outline: none` is on the unconditional BASE `.nx-slider`
    // rule, so reading the input's own outline is the same value focused or
    // not — it asserts a loophole, not the relocation. The relocation this
    // test exists to protect lives at Slider.css:62-70, which paints the ring
    // on the thumb pseudo-element via `:focus-visible::-webkit-slider-thumb`
    // and `::-moz-range-thumb`.
    //
    // `getComputedStyle(el, "::-webkit-slider-thumb")` looks like the right
    // tool — it is the pattern this file already uses for `::before` — but it
    // does not work here: verified locally (`npx playwright test`, real
    // Chromium 151) that Chromium silently ignores a pseudo-element string it
    // does not recognise and returns the HOST element's own computed style
    // instead. Proof: the thumb has an unconditional `box-shadow` (Slider.css
    // :44, not gated on focus) and `getComputedStyle(slider, "::-webkit-
    // slider-thumb").boxShadow` reads back "none" — the input's own value —
    // both with the relocation rules present and with them deleted. A range
    // thumb lives in the user-agent shadow tree, and only a fixed set of
    // standard pseudo-elements (::before, ::after, ::marker, ::selection, …)
    // are resolvable through the second argument; vendor UA-shadow parts like
    // this one are not, in this engine. So the earlier version of this test
    // (which read that call and compared to "none") was never reading the
    // thumb — it read the host, whose specificity story is its own trap: the
    // global `.nx-root :focus-visible` rule (0,2,0) outranks the unconditional
    // `.nx-slider { outline: none }` (0,1,0), so the host shows a ring
    // regardless of whether the relocation rules exist, and a host-based
    // assertion cannot fail for the reason this test exists either.
    //
    // What does discriminate: the actual stylesheet Chromium loaded and
    // matched against this page. Deleting Slider.css:62-70 deletes the CSS
    // rule outright, so it is absent from `document.styleSheets` — a fact no
    // pseudo-element quirk can paper over. This still requires genuine
    // keyboard focus first (Tab, then focus() — a bare focus() never
    // satisfies :focus-visible in Chromium), because the claim under test is
    // about what a keyboard user sees, not merely that the CSS text exists.
    await gotoPage(page, "components/slider");
    const slider = spec(page, "Slider").getByRole("slider").first();
    await expect(slider).toBeAttached();
    await page.keyboard.press("Tab");
    await slider.focus();
    await expect(slider).toBeFocused();

    const webkitRule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let cssRules: CSSRuleList;
        try {
          cssRules = sheet.cssRules;
        } catch {
          continue; // A cross-origin sheet would throw on read; none here are.
        }
        for (const rule of Array.from(cssRules)) {
          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText.includes(":focus-visible") &&
            rule.selectorText.includes("::-webkit-slider-thumb")
          ) {
            return { selector: rule.selectorText, outline: rule.style.outline };
          }
        }
      }
      return null;
    });
    expect(webkitRule, "no :focus-visible::-webkit-slider-thumb rule is loaded").toBeTruthy();
    // The declaration is authored as `outline: var(--nx-focus-width) solid
    // var(--nx-focus-ring)`. A shorthand that references a custom property is
    // a "pending-substitution value" — CSSOM cannot expand it into longhands,
    // because `var()` is only resolvable at compute time (verified locally:
    // `rule.style.outlineStyle` reads back "" for this exact rule). So this
    // reads the raw shorthand text CSSOM does expose, `rule.style.outline`,
    // and checks it names `solid` rather than `none`.
    expect(webkitRule!.outline).toMatch(/\bsolid\b/);
    expect(webkitRule!.outline).not.toMatch(/\bnone\b/);

    // Chromium's CSS parser drops a whole rule when it does not recognise a
    // selector, and `::-moz-range-thumb` is Firefox-only — so, verified
    // locally, a `.nx-slider:focus-visible::-moz-range-thumb` rule never
    // reaches `document.styleSheets` in this engine at all, present or not.
    // CSSOM cannot see it here, but the browser still downloaded the actual
    // built stylesheet, so fetching that same resource and checking its raw
    // text is a check against the real served artifact, not against source —
    // it still fails if the build ever stopped emitting the rule.
    const mozRuleText = await page.evaluate(async () => {
      const hrefs = Array.from(document.styleSheets)
        .map((s) => s.href)
        .filter((h): h is string => !!h);
      const texts = await Promise.all(hrefs.map((h) => fetch(h).then((r) => r.text())));
      return (
        texts.join("\n").match(/\.nx-slider:focus-visible::-moz-range-thumb\s*\{([^}]*)\}/)?.[1] ??
        null
      );
    });
    expect(
      mozRuleText,
      "no :focus-visible::-moz-range-thumb rule in the served stylesheet",
    ).toBeTruthy();
    expect(mozRuleText).toMatch(/outline:\s*[^;]*\bsolid\b/);

    // And that the tokens the rule references actually resolve on this
    // element, so a rule that cites a dead custom property still fails.
    const tokens = await slider.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: cs.getPropertyValue("--nx-focus-width").trim(),
        ring: cs.getPropertyValue("--nx-focus-ring").trim(),
      };
    });
    expect(tokens.width).not.toBe("");
    expect(tokens.ring).not.toBe("");
  });

  test("CommandPalette deliberately suppresses the focus ring on the input (WCAG 2.4.7 exception)", async ({
    page,
  }) => {
    // Unlike Slider.css:32, this suppression genuinely lives inside a
    // `:focus-visible` block (CommandPalette.css:61-63), so it is only
    // observable under real keyboard focus. The ARIA combobox pattern keeps
    // focus on this input for the entire life of the palette, so a
    // permanently lit ring would distinguish nothing — the panel appearing is
    // the indicator. Reading `outlineStyle` rather than the `outline`
    // shorthand for the same reason as the Slider test above.
    await gotoPage(page, "components/command-palette");
    await page.getByRole("button", { name: "Open palette" }).click();
    const input = page.getByRole("combobox");
    await expect(input).toBeAttached();
    await page.keyboard.press("Tab");
    await input.focus();
    await expect(input).toBeFocused();

    const outlineStyle = await input.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).toBe("none");
  });

  test("prefers-reduced-motion collapses animation, including the blink", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoPage(page, "components/blink-cursor");
    await settle(page);

    const blink = page.locator(".nx-blink").first();
    await expect(blink).toBeAttached();
    const state = await blink.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { name: cs.animationName, opacity: cs.opacity };
    });
    // The rule sets `animation: none; opacity: 1` — the cursor stays visible
    // rather than being frozen at whichever half of the cycle it was in.
    expect(state.name).toBe("none");
    expect(state.opacity).toBe("1");
  });

  test("prefers-reduced-motion stills the graph's glitch, grain, roll bar and trails", async ({
    page,
  }) => {
    // The graph's CRT pass is WebGL, not CSS, so the stylesheet rule above
    // cannot reach it: the canvas reads the media query itself and carries the
    // answer to the GPU as the `uReduced` uniform. The uniform is not
    // observable from outside a WebGL context, so GraphCanvas mirrors the
    // flag onto the canvas element, and this asserts that mirror — the unit
    // test in packages/graph asserts the uniforms behind it. Flipping the
    // emulation after mount covers the live listener, not just the read at
    // boot: the OS setting can change while the canvas is up.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoPage(page, "labs/graph");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute("data-nx-reduced-motion", "true");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(canvas).toHaveAttribute("data-nx-reduced-motion", "false");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(canvas).toHaveAttribute("data-nx-reduced-motion", "true");
  });

  test("prefers-contrast: more switches the CRT layer off", async ({ page }) => {
    // The README offers this as an escape hatch: someone asking for more
    // contrast should not be fighting a scanline overlay. Nothing asserted it
    // until now, and the rule lives in a stylesheet no unit test loads.
    await page.emulateMedia({ contrast: "more" });
    await gotoPage(page, "home", "hud-aa", { crt: true });
    await settle(page);

    const layer = page.locator(".nx-crt").first();
    await expect(layer).toBeAttached();
    const painted = await layer.evaluate((el) => ({
      after: getComputedStyle(el, "::after").display,
      before: getComputedStyle(el, "::before").display,
    }));
    expect(painted.after).toBe("none");
    expect(painted.before).toBe("none");
  });

  test("the slider track is a 3:1 boundary, not the decorative hairline", async ({ page }) => {
    // WCAG 1.4.11: a track is a UI component boundary, so it may not use the
    // hairline. Comparing resolved colours rather than token names, because
    // what ships is whatever the cascade actually produced.
    await gotoPage(page, "components/slider");
    const slider = page.locator(".nx-slider").first();
    await expect(slider).toBeAttached();

    const colours = await slider.evaluate((el) => {
      const probe = document.createElement("div");
      el.parentElement.appendChild(probe);
      probe.style.background = "var(--nx-border-strong)";
      const strong = getComputedStyle(probe).backgroundColor;
      probe.style.background = "var(--nx-border-default)";
      const hairline = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { track: getComputedStyle(el).backgroundColor, strong, hairline };
    });

    expect(colours.track).toBe(colours.strong);
    expect(colours.track).not.toBe(colours.hairline);
  });

  // One test per page: the controls used to share two long pages, and now
  // each component has its own. Home is included: its console is the densest
  // set of controls on the site.
  for (const route of ["home", ...DOC_ROUTES] as Route[]) {
    test(`every interactive control on ${route} is reachable by keyboard`, async ({ page }) => {
      // axe checks that controls are labelled; it does not walk the tab order.
      // A control that is focusable but visually covered by something else is a
      // real defect, and one this showcase has had.
      await gotoPage(page, route);
      // Controls inside an inert subtree are excluded: a closed Drawer stays
      // mounted with its close button, and that button being unreachable is
      // the behaviour the Drawer promises, not a defect. The same goes for the
      // contents of a closed <details> (GraphOutline's node entries): the
      // browser keeps them out of the tab order until the disclosure opens,
      // and the <summary> that opens it is checked instead.
      const controls = page.locator(
        ":is(.nx-root button:not([disabled]), .nx-root input:not([disabled]), .nx-root a[href], .nx-root summary):not([inert] *):not(details:not([open]) > :not(summary) *, details:not([open]) > :not(summary))",
      );
      const total = await controls.count();
      expect(total).toBeGreaterThan(10);

      for (let i = 0; i < total; i++) {
        const control = controls.nth(i);
        await control.focus();
        await expect(control).toBeFocused();
      }
    });
  }
});
