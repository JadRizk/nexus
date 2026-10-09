/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_HINT, actionForKey, createNavOverlay } from "./overlay.js";
import type { NavOverlay } from "./overlay.js";

let container: HTMLDivElement;
let overlay: NavOverlay;
const onAction = vi.fn();
const onEscape = vi.fn();
const onFocusChange = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  overlay = createNavOverlay({ container, onAction, onEscape, onFocusChange });
  onAction.mockReset();
  onEscape.mockReset();
  onFocusChange.mockReset();
});
afterEach(() => {
  overlay.dispose();
  container.remove();
});

const button = () => container.querySelector("button")!;
const live = () => container.querySelector("[aria-live]")!;
const hints = () => container.querySelector('[aria-hidden="true"]') as HTMLElement;
const press = (key: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  button().dispatchEvent(ev);
  return ev;
};

describe("the key map", () => {
  it.each([
    ["ArrowRight", { type: "browse", step: 1 }],
    ["ArrowLeft", { type: "browse", step: -1 }],
    ["ArrowDown", { type: "filter", step: 1 }],
    ["ArrowUp", { type: "filter", step: -1 }],
    ["Enter", { type: "follow" }],
    [" ", { type: "toggleSelect" }],
    ["Backspace", { type: "back" }],
    ["Home", { type: "home" }],
    ["d", { type: "describe" }],
    ["D", { type: "describe" }],
    ["?", { type: "help" }],
  ])("%s → %o", (key, action) => {
    expect(actionForKey({ key })).toEqual(action);
    const ev = press(key);
    expect(onAction).toHaveBeenCalledWith(action);
    // Enter and Space would otherwise click the button; Backspace once
    // navigated browser history.
    expect(ev.defaultPrevented).toBe(true);
  });

  it("hands Escape to the engine instead of mapping it", () => {
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("leaves other keys, and any key with a modifier, alone", () => {
    expect(press("x").defaultPrevented).toBe(false);
    expect(press("ArrowRight", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press("ArrowRight", { metaKey: true }).defaultPrevented).toBe(false);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("the focus target", () => {
  it("is a single real button, named and pressed after the current node", () => {
    expect(container.querySelectorAll("button")).toHaveLength(1);
    overlay.setNode("animate, skill, 6 connections", true);
    expect(button().getAttribute("aria-label")).toBe("animate, skill, 6 connections");
    expect(button().getAttribute("aria-pressed")).toBe("true");
  });

  it("sits over the node and is never smaller than 24px", () => {
    const box = () => {
      const m = button().style.transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/) ?? [];
      const [x, y] = [Number(m[1]), Number(m[2])];
      return { x, y, w: parseFloat(button().style.width), h: parseFloat(button().style.height) };
    };
    overlay.place(100, 50, 8);
    expect(box()).toEqual({ x: 88, y: 38, w: 24, h: 24 });
    overlay.place(100, 50, 40);
    expect(box()).toEqual({ x: 80, y: 30, w: 40, h: 40 });
  });

  it("skips the style writes when nothing moved", () => {
    overlay.place(100, 50, 30);
    const t = button().style.transform;
    // A valid value: newer jsdom drops an invalid one, as browsers do.
    button().style.transform = "translate3d(1px, 2px, 0px)";
    overlay.place(100.2, 50.2, 30.1);
    expect(button().style.transform).toBe("translate3d(1px, 2px, 0px)");
    overlay.place(110, 50, 30);
    expect(button().style.transform).not.toBe(t);
  });

  it("reports focus entering and leaving", () => {
    overlay.focus();
    expect(overlay.focused).toBe(true);
    expect(onFocusChange).toHaveBeenLastCalledWith(true);
    overlay.blur();
    expect(overlay.focused).toBe(false);
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
  });

  it("can be taken out of the tab order and still be focused by script", () => {
    expect(button().tabIndex).toBe(0);
    overlay.setTabbable(false);
    expect(button().tabIndex).toBe(-1);
    overlay.focus();
    expect(overlay.focused).toBe(true);
    overlay.setTabbable(true);
    expect(button().tabIndex).toBe(0);
  });
});

describe("the live region", () => {
  it("is polite and atomic", () => {
    expect(live().getAttribute("aria-live")).toBe("polite");
    expect(live().getAttribute("aria-atomic")).toBe("true");
  });

  it("makes a repeated announcement differ, so it is read again", () => {
    overlay.announce("Start of path");
    const first = live().textContent;
    overlay.announce("Start of path");
    expect(live().textContent).not.toBe(first);
    expect(live().textContent!.replace(/\u200b/g, "")).toBe("Start of path");
  });
});

describe("the key hint", () => {
  it("is hidden from assistive tech and off until shown", () => {
    expect(hints().textContent).toBe(KEY_HINT);
    expect(hints().style.display).toBe("none");
  });

  it("sits at the bottom-left of the free box", () => {
    overlay.setHints(true, { top: 0, right: 320, bottom: 10, left: 272 });
    expect(hints().style.display).toBe("block");
    expect(hints().style.left).toBe("284px");
    expect(hints().style.bottom).toBe("22px");
    overlay.setHints(false, { top: 0, right: 0, bottom: 0, left: 0 });
    expect(hints().style.display).toBe("none");
  });
});

it("removes everything on dispose", () => {
  overlay.dispose();
  expect(container.children).toHaveLength(0);
  overlay = createNavOverlay({ container, onAction, onEscape, onFocusChange });
});
