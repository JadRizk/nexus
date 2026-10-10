import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { GraphCanvas } from "../GraphCanvas.js";
import { project } from "../camera.js";
import type { FrameGeometry, GraphCanvasProps, GraphController } from "../types.js";
import { pinEnvironment } from "./environment.js";
import type { Environment } from "./environment.js";
import { ariaLabel, edges, linkCategories, nodeCategories, nodes } from "./fixture.js";
import { createTranscript, hashText, stableJson } from "./serialise.js";
import type { Transcript } from "./serialise.js";
import { recording } from "./three-recorder.js";

export type Point = readonly [number, number];

const FRAME_MS = 16;
/** Idle frames before a scenario records: past the 0.8 s intro glitch, so glitch draws are live. */
export const WARMUP_FRAMES = 60;
/** How far an "empty" point keeps from every node, in CSS px. */
const EMPTY_CLEARANCE = 40;

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`harness: no ${what}`);
  return value;
}

function describeElement(el: HTMLElement): string {
  return `${el.textContent} | ${el.style.transform} | opacity ${el.style.opacity}`;
}

/** Placed labels, the tooltip and a hash of everything else in the DOM. */
function domState(container: HTMLElement): Map<string, string> {
  const fields = new Map<string, string>();
  const layer = container.firstElementChild?.children[1];
  const children = layer ? [...layer.children] : [];
  children.forEach((child, k) => {
    if (!(child instanceof HTMLElement) || child.textContent === "") return;
    const key = k === children.length - 1 ? "tooltip" : `label.${k}`;
    fields.set(key, describeElement(child));
  });
  fields.set("dom", hashText(container.innerHTML));
  return fields;
}

/**
 * Mounts `GraphCanvas` on the fixture in a pinned environment and drives it
 * frame by frame. Until `record()`, everything it drains is discarded.
 */
class Session {
  readonly environment: Environment;
  private readonly container = document.createElement("div");
  private readonly root: Root;
  private readonly ref = createRef<GraphController>();
  private props: Partial<GraphCanvasProps> = {};
  private transcript: Transcript | null = null;
  private geometry: FrameGeometry | null = null;
  private frameFields = new Map<string, string>();
  private frameCount = 0;
  private readonly callbacks = {
    onSelect: (...args: unknown[]) => this.callback("onSelect", args),
    onNavigate: (...args: unknown[]) => this.callback("onNavigate", args),
    onStats: (...args: unknown[]) => this.callback("onStats", args),
    onFatal: (...args: unknown[]) => this.callback("onFatal", args),
    onWarning: (...args: unknown[]) => this.callback("onWarning", args),
    onFrame: (geometry: FrameGeometry) => {
      this.geometry = geometry;
      this.frameFields = new Map(
        Object.entries(geometry).map(([key, value]) => [`onFrame.${key}`, stableJson(value)]),
      );
    },
  };

  constructor() {
    recording.reset();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    this.environment = pinEnvironment((line) => recording.event(line));
    document.body.appendChild(this.container);
    this.root = createRoot(this.container);
    // After createRoot, so React's own root listeners stay out of the recording.
    this.environment.spyOnListeners((line) => recording.event(line));
  }

  get controller(): GraphController {
    return required(this.ref.current, "controller");
  }

  get canvas(): HTMLCanvasElement {
    return required(this.container.querySelector("canvas"), "canvas");
  }

  get focusTarget(): HTMLElement {
    return required(
      this.container.querySelector<HTMLElement>("button[data-nx-graph-focus]"),
      "focus button",
    );
  }

  /** Renders with the fixture, then these props on top of every earlier override. */
  render(overrides: Partial<GraphCanvasProps> = {}) {
    this.props = { ...this.props, ...overrides };
    const element = (
      <GraphCanvas
        ref={this.ref}
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        ariaLabel={ariaLabel}
        {...this.callbacks}
        {...this.props}
      />
    );
    act(() => this.root.render(element));
  }

  /** Mounts and idles past the intro, unrecorded. */
  warmUp() {
    this.render();
    this.frames(WARMUP_FRAMES);
  }

  resize(width: number, height: number) {
    act(() => this.environment.resize(width, height));
  }

  /** Starts the transcript; its first frame writes the full state. */
  record() {
    this.transcript = createTranscript();
    recording.drainEvents();
  }

  /** A titled action; what it causes outside a frame is written under the title. */
  step(title: string, action: () => void) {
    this.transcript?.events(recording.drainEvents());
    this.transcript?.step(title);
    action();
    this.transcript?.events(recording.drainEvents());
  }

  frames(count: number, ms = FRAME_MS) {
    for (let i = 0; i < count; i++) {
      act(() => {
        this.environment.advance(ms);
      });
      this.frameCount++;
      const { events, state } = recording.drainFrame();
      const fields = new Map([...state, ...this.frameFields, ...domState(this.container)]);
      this.transcript?.frame(`frame ${this.frameCount} +${ms}ms`, events, fields);
    }
  }

  /** A node's centre on screen, from the last `onFrame`. */
  nodePoint(index: number): Point {
    const geometry = required(this.geometry, "frame yet");
    const { positions, camera, viewport } = geometry;
    const out: [number, number] = [0, 0];
    const [wx = 0, wy = 0] = [positions[index * 2], positions[index * 2 + 1]];
    project(wx, wy, camera.zoom, camera.x, camera.y, viewport, out);
    return [Math.round(out[0]), Math.round(out[1])];
  }

  rightmostNode(): number {
    const xs = nodes.map((_, i) => this.nodePoint(i)[0]);
    return xs.indexOf(Math.max(...xs));
  }

  /** The first point on a 20 px grid that keeps clear of every node. */
  emptyPoint(): Point {
    const points = nodes.map((_, i) => this.nodePoint(i));
    for (let y = 20; y < 600; y += 20) {
      for (let x = 20; x < 800; x += 20) {
        if (points.every(([px, py]) => Math.hypot(px - x, py - y) > EMPTY_CLEARANCE)) return [x, y];
      }
    }
    throw new Error("harness: no empty point");
  }

  pointer(type: string, [x, y]: Point, target: EventTarget = this.canvas) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, "pointerId", { value: 1 });
    this.dispatch(target, event);
  }

  wheel([x, y]: Point, deltaY: number) {
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY };
    this.dispatch(this.canvas, new WheelEvent("wheel", init));
  }

  key(key: string) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    this.dispatch(this.focusTarget, event);
  }

  dispatch(target: EventTarget, event: Event) {
    act(() => {
      target.dispatchEvent(event);
    });
  }

  unmount() {
    act(() => this.root.unmount());
  }

  text(): string {
    return required(this.transcript, "transcript").text();
  }

  close() {
    this.unmount();
    this.container.remove();
    this.environment.restore();
    recording.reset();
  }

  private callback(name: string, args: unknown[]) {
    recording.event(`${name} ${stableJson(args)}`);
  }
}

export type { Session };

export function openSession(): Session {
  return new Session();
}
