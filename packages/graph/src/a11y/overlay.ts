import type { FitInset } from "../camera.js";
import type { NavAction } from "./navigator.js";

export interface NavOverlayOptions {
  /** Must not be aria-hidden. */
  container: HTMLElement;
  onAction(action: NavAction): void;
  /** The engine decides what Escape means right now: deselect, dismiss the tooltip, or leave. */
  onEscape(): void;
  onFocusChange(focused: boolean): void;
}

export interface NavOverlay {
  /** Centre and diameter in CSS px. */
  place(x: number, y: number, diameter: number): void;
  setNode(label: string, selected: boolean): void;
  announce(text: string): void;
  setHints(visible: boolean, inset: FitInset): void;
  /** Off while the root holds focus after Escape, so the next Tab leaves the graph. */
  setTabbable(tabbable: boolean): void;
  focus(): void;
  blur(): void;
  readonly focused: boolean;
  dispose(): void;
}

export const KEY_HINT =
  "←→ connections · ↑↓ direction · Enter follow · ⌫ back · Space select · ? help";

/** Escape is left out: the engine resolves it. */
export function actionForKey(event: Pick<KeyboardEvent, "key">): NavAction | null {
  switch (event.key) {
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

/** One roving button for the current node, not one per node; imperative because GraphCanvas moves it every frame. */
export function createNavOverlay(options: NavOverlayOptions): NavOverlay {
  const { container, onAction, onEscape, onFocusChange } = options;

  const button = document.createElement("button");
  button.type = "button";
  button.dataset["nxGraphFocus"] = "";
  // The canvas draws the focus ring; forced-colours mode paints the transparent outline instead.
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
  hints.style.cssText =
    "position:absolute;display:none;max-width:calc(100% - 24px);box-sizing:border-box;" +
    "padding:6px 10px;pointer-events:none;z-index:6;" +
    'font:500 10px/1.4 var(--nx-font-mono, ui-monospace,"SF Mono",Menlo,Consolas,monospace);' +
    "letter-spacing:.08em;text-transform:uppercase;" +
    "color:var(--nx-fg-muted, #8FA284);background:var(--nx-bg-surface, rgba(10,12,11,.92));" +
    "border:1px solid var(--nx-border-strong, #34402E);";
  container.appendChild(hints);

  let placedX = NaN,
    placedY = NaN,
    placedDiameter = NaN;
  // Screen readers skip a repeated announcement; a flipping zero-width space makes each distinct.
  let flip = false;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }
    const action = actionForKey(event);
    if (!action) return;
    event.preventDefault();
    onAction(action);
  };
  // Screen readers in browse mode click instead of sending Enter or Space; real keydowns never click.
  const handleClick = () => onAction({ type: "toggleSelect" });
  const handleFocus = () => onFocusChange(true);
  const handleBlur = () => onFocusChange(false);
  button.addEventListener("click", handleClick);
  button.addEventListener("keydown", handleKeyDown);
  button.addEventListener("focus", handleFocus);
  button.addEventListener("blur", handleBlur);

  return {
    place(x, y, diameter) {
      if (
        Math.abs(x - placedX) < 0.5 &&
        Math.abs(y - placedY) < 0.5 &&
        Math.abs(diameter - placedDiameter) < 0.5
      )
        return;
      placedX = x;
      placedY = y;
      placedDiameter = diameter;
      // 24px is the WCAG 2.5.8 minimum target size.
      const size = Math.max(24, diameter);
      button.style.width = `${size.toFixed(1)}px`;
      button.style.height = `${size.toFixed(1)}px`;
      button.style.transform = `translate3d(${(x - size / 2).toFixed(1)}px,${(y - size / 2).toFixed(1)}px,0)`;
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
      button.removeEventListener("click", handleClick);
      button.removeEventListener("keydown", handleKeyDown);
      button.removeEventListener("focus", handleFocus);
      button.removeEventListener("blur", handleBlur);
      button.remove();
      live.remove();
      hints.remove();
    },
  };
}
