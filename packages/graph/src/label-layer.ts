import { createLabelPlacer } from "./labels.js";
import type { LabelPlacer } from "./labels.js";
import type { Track } from "./scene.js";

export const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

/** How many node labels can show at once. */
export const LABEL_POOL_SIZE = 60;
const LABEL_HEIGHT = 11;

export interface LabelLayer {
  /** `LABEL_POOL_SIZE` reusable label elements, in DOM order. */
  labels: HTMLDivElement[];
  /** The node index each pooled label shows; -1 when free. */
  owner: Int32Array;
  labelPlacer: LabelPlacer;
  tooltip: HTMLDivElement;
}

function createLabelPool(labelEl: HTMLElement): HTMLDivElement[] {
  const labels: HTMLDivElement[] = [];
  for (let i = 0; i < LABEL_POOL_SIZE; i++) {
    const label = document.createElement("div");
    label.style.cssText =
      "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;" +
      `font:600 9.5px/1 ${MONO};letter-spacing:.09em;text-transform:uppercase;` +
      "text-shadow:1px 0 rgba(255,46,99,.4),-1px 0 rgba(23,226,229,.4),0 0 7px rgba(0,0,0,.98);" +
      "transform:translate3d(-9999px,-9999px,0);will-change:transform;opacity:0;transition:opacity .1s";
    label.setAttribute("aria-hidden", "true");
    labelEl.appendChild(label);
    labels.push(label);
  }
  return labels;
}

function createMeasuredPlacer(): LabelPlacer {
  const measureContext = document.createElement("canvas").getContext("2d")!;
  return createLabelPlacer({
    poolSize: LABEL_POOL_SIZE,
    labelHeight: LABEL_HEIGHT,
    measure: (text, font) => {
      measureContext.font = font;
      return measureContext.measureText(text).width;
    },
  });
}

// Imperative: React state here re-rendered the tree on every pointermove.
function createTooltip(labelEl: HTMLElement): HTMLDivElement {
  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;max-width:270px;" +
    "overflow:hidden;text-overflow:ellipsis;background:rgba(8,10,9,.95);border:1px solid #1B2318;" +
    "border-left-width:2px;padding:4px 7px;font:600 9px/1.4 " +
    MONO +
    ";letter-spacing:.11em;" +
    "text-transform:uppercase;opacity:0;transition:opacity .1s;" +
    "transform:translate3d(-9999px,-9999px,0);will-change:transform;z-index:5";
  tooltip.setAttribute("aria-hidden", "true");
  labelEl.appendChild(tooltip);
  return tooltip;
}

/**
 * Appends the label pool, then the tooltip, to `labelEl` (so the tooltip
 * paints over labels), tracking each one's removal as it lands.
 */
export function createLabelLayer(labelEl: HTMLElement, track: Track): LabelLayer {
  const labels = createLabelPool(labelEl);
  const owner = new Int32Array(LABEL_POOL_SIZE).fill(-1);
  track(() => labels.forEach((label) => label.remove()));
  const labelPlacer = createMeasuredPlacer();
  const tooltip = createTooltip(labelEl);
  track(() => tooltip.remove());
  return { labels, owner, labelPlacer, tooltip };
}
