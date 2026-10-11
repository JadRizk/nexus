import { vi } from "vitest";
import { mulberry32 } from "../random.js";

/**
 * In every this-many frames, the first draw the canvas makes is replaced by a
 * value under the glitch threshold (`Math.random() < 0.0022 * glitch` at the
 * default glitch of 0.5), so the glitch path fires inside a short recording.
 * 0.00105 sits between 0.0010 and 0.0011, so moving the threshold by a tenth
 * either way changes the outcome. Timed by frame, not by draw count, so how
 * many draws came before it cannot move the glitch.
 */
const LOW_DRAW_EVERY = 7;
const LOW_DRAW = 0.00105;
const SEED = 42;
/** three's own draws (`generateUUID`, four per object) come from here, apart from the canvas's. */
const THREE_SEED = 7;
/** three from node_modules, or as vite pre-bundles it into `.vite/deps/three.js`. */
const THREE_SOURCE = /[\\/]node_modules[\\/](?:three[\\/]|\.vite[\\/]deps(?:_ssr)?[\\/]three\.)/;
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
  addListener = () => undefined;
  removeListener = () => undefined;
}

function isFromThree(): boolean {
  return THREE_SOURCE.test(new Error().stack ?? "");
}

/**
 * Two seeded streams: one for three, so creating an object the canvas never
 * draws leaves the recording as it was, and one for the canvas. `arm` sets up the scripted glitch draw for the frame about to run.
 */
function pinRandom() {
  const canvas = mulberry32(SEED);
  const three = mulberry32(THREE_SEED);
  const low = { armed: false };
  let threeDraws = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    if (isFromThree()) {
      threeDraws++;
      return three();
    }
    if (!low.armed) return canvas();
    low.armed = false;
    return LOW_DRAW;
  });
  return {
    /** Arms the low draw if `frame` is due one; it lasts until drawn or `disarm()`. */
    arm(frame: number) {
      low.armed = frame % LOW_DRAW_EVERY === 0;
    },
    disarm() {
      low.armed = false;
    },
    /**
     * Every mount creates three objects, so a session with no three draws means
     * `THREE_SOURCE` stopped matching and UUID draws fell into the canvas stream.
     */
    assertThreeDrew() {
      if (threeDraws === 0) throw new Error("harness: three's draws never matched THREE_SOURCE");
    },
  };
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
  const measure = {
    font: "",
    measureText: (text: string) => ({ width: text.length * CHAR_WIDTH }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    measure as unknown as CanvasRenderingContext2D,
  );
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
}

/**
 * jsdom's selector engine listens on its inner window the first time a
 * `:focus`-style query runs; that is test plumbing, not the canvas.
 */
function isJsdomInternal(target: EventTarget): boolean {
  return target !== window && target.constructor.name === "Window";
}

/** capture, passive and once as passed; a boolean is the capture flag. */
function optionsSuffix(options: boolean | AddEventListenerOptions | undefined): string {
  if (options === undefined) return "";
  return ` ${JSON.stringify(typeof options === "boolean" ? { capture: options } : options)}`;
}

/** `owner` is `EventTarget.prototype`, or `window`, which jsdom gives its own methods. */
function spyOnTarget(owner: EventTarget, log: (line: string) => void) {
  const add = owner.addEventListener;
  const remove = owner.removeEventListener;
  vi.spyOn(owner, "addEventListener").mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    if (!isJsdomInternal(this)) log(`on ${describeTarget(this)} ${type}${optionsSuffix(options)}`);
    add.call(this, type, listener, options);
  });
  vi.spyOn(owner, "removeEventListener").mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    if (!isJsdomInternal(this)) log(`off ${describeTarget(this)} ${type}${optionsSuffix(options)}`);
    remove.call(this, type, listener, options);
  });
}

function spyOnListeners(log: (line: string) => void) {
  spyOnTarget(EventTarget.prototype, log);
  spyOnTarget(window, log);
}

function pinResizeObserver(observers: (() => void)[], log: (line: string) => void) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe = () => undefined;
      disconnect() {
        log("resizeObserver.disconnect");
      }
    },
  );
}

/**
 * Pins every input the canvas reads from the platform; `restore()` undoes all
 * of it. `log` receives the platform calls that are part of teardown.
 */
export function pinEnvironment(log: (line: string) => void): Environment {
  const size = { width: 800, height: 600 };
  const observers: (() => void)[] = [];
  const motion = new MotionQuery();
  let now = 0;
  let pending: FrameRequestCallback | null = null;
  let frame = 0;
  const random = pinRandom();
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
  pinResizeObserver(observers, log);
  return {
    get now() {
      return now;
    },
    advance(ms) {
      const callback = pending;
      now += ms;
      pending = null;
      if (callback === null) return false;
      random.arm(++frame);
      callback(now);
      random.disarm();
      return true;
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
      random.assertThreeDrew();
    },
  };
}
