import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoPage } from "./harness.js";

/* ============================================================================
   Home's hero monitor (components/SignalMonitor.tsx).

   Its picture is Glitch Lab's shader pipeline on the frame clock, so the
   visual baselines mask it (homeMask). These cover what it does instead: the
   random channel and graph on load, the fault rotation, the room
   noise, and the controls it withdraws under reduced motion. None of that is
   text on the page, so the monitor reports it as data attributes.

   The animated cases wait out real faults (0.7–2 s each) on a software
   WebGL renderer, so they are marked slow: a full parallel run starves them.
   ========================================================================== */

const screen = (page: Page) => page.locator(".sc-monitor__screen");
const monitor = (page: Page) => page.locator(".sc-monitor");
const settled = (page: Page) =>
  expect(monitor(page)).toHaveAttribute("data-fault", "", { timeout: 10_000 });

// The baselines mask the picture, so this is what catches an engine that
// fails to start. The canvas alone is not enough: it is mounted before the
// context and the shaders are checked, and stays behind when either fails.
// Only a started engine sizes it to the screen (the monitor renders at 1×),
// and it has reported any failure by then.
test("the monitor mounts a canvas and shows no NO SIGNAL fault", async ({ page }) => {
  await gotoPage(page, "home");
  const canvas = page.locator(".sc-monitor__host canvas");
  await expect(canvas).toBeAttached();
  await expect
    .poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.height === el.clientHeight))
    .toBe(true);
  await expect(page.locator(".sc-monitor__fault")).toHaveCount(0);
});

test("each visit lands on a random channel, with a new graph", async ({ page }) => {
  // Under reduced motion the screen is a still, so this is cheap to repeat.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoPage(page, "home");
  const channels = new Set<string>();
  const seeds = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const channel = (await monitor(page).getAttribute("data-channel"))!;
    expect(["1", "2", "3"]).toContain(channel);
    await expect(screen(page)).toHaveAttribute("aria-label", new RegExp(`channel ${channel},`));
    channels.add(channel);
    seeds.add((await monitor(page).getAttribute("data-seed"))!);
    await page.reload();
  }
  // 14 loads of three equal choices all landing on one: about 1 in 2 million.
  expect(channels.size).toBeGreaterThan(1);
  expect(seeds.size).toBeGreaterThan(1);
  // There is no channel selector any more.
  await expect(page.getByRole("button", { name: /^CH\d/ })).toHaveCount(0);
});

test("Jolt rotates through its faults, one at a time", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await gotoPage(page, "home");
  const jolt = page.getByRole("button", { name: "Jolt" });

  // Two presses in one task, before React can re-render: only one fault runs,
  // and the ignored press does not use up the next one in the rotation.
  await jolt.evaluate((b: HTMLElement) => {
    b.click();
    b.click();
  });
  await expect(monitor(page)).toHaveAttribute("data-faults", "1");
  await expect(monitor(page)).toHaveAttribute("data-last-fault", "SCRUB");
  await settled(page);

  await jolt.click();
  await expect(monitor(page)).toHaveAttribute("data-last-fault", "INTERFERENCE");
  await settled(page);

  await jolt.click();
  await expect(monitor(page)).toHaveAttribute("data-last-fault", "DEGAUSS");
  await expect(monitor(page)).toHaveAttribute("data-faults", "3");
  expect(errors).toEqual([]);
});

test("the room comes up over the monitor, and Sound silences it", async ({ page }) => {
  // gotoPage has already pressed the header's Search button, so the page has
  // had the press browsers require before audio may start.
  await gotoPage(page, "home");
  const sound = page.getByRole("button", { name: "Sound" });
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(monitor(page)).toHaveAttribute("data-room", "off");

  await screen(page).hover();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
  await page.mouse.move(0, 0);
  await expect(monitor(page)).toHaveAttribute("data-room", "off");

  // Keyboard focus on the monitor's controls counts as being on it.
  await sound.focus();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
  await sound.press("Enter");
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect(monitor(page)).toHaveAttribute("data-room", "off");
});

test("a click on Sound or Jolt does not keep the room on once the pointer leaves", async ({
  page,
}) => {
  await gotoPage(page, "home");
  const jolt = page.getByRole("button", { name: "Jolt" });
  await jolt.click();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
  await expect(jolt).toBeFocused();
  // Out through the bottom edge, past the controls: the clicked button keeps
  // focus, but a pointer's focus is not presence.
  const box = (await monitor(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40);
  await expect(monitor(page)).toHaveAttribute("data-room", "off");
});

test("under reduced motion the screen is a still and the faults and sound are withdrawn", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoPage(page, "home");
  await expect(page.getByRole("button", { name: "Jolt" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sound" })).toHaveCount(0);
  await screen(page).hover();
  await expect(monitor(page)).toHaveAttribute("data-room", "off");
  await expect(monitor(page)).toHaveAttribute("data-faults", "0");
});

test("Tab from Sound to Jolt keeps the room on", async ({ page }) => {
  await gotoPage(page, "home");
  const sound = page.getByRole("button", { name: "Sound" });
  const jolt = page.getByRole("button", { name: "Jolt" });
  await sound.focus();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");

  // Record every value data-room takes from here on: focus passing between
  // the monitor's own buttons must not turn the room off, even for a render.
  await monitor(page).evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { roomSeen: string[] }).roomSeen = seen;
    new MutationObserver(() => seen.push(el.getAttribute("data-room") ?? "")).observe(el, {
      attributes: true,
      attributeFilter: ["data-room"],
    });
  });
  await page.keyboard.press("Tab");
  await expect(jolt).toBeFocused();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
  const seen = await page.evaluate(() => (window as unknown as { roomSeen: string[] }).roomSeen);
  expect(seen).toEqual([]);
});

test("the room comes up on the page's first press while the pointer is over the monitor", async ({
  page,
}) => {
  test.slow();
  // This case needs a page that has had no press yet, so audio is not yet
  // allowed. Playwright runs its own page scripts as user gestures, which
  // marks the page active before any press, so the browser's flag is
  // replaced with one that, like the real one, is set by a trusted
  // pointerdown or keydown and by nothing else.
  await page.addInitScript(() => {
    let hasBeenActive = false;
    const activate = (e: Event) => {
      if (e.isTrusted) hasBeenActive = true;
    };
    window.addEventListener("pointerdown", activate, true);
    window.addEventListener("keydown", activate, true);
    Object.defineProperty(Navigator.prototype, "userActivation", {
      configurable: true,
      get: () => ({ hasBeenActive, isActive: hasBeenActive }),
    });
  });
  // Not gotoPage either: that presses the header's Search button.
  await page.goto("/");
  await expect(page.locator(".sc-monitor__host canvas")).toBeAttached();
  await screen(page).hover();
  await expect(monitor(page)).toHaveAttribute("data-room", "off");

  // The press is what allows audio. The pointer has not moved off the
  // monitor, so the room comes up now rather than on the next hover.
  await page.getByRole("button", { name: "Jolt" }).click();
  await expect(monitor(page)).toHaveAttribute("data-faults", "1");
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
});

test("reduced motion takes effect when it is toggled on a page already open", async ({ page }) => {
  await gotoPage(page, "home");
  const jolt = page.getByRole("button", { name: "Jolt" });
  const sound = page.getByRole("button", { name: "Sound" });
  await expect(jolt).toBeVisible();
  await screen(page).hover();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(jolt).toHaveCount(0);
  await expect(sound).toHaveCount(0);
  await expect(monitor(page)).toHaveAttribute("data-room", "off");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(jolt).toBeVisible();
  await expect(sound).toBeVisible();
  await expect(monitor(page)).toHaveAttribute("data-room", "on");
});
