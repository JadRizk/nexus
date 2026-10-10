import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { runSiteAction, setTheme } from "./harness";

// Screenshots stay stable because the layout is seeded, a paused fake clock drives every frame,
// and reduced motion switches off the only unseeded randomness (the glitch scheduler).

const T0 = new Date("2026-01-01T00:00:00Z");

/** Simulated time for the solver to settle (~310 steps, about 5s) and the camera to land. */
const SETTLE_MS = 8_000;

/** Reads a value from the console's stats readout, e.g. "NODES" -> "60". */
async function statText(page: Page, name: string): Promise<string> {
  return page.evaluate((labelText) => {
    const label = [...document.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent?.trim() === labelText,
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
  // gotoPage's setup minus settle(), which waits on a frame a paused clock never fires.
  const root = page.locator(".nx-root");
  if ((await root.getAttribute("data-nx-crt")) !== "off")
    await runSiteAction(page, "Turn the CRT layer off");
  await expect(root).toHaveAttribute("data-nx-crt", "off");
  await setTheme(page, "hud-aa");
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(SETTLE_MS);
}

/** Software rasterizing flips a few additive pixels under load; a real move changes thousands. */
const WEBGL_SHOT = { maxDiffPixels: 50 };

const graphArea = (page: Page) => page.locator("main");

test.describe("graph canvas", () => {
  // Every simulated frame renders in software; the frozen-clock test has taken over two minutes.
  test.describe.configure({ timeout: 300_000 });

  test("compiles and links every WebGL program, and draws frames", async ({ page }) => {
    const problems: string[] = [];
    // Only shader warnings count: the software GL driver also emits unrelated performance notices.
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error") problems.push(text);
      else if (message.type() === "warning" && /THREE|shader|program|GLSL/i.test(text))
        problems.push(text);
    });
    page.on("pageerror", (error) => problems.push(String(error)));

    await page.goto("/#/labs/graph");
    await expect.poll(() => stat(page, "NODES"), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect.poll(() => stat(page, "DRAWN"), { timeout: 30_000 }).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  test("at rest and with a node selected: pixels and edge contrast", async ({ page }, info) => {
    await page.setViewportSize({ width: 960, height: 600 });
    await openGraphFrozen(page);

    await expect(graphArea(page)).toHaveScreenshot("graph-rest.png", WEBGL_SHOT);
    const resting = await ringContrast(page, await landmarkCentre(page));

    expect(await statText(page, "SOLVER")).toBe("LOCKED");
    await selectLandmark(page);
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    await page.clock.runFor(2_000);
    expect(await statText(page, "SOLVER")).toBe("LOCKED");
    await expect(graphArea(page)).toHaveScreenshot("graph-selected.png", WEBGL_SHOT);
    const live = await ringContrast(page, await landmarkCentre(page));

    // WCAG 1.4.11's 3:1 applies to the live tier; resting edges are quiet by design.
    info.annotations.push(
      { type: "contrast-resting", description: resting.toFixed(2) },
      { type: "contrast-live", description: live.toFixed(2) },
    );
    expect(live).toBeGreaterThanOrEqual(3);

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
    if (label === null) throw new Error("the focus target has no aria-label");
    await page.keyboard.press("Enter");
    await expect(target).not.toHaveAttribute("aria-label", label);
    await expect(back).toBeEnabled();
    await page.keyboard.press("Backspace");
    await expect(spoken).toHaveText(/^Back to /);
    await expect(target).toHaveAttribute("aria-label", label);
    await expect(back).toBeDisabled();

    await page.keyboard.press(" ");
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toHaveAttribute("aria-modal", "true");
    await expect(target).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(target).not.toBeFocused();
    expect(await graph.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  });

  test("stepping out of the graph with Escape keeps an isolation", async ({ page }) => {
    await page.goto("/#/labs/graph");
    const graph = page.locator('[aria-roledescription="graph"]');
    const target = graph.locator("[data-nx-graph-focus]");
    await target.focus();
    await page.keyboard.press(" ");
    await page.getByRole("dialog").getByRole("button", { name: "Isolate" }).click();
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toContain("/");

    await target.focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(graph).toBeFocused();
    // The stats panel lags by half a second; the summary counts what is drawn at once.
    await target.focus();
    const summary = await graph.locator("[aria-live]").textContent();
    const shown = Number(/^Graph, (\d+) nodes/.exec(summary ?? "")?.[1]);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(60);
  });

  test("an Escape that only dismisses the tooltip is marked as handled", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await expect.poll(() => statText(page, "SOLVER"), { timeout: 60_000 }).toBe("LOCKED");
    const centre = await landmarkCentre(page);
    await page.mouse.move(centre.x, centre.y);
    const tipOpacity = () =>
      page.evaluate(() => {
        const tip = [...document.querySelectorAll<HTMLElement>("div")].find(
          (el) => el.style.maxWidth === "270px",
        );
        return tip?.style.opacity ?? "";
      });
    await expect.poll(tipOpacity).toBe("1");

    // Registered after the graph's own window listener, so it sees the verdict.
    await page.evaluate(() => {
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape")
          document.body.dataset["escHandled"] = String(event.defaultPrevented);
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
    expect(await graph.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  });

  test("view as list: the outline follows the graph, and selects in it", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await page.getByRole("button", { name: "View as list" }).click();
    const outline = page.getByRole("region", { name: "Sample graph as a list" });
    await expect(outline).toBeVisible();
    await expect(
      outline.getByText(/^Graph, 60 nodes, \d+ connections in \d+ kinds\.$/),
    ).toBeVisible();
    await expect(outline.getByRole("heading", { level: 3 }).first()).toBeVisible();

    await outline.locator("summary").first().click();
    await outline.getByRole("button", { name: "Select in graph" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(outline.getByText("Selected in graph")).toBeVisible();

    await page.getByRole("button", { name: "View as graph" }).click();
    await expect(outline).toBeHidden();
  });

  test("changing the corpus size clears the selection and updates NODES", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await selectFromKeyboard(page);
    await page.getByRole("tab", { name: "Solver" }).click();
    await page.getByLabel("corpus size").fill("120");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toBe("120");
  });

  test("Reseed clears the selection", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await selectFromKeyboard(page);
    await page.getByRole("button", { name: "Reseed" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("turning a legend category off hides its nodes", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toBe("60");
    const firstEntityClass = page.getByRole("checkbox").first();
    // The checkbox is visually hidden; its label row is what takes the click.
    await firstEntityClass.uncheck({ force: true });
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toMatch(/^\d+\/60$/);
    await firstEntityClass.check({ force: true });
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toBe("60");
  });

  test("Halt stops the solver and Run resumes it", async ({ page }) => {
    await openGraphFrozen(page);
    expect(await statText(page, "SOLVER")).toBe("LOCKED");

    await page.getByRole("button", { name: "Halt" }).click();
    await page.getByRole("button", { name: "Reheat" }).click();
    await page.clock.runFor(SETTLE_MS);
    expect(await statText(page, "SOLVER")).toBe("COOLING");

    await page.getByRole("button", { name: "Run" }).click();
    await page.clock.runFor(SETTLE_MS);
    expect(await statText(page, "SOLVER")).toBe("LOCKED");
  });

  test("Escape on the page clears the selection and the isolation", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await selectFromKeyboard(page);
    await page.getByRole("dialog").getByRole("button", { name: "Isolate" }).click();
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toContain("/");

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toBe("60");
  });

  test("going to a neighbour while isolated moves the isolation to it", async ({ page }) => {
    await page.goto("/#/labs/graph");
    await selectFromKeyboard(page);
    const drawer = page.getByRole("dialog");
    const isolate = drawer.getByRole("button", { name: "Isolate" });
    await isolate.click();
    await expect(isolate).toHaveAttribute("aria-pressed", "true");
    const title = page.locator(`[id="${await drawer.getAttribute("aria-labelledby")}"]`);
    const before = (await title.textContent()) ?? "";

    await drawer
      .getByRole("button", { name: /[A-Z]{3}$/ })
      .first()
      .click();
    await expect(title).not.toHaveText(before);
    await expect(isolate).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => statText(page, "NODES"), { timeout: 30_000 }).toContain("/");
  });
});

/** Selects the node the graph's focus target starts on, as a keyboard user would. */
async function selectFromKeyboard(page: Page) {
  await page.locator('[aria-roledescription="graph"] [data-nx-graph-focus]').focus();
  await page.keyboard.press(" ");
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function landmarkCentre(page: Page): Promise<{ x: number; y: number }> {
  const label = page.getByText(/\/\/ATLAS$/).first();
  const box = await label.boundingBox();
  if (!box) throw new Error("no landmark label on screen");
  // Labels sit 8px right of the glyph's edge; landmarks are ~6–10px in radius.
  return { x: box.x - 14, y: box.y + box.height / 2 };
}

async function selectLandmark(page: Page) {
  const centre = await landmarkCentre(page);
  await page.mouse.click(centre.x, centre.y);
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** WCAG ratio of a node's ring: 98th-percentile luminance (its edges) to the median (ground). */
async function ringContrast(page: Page, centre: { x: number; y: number }): Promise<number> {
  const png = await page.screenshot();
  return page.evaluate(
    async ({ base64, cx, cy }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2D canvas context");
      context.drawImage(image, 0, 0);
      const scale = image.width / window.innerWidth;
      const toLinear = (channel: number) => {
        const srgb = channel / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      };
      const luminances: number[] = [];
      for (let radius = 22; radius <= 46; radius += 2) {
        for (let k = 0; k < 180; k++) {
          const angle = (k / 180) * Math.PI * 2;
          const x = Math.round((cx + Math.cos(angle) * radius) * scale);
          const y = Math.round((cy + Math.sin(angle) * radius) * scale);
          const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
          luminances.push(
            0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue),
          );
        }
      }
      luminances.sort((low, high) => low - high);
      const ground = luminances[Math.floor(luminances.length * 0.5)];
      const edge = luminances[Math.floor(luminances.length * 0.98)];
      return (edge + 0.05) / (ground + 0.05);
    },
    { base64: png.toString("base64"), cx: centre.x, cy: centre.y },
  );
}
