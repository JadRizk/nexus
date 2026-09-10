/**
 * The rest of this package's tests are pure math and run in the `node`
 * environment the shared vitest config sets. This one has to mount a real
 * React tree, so it opts itself into jsdom per-file rather than moving the
 * whole package onto a DOM it does not otherwise need.
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
import type { LinkCategory, NodeCategory, PhysicsConfig } from "./types.js";

type ParamsPatch = Partial<PhysicsParams> & { settle?: number };

/** Every setParams call any solver created during a test received, in order. */
const setParamsCalls: ParamsPatch[] = [];

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
    dispose() { }
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

function mount(physics?: Partial<PhysicsConfig>) {
  act(() => {
    root.render(
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        physics={physics}
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
