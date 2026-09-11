/**
 * The rest of this package's tests are pure math and run in the `node`
 * environment the shared vitest config sets. This one has to mount a real
 * React tree, so it opts itself into jsdom per-file rather than moving the
 * whole package onto a DOM it does not otherwise need. It covers what
 * mounting does: what reaches the solver, and what a boot that throws, a
 * lost context, or an unmount leaves behind.
 *
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import type * as PhysicsModule from "./physics.js";
import type { Physics, PhysicsParams } from "./physics.js";
import type * as ThreeModule from "three";
import type { GraphCanvasProps, LinkCategory, NodeCategory, PhysicsConfig } from "./types.js";

type ParamsPatch = Partial<PhysicsParams> & { settle?: number };

/** Every setParams call any solver created during a test received, in order. */
const setParamsCalls: ParamsPatch[] = [];

/** Every WebGLRenderer constructed during a test, and the teardown calls it received, in order. */
const renderers: Array<{ domElement: HTMLCanvasElement; teardown: string[] }> = [];

// The real solver, with setParams observed. Mocking createPhysics outright
// would make the assertion about the mock rather than about the solver, so the
// numerics stay real and only the call is recorded.
vi.mock("./physics.js", async (importOriginal) => {
  const actual = await importOriginal<typeof PhysicsModule>();
  return {
    ...actual,
    createPhysics: (graph: Parameters<typeof actual.createPhysics>[0]): Physics => {
      const sim = actual.createPhysics(graph);
      return {
        ...sim,
        setParams: (p: ParamsPatch) => { setParamsCalls.push({ ...p }); sim.setParams(p); },
      };
    },
  };
});

// WebGLRenderer is the only part of three that needs a GL context; everything
// else (geometries, materials, render targets) is inert bookkeeping in jsdom.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof ThreeModule>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    autoClear = true;
    capabilities = { isWebGL2: true };
    teardown: string[] = [];
    constructor() { renderers.push(this); }
    setPixelRatio() { }
    setClearColor() { }
    setSize() { }
    getDrawingBufferSize(target: { set(x: number, y: number): void }) {
      target.set(300, 150);
      return target;
    }
    setRenderTarget() { }
    clear() { }
    render() { }
    getContext() {
      return { MAX_VERTEX_ATTRIBS: 0x8869, getParameter: () => 16 };
    }
    dispose() { this.teardown.push("dispose"); }
    forceContextLoss() { this.teardown.push("forceContextLoss"); }
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

const nodeCategories: Record<string, NodeCategory> = {
  atlas: { label: "ATLAS", shape: 0, color: "#9EFF3D", code: "ATL", size: 7, charge: 1, mass: 1, tier: 0 },
};
const linkCategories: Record<string, LinkCategory> = {
  refs: { label: "REFS", color: "#17E2E5", width: 1, dist: 1, strength: 0.5 },
};
const nodes = [
  { id: "a", categoryId: "atlas", label: "A" },
  { id: "b", categoryId: "atlas", label: "B" },
];
const edges = [{ a: "a", b: "b", categoryId: "refs" }];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setParamsCalls.length = 0;
  renderers.length = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships none of these. The frame loop is deliberately never scheduled:
  // this test is about what reaches the solver at mount, not about rendering.
  vi.stubGlobal("ResizeObserver", class { observe() { } unobserve() { } disconnect() { } });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => { });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "", measureText: (t: string) => ({ width: t.length * 6 }),
  } as unknown as CanvasRenderingContext2D);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(physics?: Partial<PhysicsConfig>, overrides: Partial<GraphCanvasProps> = {}) {
  act(() => {
    root.render(
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        physics={physics}
        {...overrides}
      />,
    );
  });
}

describe("GraphCanvas physics prop", () => {
  it("applies the initial physics prop to the solver on mount", () => {
    mount({ gravity: 0.1 });
    expect(setParamsCalls.length).toBeGreaterThan(0);
    expect(setParamsCalls[0]).toMatchObject({ gravity: 0.1 });
  });

  it("forwards all six documented fields, defaulting the ones not passed", () => {
    mount({ gravity: 0.1 });
    expect(setParamsCalls[0]).toEqual({
      repulsion: 900, linkDistance: 78, gravity: 0.1, damping: 0.62, cursorForce: 0, settle: 0,
    });
  });

  it("forwards gravity and damping again when the prop changes after mount", () => {
    mount({ gravity: 0.1 });
    setParamsCalls.length = 0;
    mount({ gravity: 0.2, damping: 0.4 });
    expect(setParamsCalls[setParamsCalls.length - 1]).toEqual({
      repulsion: 900, linkDistance: 78, gravity: 0.2, damping: 0.4, cursorForce: 0, settle: 0,
    });
  });
});

describe("GraphCanvas boot and teardown", () => {
  // The component reports a thrown boot through console.error as well as
  // onFatal; silenced so a passing run reads clean, and asserted on below.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => { });
  });

  it("rejects an edge to an unknown node id before constructing a WebGLRenderer", () => {
    const onFatal = vi.fn();
    mount(undefined, { edges: [{ a: "a", b: "zzz", categoryId: "refs" }], onFatal });
    expect(renderers).toHaveLength(0);
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(onFatal.mock.calls[0]![0]).toBe('GraphCanvas: edges[0].b references unknown node id "zzz"');
    expect(container.textContent).toContain("SYSTEM HALT");
    expect(container.querySelector("canvas")).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it.each([
    ["a duplicate node id",
      { nodes: [...nodes, { id: "a", categoryId: "atlas", label: "A again" }] },
      'GraphCanvas: nodes[2] duplicates id "a"'],
    ["a node category missing from nodeCategories",
      { nodes: [{ id: "a", categoryId: "ghost", label: "A" }], edges: [] },
      'GraphCanvas: nodes[0] has categoryId "ghost", which is not in nodeCategories'],
    ["an edge category missing from linkCategories",
      { edges: [{ a: "a", b: "b", categoryId: "ghost" }] },
      'GraphCanvas: edges[0] has categoryId "ghost", which is not in linkCategories'],
  ] as const)("rejects %s with a clear message and no renderer", (_what, overrides, message) => {
    const onFatal = vi.fn();
    mount(undefined, { ...overrides, onFatal });
    expect(renderers).toHaveLength(0);
    expect(onFatal).toHaveBeenCalledWith(message);
  });

  it("releases everything a boot built before it threw", () => {
    // Fail at the ResizeObserver, the last resource setup creates before the
    // frame loop: by then the renderer, its canvas, the 60-label pool and the
    // tooltip all exist. Snapshot the label layer while it is still mounted;
    // the halt panel that replaces it afterwards would hide a leak.
    let labelLayer: Element | null = null;
    vi.stubGlobal("ResizeObserver", class {
      constructor() {
        labelLayer = container.firstElementChild!.children[1]!;
        throw new Error("no ResizeObserver here");
      }
    });
    const onFatal = vi.fn();
    mount(undefined, { onFatal });

    expect(onFatal).toHaveBeenCalledWith("no ResizeObserver here");
    expect(renderers).toHaveLength(1);
    const renderer = renderers[0]!;
    expect(renderer.teardown).toEqual(["dispose", "forceContextLoss"]);
    expect(renderer.domElement.parentNode).toBeNull();
    expect(labelLayer).not.toBeNull();
    expect(labelLayer!.childElementCount).toBe(0);
  });

  it("forces context loss after disposing the renderer on unmount", () => {
    mount();
    expect(renderers).toHaveLength(1);
    const renderer = renderers[0]!;
    expect(renderer.teardown).toEqual([]);
    act(() => root.unmount());
    expect(renderer.teardown).toEqual(["dispose", "forceContextLoss"]);
    expect(renderer.domElement.parentNode).toBeNull();
  });

  it("stops the frame loop and reports through onFatal when the context is lost", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", () => 7);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const onFatal = vi.fn();
    mount(undefined, { onFatal });
    const canvas = renderers[0]!.domElement;
    expect(cancel).not.toHaveBeenCalled();

    act(() => { canvas.dispatchEvent(new Event("webglcontextlost")); });

    expect(cancel).toHaveBeenCalledWith(7);
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(onFatal).toHaveBeenCalledWith("WebGL context lost");
    expect(container.textContent).toContain("SYSTEM HALT");
  });
});
