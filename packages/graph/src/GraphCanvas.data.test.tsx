/**
 * @vitest-environment jsdom
 */
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import type * as ThreeModule from "three";
import type {
  GraphController,
  GraphNode,
  GraphNodeSnapshot,
  LinkCategory,
  NodeCategory,
} from "./types.js";

// WebGLRenderer is the only part of three that needs a GL context; everything
// else (geometries, materials, render targets) is inert bookkeeping in jsdom.
// Mirrors the mock in GraphCanvas.callbacks.test.tsx.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof ThreeModule>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    autoClear = true;
    capabilities = { isWebGL2: true };
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    getDrawingBufferSize(target: { set(x: number, y: number): void }) {
      target.set(300, 150);
      return target;
    }
    setRenderTarget() {}
    clear() {}
    render() {}
    getContext() {
      return { MAX_VERTEX_ATTRIBS: 0x8869, getParameter: () => 16 };
    }
    dispose() {}
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

interface Payload {
  weight: number;
  tags: string[];
}

const nodeCategories: Record<string, NodeCategory> = {
  atlas: {
    label: "ATLAS",
    shape: 0,
    color: "#9EFF3D",
    code: "ATL",
    size: 7,
    charge: 1,
    mass: 1,
    tier: 0,
  },
  // jsdom lays everything out at zero size, so a click unprojects to within a
  // world unit or two of the origin while a node starts some 30 units out. A
  // node this large is under the pointer wherever that click lands, which
  // keeps the selection test independent of the solver's random scatter.
  huge: {
    label: "HUGE",
    shape: 0,
    color: "#9EFF3D",
    code: "HUG",
    size: 1000,
    charge: 1,
    mass: 1,
    tier: 0,
  },
};
const linkCategories: Record<string, LinkCategory> = {
  refs: { label: "REFS", color: "#17E2E5", width: 1, dist: 1, strength: 0.5 },
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships none of these. The frame loop is deliberately never scheduled:
  // these tests are about what the snapshot carries, not about rendering.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    measureText: (t: string) => ({ width: t.length * 6 }),
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

describe("GraphCanvas node data", () => {
  it("returns each node's data from getNode as the same reference", () => {
    const alpha: Payload = { weight: 3, tags: ["x"] };
    const nodes: GraphNode<Payload>[] = [
      { id: "a", categoryId: "atlas", label: "A", data: alpha },
      { id: "b", categoryId: "atlas", label: "B" },
    ];
    const edges = [{ a: "a", b: "b", categoryId: "refs" }];
    const controller = createRef<GraphController<Payload>>();

    act(() => {
      root.render(
        <GraphCanvas
          ref={controller}
          nodes={nodes}
          edges={edges}
          nodeCategories={nodeCategories}
          linkCategories={linkCategories}
        />,
      );
    });

    const a = controller.current!.getNode("a")!;
    expect(a.data).toBe(alpha);
    // Typed through the controller: this line is a compile error if `data`
    // comes back as `unknown`.
    const weight: number | undefined = a.data?.weight;
    expect(weight).toBe(3);

    const b = controller.current!.getNode("b")!;
    expect(b.data).toBeUndefined();
  });

  it("passes the clicked node's data to onSelect, typed from the nodes", () => {
    const only: Payload = { weight: 7, tags: [] };
    // No annotation: the payload type is inferred from the literal.
    const nodes = [{ id: "solo", categoryId: "huge", label: "SOLO", data: only }];
    const edges: never[] = [];
    let selected: GraphNodeSnapshot<Payload> | null | undefined;

    act(() => {
      root.render(
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          nodeCategories={nodeCategories}
          linkCategories={linkCategories}
          // Assigning to a GraphNodeSnapshot<Payload> is a compile error unless
          // `T` was inferred from `nodes`.
          onSelect={(node) => {
            selected = node;
          }}
        />,
      );
    });

    const canvas = container.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0, clientY: 0 }));

    expect(selected).toBeTruthy();
    expect(selected!.id).toBe("solo");
    expect(selected!.data).toBe(only);
  });
});
