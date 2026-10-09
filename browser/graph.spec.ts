import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { runSiteAction, setTheme } from "./harness";

/* ============================================================================
   The graph canvas, in a real browser.

   Unit tests run the engine against a mocked WebGLRenderer, so nothing there
   ever compiles a shader. This file is where the GLSL meets a driver: a
   program that fails to compile or link draws nothing and only says so in the
   console, so the first test listens for exactly that.

   The rest pin the picture. Three things would normally make a WebGL
   screenshot drift between runs, and each is held still:

   - Layout: the showcase's sample data and the layout seed are both fixed
     (phase 2), so the same nodes land in the same places.
   - Time: Playwright's fake clock drives requestAnimationFrame and
     performance.now. It is paused before the page loads and advanced a fixed
     amount, so every frame sees the same timestamps on every run — flicker
     phase, packet positions and camera easing included.
   - Randomness that isn't seeded: the only source left is the glitch
     scheduler, and prefers-reduced-motion switches it off.
   ========================================================================== */

const T0 = new Date("2026-01-01T00:00:00Z");

/**
 * Enough simulated time for the solver to settle (alpha falls below its floor
 * after ~310 steps, about 5s) and the camera to land after it. Every simulated
 * frame really renders, in software inside the container, so this is also
 * most of the test's wall-clock time.
 */
const SETTLE_MS = 8_000;

/** Reads a value from the console's stats readout, e.g. "NODES" -> "200". */
async function statText(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const label = [...document.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent?.trim() === n,
    );
    return label?.nextElementSibling?.textContent?.trim() ?? "";
  }, name);
}
const stat = async (page: Page, name: string) => Number(await statText(page, name));

/** Opens the graph under a paused fake clock, then runs it forward. */
async function openGraphFrozen(page: Page) {
  await page.clock.install({ time: T0 });
  await page.clock.pauseAt(T0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/labs/graph");
  // The same header setup gotoPage does, minus its settle(): that waits on
  // requestAnimationFrame, which a paused clock never fires.
  const root = page.locator(".nx-root");
  if ((await root.getAttribute("data-nx-crt")) !== "off")
    await runSiteAction(page, "Turn the CRT layer off");
  await expect(root).toHaveAttribute("data-nx-crt", "off");
  await setTheme(page, "hud-aa");
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(SETTLE_MS);
}

/**
 * The suite's default is zero differing pixels. WebGL screenshots get a small
 * allowance: under a fully parallel run the software rasterizer in the
 * container occasionally rounds a handful of single pixels differently where
 * several live edges overlap in the additive pass (4 of ~528,000 when it was
 * first seen). Anything that actually moved — a node, an edge, a label, the
 * camera — differs by thousands.
 */
const WEBGL_SHOT = { maxDiffPixels: 50 };

/** The graph's section of the page: canvas, label overlay and floating panels. */
const graphArea = (page: Page) => page.locator("main");

test.describe("graph canvas", () => {
  // Simulated frames render for real, in software; see SETTLE_MS.
  // Under a fully parallel run the frozen-clock test, with three pictures,
  // has taken over two minutes.
  test.describe.configure({ timeout: 300_000 });

  test("compiles and links every WebGL program, and draws frames", async ({ page }) => {
    const problems: string[] = [];
    // Every error counts. Warnings count when they come from three or the
    // shader compiler: the software GL driver in the container also emits
    // performance notices ("GPU stall due to ReadPixels") that say nothing
    // about the code.
    page.on("console", (m) => {
      const text = m.text();
      if (m.type() === "error") problems.push(text);
      else if (m.type() === "warning" && /THREE|shader|program|GLSL/i.test(text))
        problems.push(text);
    });
    page.on("pageerror", (e) => problems.push(String(e)));

    await page.goto("/#/labs/graph");
    // The console's stats readout only fills in once frames are being drawn,
    // and DRAWN counts edges that survived to the edge pass.
    // Software rendering in the container is slow to its first stats tick.
    await expect.poll(() => stat(page, "NODES"), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(() => stat(page, "DRAWN"), { timeout: 30_000 }).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  // One settle, two pictures and two measurements: every simulated frame
  // renders in software, so the frozen-clock work shares a single page.
  test("at rest and with a node selected: pixels and edge contrast", async ({ page }, info) => {
    await page.setViewportSize({ width: 960, height: 600 });
    await openGraphFrozen(page);

    // Routing, dashes, gain and the direction pads, with nothing focused.
    await expect(graphArea(page)).toHaveScreenshot("graph-rest.png", WEBGL_SHOT);
    const resting = await ringContrast(page, await landmarkCentre(page));

    // The tiered neighbourhood and the additive live pass, framed clear of
    // the drawer that opens on the right.
    expect(await statText(page, "SOLVER")).toBe("LOCKED");
    await selectLandmark(page);
    // A click is a modal open: only a selection from the keyboard keeps the
    // drawer non-modal, and a click focuses the graph's root, not its target.
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await page.clock.runFor(2_000);
    // A click selects; it doesn't grab the node, so the settled layout stays
    // exactly where the reader left it.
    expect(await statText(page, "SOLVER")).toBe("LOCKED");
    await expect(graphArea(page)).toHaveScreenshot("graph-selected.png", WEBGL_SHOT);
    const live = await ringContrast(page, await landmarkCentre(page));

    // WCAG 1.4.11 asks 3:1 of graphics needed to understand content. Edges at
    // rest are deliberately quiet — the graph is read through the
    // neighbourhood of whatever you are on — so the bar applies to the live
    // tier: the edges touching the selected node. Measured on pixels after
    // the CRT composite, which is what a reader sees; resting is recorded.
    info.annotations.push(
      { type: "contrast-resting", description: resting.toFixed(2) },
      { type: "contrast-live", description: live.toFixed(2) },
    );
    expect(live).toBeGreaterThanOrEqual(3);

    // Keyboard focus: clear the selection, take focus into the graph and
    // browse one connection. The focus ring is drawn in the canvas, and the
    // connection Enter would follow stays bright while the node's other edges
    // step down a tier.
    await page.keyboard.press("Escape");
    await page.clock.runFor(500);
    await page.locator("[data-nx-graph-focus]").focus();
    await page.keyboard.press("ArrowRight");
    await page.clock.runFor(1_000);
    await expect(graphArea(page)).toHaveScreenshot("graph-keyboard.png", WEBGL_SHOT);
  });

  test("keyboard: one Tab stop in, connections spoken, follow, back, select", async ({ page }) => {
    await page.goto("/#/labs/graph");
    const graph = page.locator('[aria-roledescription="graph"]');
    const target = graph.locator("[data-nx-graph-focus]");
    const spoken = graph.locator("[aria-live]");
    await expect(graph).toHaveAttribute("role", "group");
    await expect(target).toHaveCount(1);

    const back = page.getByRole("button", { name: "Back", exact: true });
    await target.focus();
    await expect(back).toBeDisabled();
    await expect(spoken).toHaveText(
      /^Graph, \d+ nodes, \d+ connections in \d+ kinds\. .+ connections?/,
    );
    await expect(graph.getByText(/connections · ↑↓ direction/)).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(spoken).toHaveText(/\. 1 of \d+, strongest/);
    const label = await target.getAttribute("aria-label");
    await page.keyboard.press("Enter");
    await expect(target).not.toHaveAttribute("aria-label", label!);
    // Following a connection is history without a selection; Back sees it.
    await expect(back).toBeEnabled();
    await page.keyboard.press("Backspace");
    await expect(spoken).toHaveText(/^Back to /);
    await expect(target).toHaveAttribute("aria-label", label!);
    await expect(back).toBeDisabled();

    await page.keyboard.press(" ");
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");
    // Selecting must not pull keyboard focus out of the graph.
    await expect(target).toBeFocused();

    // One Tab stop: the next Tab leaves the graph altogether.
    await page.keyboard.press("Tab");
    await expect(target).not.toBeFocused();
    expect(await graph.evaluate((g) => g.contains(document.activeElement))).toBe(false);
  });

  test("stepping out of the graph with Escape keeps an isolation", async ({ page }) => {
    await page.goto("/#/labs/graph");
    const graph = page.locator('[aria-roledescription="graph"]');
    const target = graph.locator("[data-nx-graph-focus]");
    await target.focus();
    await page.keyboard.press(" ");
    await page.getByRole("dialog").getByRole("button", { name: "Isolate" }).click();
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toContain("/");

    // Deselect, then leave: both are the graph's own Escape, and neither is
    // the page's "reset the view".
    await target.focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(graph).toBeFocused();
    // Back in, the summary counts what is drawn, at once (the stats panel only
    // ticks every half second of frames): still the isolated few, not all 200.
    await target.focus();
    const summary = await graph.locator("[aria-live]").textContent();
    const shown = Number(/^Graph, (\d+) nodes/.exec(summary ?? "")?.[1]);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(200);
  });

  test("an Escape that only dismisses the tooltip is marked as handled", async ({ page }) => {
    await page.goto("/#/labs/graph");
    // Hover needs a node that stays put under the pointer.
    await expect.poll(() => statText(page, "SOLVER"), { timeout: 60_000 }).toBe("LOCKED");
    const c = await landmarkCentre(page);
    await page.mouse.move(c.x, c.y);
    const tipOpacity = () =>
      page.evaluate(() => {
        const tip = [...document.querySelectorAll<HTMLElement>("div")].find(
          (el) => el.style.maxWidth === "270px",
        );
        return tip?.style.opacity ?? "";
      });
    await expect.poll(tipOpacity).toBe("1");

    // Listening after the graph's own window listener, so it sees the verdict.
    await page.evaluate(() => {
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") document.body.dataset["escHandled"] = String(e.defaultPrevented);
      });
    });
    await page.keyboard.press("Escape");
    await expect.poll(tipOpacity).toBe("0");
    await expect(page.locator("body")).toHaveAttribute("data-esc-handled", "true");
  });

  test("Back keeps focus when it runs out of history", async ({ page }) => {
    await page.goto("/#/labs/graph");
    const target = page.locator('[aria-roledescription="graph"] [data-nx-graph-focus]');
    const back = page.getByRole("button", { name: "Back", exact: true });
    await target.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(back).toBeEnabled();
    await back.focus();
    await page.keyboard.press("Enter");
    // aria-disabled, so the button that just ran out keeps focus.
    await expect(back).toBeDisabled();
    await expect(back).toBeFocused();
  });

  test("Escape steps out of the graph, and the next Tab moves on past it", async ({ page }) => {
    await page.goto("/#/labs/graph");
    const graph = page.locator('[aria-roledescription="graph"]');
    await graph.locator("[data-nx-graph-focus]").focus();
    await page.keyboard.press("Escape");
    await expect(graph).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await graph.evaluate((g) => g.contains(document.activeElement))).toBe(false);
  });

  test("view as list: the outline follows the graph, and selects in it", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await page.getByRole("button", { name: "View as list" }).click();
    const outline = page.getByRole("region", { name: "Sample graph as a list" });
    await expect(outline).toBeVisible();
    await expect(
      outline.getByText(/^Graph, 200 nodes, \d+ connections in \d+ kinds\.$/),
    ).toBeVisible();
    await expect(outline.getByRole("heading", { level: 3 }).first()).toBeVisible();

    await outline.locator("summary").first().click();
    await outline.getByRole("button", { name: "Select in graph" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(outline.getByText("Selected in graph")).toBeVisible();

    await page.getByRole("button", { name: "View as graph" }).click();
    await expect(outline).toBeHidden();
  });
});

/** Screen centre of the first landmark ("//ATLAS") node, found from its label. */
async function landmarkCentre(page: Page): Promise<{ x: number; y: number }> {
  const label = page.getByText(/\/\/ATLAS$/).first();
  const box = await label.boundingBox();
  if (!box) throw new Error("no landmark label on screen");
  // Labels sit 8px right of the glyph's edge; landmarks are ~6–10px in radius.
  return { x: box.x - 14, y: box.y + box.height / 2 };
}

async function selectLandmark(page: Page) {
  const c = await landmarkCentre(page);
  await page.mouse.click(c.x, c.y);
  await expect(page.getByRole("dialog")).toBeVisible();
}

/**
 * Contrast between the brightest edge pixels in a ring around a node and the
 * canvas behind them: the 98th-percentile luminance in the ring (where the
 * incident edges cross it) against the median (the ground), as a WCAG ratio.
 */
async function ringContrast(page: Page, c: { x: number; y: number }): Promise<number> {
  const png = await page.screenshot();
  return page.evaluate(
    async ({ b64, cx, cy }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum: number[] = [];
      for (let r = 22; r <= 46; r += 2) {
        for (let k = 0; k < 180; k++) {
          const a = (k / 180) * Math.PI * 2;
          const x = Math.round((cx + Math.cos(a) * r) * scale);
          const y = Math.round((cy + Math.sin(a) * r) * scale);
          const [R, G, B] = g.getImageData(x, y, 1, 1).data;
          lum.push(0.2126 * lin(R!) + 0.7152 * lin(G!) + 0.0722 * lin(B!));
        }
      }
      lum.sort((p, q) => p - q);
      const ground = lum[Math.floor(lum.length * 0.5)]!;
      const edge = lum[Math.floor(lum.length * 0.98)]!;
      return (edge + 0.05) / (ground + 0.05);
    },
    { b64: png.toString("base64"), cx: c.x, cy: c.y },
  );
}
