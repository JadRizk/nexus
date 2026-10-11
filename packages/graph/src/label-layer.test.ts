/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLabelLayer, LABEL_POOL_SIZE } from "./label-layer.js";

let labelEl: HTMLDivElement;
let releases: (() => void)[];
beforeEach(() => {
  // jsdom has no 2D context; the placer only measures when it places.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  labelEl = document.createElement("div");
  releases = [];
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("appends the label pool, then the tooltip last so it paints over them", () => {
  const { labels, tooltip } = createLabelLayer(labelEl, (release) => releases.push(release));
  expect(labels).toHaveLength(LABEL_POOL_SIZE);
  expect([...labelEl.children]).toEqual([...labels, tooltip]);
  for (const child of labelEl.children) expect(child.getAttribute("aria-hidden")).toBe("true");
});

it("starts with every pooled label free", () => {
  const { owner } = createLabelLayer(labelEl, () => {});
  expect(owner).toHaveLength(LABEL_POOL_SIZE);
  expect(owner.every((index) => index === -1)).toBe(true);
});

it("tracks the labels' removal, then the tooltip's", () => {
  const { tooltip } = createLabelLayer(labelEl, (release) => releases.push(release));
  expect(releases).toHaveLength(2);
  releases[0]?.();
  expect([...labelEl.children]).toEqual([tooltip]);
  releases[1]?.();
  expect(labelEl.childElementCount).toBe(0);
});
