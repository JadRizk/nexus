import { vi } from "vitest";
import { mulberry32 } from "../random.js";

/**
 * One draw in this many is replaced by a value under the glitch threshold
 * (`Math.random() < 0.0022 * glitch` at the default glitch of 0.5), so the
 * glitch path fires inside a short recording. 0.00105 sits between 0.0010 and
 * 0.0011, so moving the threshold by a tenth either way changes the outcome.
 */
const LOW_DRAW_EVERY = 7;
const LOW_DRAW = 0.00105;
const SEED = 42;
/** jsdom has no layout: text is this wide per character and every box this tall. */
const CHAR_WIDTH = 6;
const BOX_HEIGHT = 14;

export interface Environment {
  /** ms on the pinned `performance.now` clock. */
  readonly now: number;
  /** Runs the pending animation frame `ms` after the last one; false when none was scheduled. */
  advance(ms: number): boolean;
  resize(width: number, height: number): void;
  setReducedMotion(isReduced: boolean): void;
  /** From here on, every listener added or removed is passed to `log`. */
  spyOnListeners(log: (line: string) => void): void;
  restore(): void;
}

/** Named by what it is to the graph, so a listener line says where it was attached. */
export function describeTarget(target: EventTarget): string {
  if (target === window) return "window";
  if (target === document) return "document";
  if (target instanceof MotionQuery) return "motionQuery";
  if (!(target instanceof Element)) return target.constructor.name;
  const tag = target.tagName.toLowerCase();
  if (target.hasAttribute("data-nx-graph-focus")) return `${tag}[focus]`;
  const role = target.getAttribute("role");
  return role === null ? tag : `${tag}[${role}]`;
}

class MotionQuery extends EventTarget {
  matches = false;
  readonly media = "(prefers-reduced-motion: reduce)";
  onchange = null;
  addListener() {}
  removeListener() {}
}

function pinRandom() {
  const stream = mulberry32(SEED);
  let draws = 0;
  vi.spyOn(Math, "random").mockImplementation(() =>
    ++draws % LOW_DRAW_EVERY === 0 ? LOW_DRAW : stream(),
  );
}

function pinLayout(size: { width: number; height: number }) {
  vi.stubGlobal("devicePixelRatio", 2);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => size.width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => size.height);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.textContent?.length ?? 0) * CHAR_WIDTH;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => BOX_HEIGHT);
  const measure = { font: "", measureText: (text: string) => ({ width: text.length * CHAR_WIDTH }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    measure as unknown as CanvasRenderingContext2D,
  );
  Object.assign(HTMLElement.prototype, { setPointerCapture() {}, releasePointerCapture() {} });
}

function spyOnListeners(log: (line: string) => void) {
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    const suffix = options === undefined ? "" : ` ${JSON.stringify(options)}`;
    log(`on ${describeTarget(this)} ${type}${suffix}`);
    add.call(this, type, listener, options);
  });
  vi.spyOn(EventTarget.prototype, "removeEventListener").mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    log(`off ${describeTarget(this)} ${type}`);
    remove.call(this, type, listener, options);
  });
}

/**
 * Pins every input the canvas reads from the platform; `restore()` undoes all
 * of it. `log` receives the platform calls that are part of teardown.
 */
export function pinEnvironment(log: (line: string) => void): Environment {
  const size = { width: 800, height: 600 };
  const observers: Array<() => void> = [];
  const motion = new MotionQuery();
  let now = 0;
  let pending: FrameRequestCallback | null = null;
  pinRandom();
  pinLayout(size);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    log("cancelAnimationFrame");
    pending = null;
  });
  vi.stubGlobal("matchMedia", () => motion);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {
        log("resizeObserver.disconnect");
      }
    },
  );
  return {
    get now() {
      return now;
    },
    advance(ms) {
      const callback = pending;
      now += ms;
      pending = null;
      callback?.(now);
      return callback !== null;
    },
    resize(width, height) {
      size.width = width;
      size.height = height;
      for (const observer of observers) observer();
    },
    setReducedMotion(isReduced) {
      motion.matches = isReduced;
      motion.dispatchEvent(Object.assign(new Event("change"), { matches: isReduced }));
    },
    spyOnListeners,
    restore() {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    },
  };
}
