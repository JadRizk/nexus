/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import type * as ThreeModule from "three";
import type { LinkCategory, NodeCategory } from "./types.js";

/** How many times the mocked WebGLRenderer has been constructed — a stand-in
 * for how many times boot() (and so the mount effect) has actually run. */
let rendererInstances = 0;

// WebGLRenderer is the only part of three that needs a GL context; everything
// else (geometries, materials, render targets) is inert bookkeeping in jsdom.
// Mirrors the mock in GraphCanvas.physics.test.tsx.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof ThreeModule>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    autoClear = true;
    capabilities = { isWebGL2: true };
    constructor() { rendererInstances++; }
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
  rendererInstances = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships none of these. The frame loop is deliberately never scheduled:
  // these tests are about what a DOM event reaches, not about rendering.
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

function render(onSelect: (v: unknown) => void) {
  act(() => {
    root.render(
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        onSelect={onSelect}
      />,
    );
  });
}

describe("GraphCanvas callback refs", () => {
  it("invokes a replaced onSelect, not the one captured at mount, without remounting the scene", () => {
    const first = vi.fn();
    const second = vi.fn();

    render(first);
    expect(rendererInstances).toBe(1);

    // Same nodes/edges/categories references as the first render, so the
    // mount effect's dependency array is unchanged and the scene is not
    // rebuilt — only the onSelect prop differs.
    render(second);
    expect(rendererInstances).toBe(1);

    const canvas = container.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0, clientY: 0 }));

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
