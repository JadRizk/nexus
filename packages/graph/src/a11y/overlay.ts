/* ============================================================================
   NAV OVERLAY — the DOM the navigator speaks and listens through

   Three elements and nothing else:

   - One focus target: a <button> that stands for the node the reader is on.
     It is moved and relabelled as they travel, rather than one button per
     node: the roving-tabindex pattern taken to its limit, as Data Navigator
     (VIS 2023) does. One Tab stop into the graph, one out, and a DOM cost
     that doesn't grow with the graph.
   - One polite live region, for what the navigator says.
   - A one-line key hint, shown while focus is inside the graph. Shortcuts
     nobody can see go undiscovered (QUARTZ found exactly that), so the keys
     are on screen; it is aria-hidden because "?" speaks the same thing.

   Imperative on purpose: GraphCanvas positions the button every frame, and
   pushing that through React state would re-render at animation-frame rate.
   Every decision — what a key does, what to say — belongs to the navigator;
   this file only translates keys into actions and effects into DOM.
   ========================================================================== */

import type { FitInset } from "../camera.js";
import type { NavAction } from "./navigator.js";

export interface NavOverlayOptions {
  /** A layer inside the graph's root that assistive tech can see (not aria-hidden). */
  container: HTMLElement;
  /** A key the navigator handles was pressed. */
  onAction(action: NavAction): void;
  /** Escape was pressed. The engine decides what it means right now (deselect, dismiss the tooltip, or leave). */
  onEscape(): void;
  /** Focus entered (true) or left (false) the graph. */
  onFocusChange(focused: boolean): void;
}

export interface NavOverlay {
  /** Position the focus target over a node: centre and diameter in CSS px. */
  place(x: number, y: number, diameter: number): void;
  /** Name the focus target after the current node, and say whether it is selected. */
  setNode(label: string, selected: boolean): void;
  /** Speak through the live region. */
  announce(text: string): void;
  /** Show or hide the key hint, at the bottom of the free box. */
  setHints(visible: boolean, inset: FitInset): void;
  /**
   * Whether Tab can reach the focus target. Off while the graph's root holds
   * focus after Escape, so the next Tab leaves the graph instead of landing
   * straight back inside it.
   */
  setTabbable(tabbable: boolean): void;
  focus(): void;
  blur(): void;
  readonly focused: boolean;
  dispose(): void;
}

export const KEY_HINT =
  "←→ connections · ↑↓ direction · Enter follow · ⌫ back · Space select · ? help";

/** The key map (spec §6.5.1), minus Escape, which the engine resolves. */
export function actionForKey(ev: Pick<KeyboardEvent, "key">): NavAction | null {
  switch (ev.key) {
    case "ArrowRight":
      return { type: "browse", step: 1 };
    case "ArrowLeft":
      return { type: "browse", step: -1 };
    case "ArrowDown":
      return { type: "filter", step: 1 };
    case "ArrowUp":
      return { type: "filter", step: -1 };
    case "Enter":
      return { type: "follow" };
    case " ":
      return { type: "toggleSelect" };
    case "Backspace":
      return { type: "back" };
    case "Home":
      return { type: "home" };
    case "d":
    case "D":
      return { type: "describe" };
    case "?":
      return { type: "help" };
    default:
      return null;
  }
}

const VISUALLY_HIDDEN =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;" +
  "overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;";

export function createNavOverlay(opts: NavOverlayOptions): NavOverlay {
  const { container, onAction, onEscape, onFocusChange } = opts;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset["nxGraphFocus"] = "";
  // Sized and moved over the node's glyph. Invisible itself: the focus ring is
  // drawn in the canvas so it follows the CRT curve. The transparent outline
  // is there for forced-colours mode, where the canvas ring may not survive
  // and a transparent outline is painted in the system highlight colour.
  button.style.cssText =
    "position:absolute;left:0;top:0;width:24px;height:24px;margin:0;padding:0;" +
    "border:0;background:transparent;color:transparent;opacity:1;cursor:default;" +
    "outline:2px solid transparent;outline-offset:2px;pointer-events:none;" +
    "transform:translate3d(-9999px,-9999px,0);";
  container.appendChild(button);

  const live = document.createElement("div");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("aria-atomic", "true");
  live.style.cssText = VISUALLY_HIDDEN;
  container.appendChild(live);

  const hints = document.createElement("div");
  hints.setAttribute("aria-hidden", "true");
  hints.textContent = KEY_HINT;
  // Token variables with literal fallbacks: themed when @nexus-cyberdeck/tokens
  // is on the page, still readable when it isn't. #8FA284 on #0A0C0B is 7.2:1.
  hints.style.cssText =
    "position:absolute;display:none;max-width:calc(100% - 24px);box-sizing:border-box;" +
    "padding:6px 10px;pointer-events:none;z-index:6;" +
    'font:500 10px/1.4 var(--nx-font-mono, ui-monospace,"SF Mono",Menlo,Consolas,monospace);' +
    "letter-spacing:.08em;text-transform:uppercase;" +
    "color:var(--nx-fg-muted, #8FA284);background:var(--nx-bg-surface, rgba(10,12,11,.92));" +
    "border:1px solid var(--nx-border-strong, #34402E);";
  container.appendChild(hints);

  let px = NaN,
    py = NaN,
    pd = NaN;
  // Identical consecutive announcements are ignored by most screen readers;
  // a trailing zero-width space that flips on each call makes them distinct.
  let flip = false;

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      onEscape();
      return;
    }
    const action = actionForKey(ev);
    if (!action) return;
    // Covers Enter and Space too, which a <button> would otherwise turn into
    // a click, and Backspace, which some browsers once mapped to history.
    ev.preventDefault();
    onAction(action);
  };
  const onFocus = () => onFocusChange(true);
  const onBlur = () => onFocusChange(false);
  button.addEventListener("keydown", onKeyDown);
  button.addEventListener("focus", onFocus);
  button.addEventListener("blur", onBlur);

  return {
    place(x, y, diameter) {
      // Most frames nothing moved; skip the style writes when so.
      if (Math.abs(x - px) < 0.5 && Math.abs(y - py) < 0.5 && Math.abs(diameter - pd) < 0.5) return;
      px = x;
      py = y;
      pd = diameter;
      // At least 24px, the WCAG 2.5.8 target size, whatever the zoom.
      const d = Math.max(24, diameter);
      button.style.width = `${d.toFixed(1)}px`;
      button.style.height = `${d.toFixed(1)}px`;
      button.style.transform = `translate3d(${(x - d / 2).toFixed(1)}px,${(y - d / 2).toFixed(1)}px,0)`;
    },
    setNode(label, selected) {
      if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(selected));
    },
    announce(text) {
      flip = !flip;
      live.textContent = text + (flip ? "\u200b" : "");
    },
    setHints(visible, inset) {
      hints.style.display = visible ? "block" : "none";
      if (!visible) return;
      hints.style.left = `${inset.left + 12}px`;
      hints.style.bottom = `${inset.bottom + 12}px`;
      hints.style.maxWidth = `calc(100% - ${inset.left + inset.right + 24}px)`;
    },
    setTabbable(tabbable) {
      button.tabIndex = tabbable ? 0 : -1;
    },
    focus() {
      button.focus({ preventScroll: true });
    },
    blur() {
      button.blur();
    },
    get focused() {
      return document.activeElement === button;
    },
    dispose() {
      button.removeEventListener("keydown", onKeyDown);
      button.removeEventListener("focus", onFocus);
      button.removeEventListener("blur", onBlur);
      button.remove();
      live.remove();
      hints.remove();
    },
  };
}
