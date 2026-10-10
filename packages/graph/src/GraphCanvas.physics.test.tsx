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
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import type * as PhysicsModule from "./physics.js";
import type * as CameraRigModule from "./camera-rig.js";
import type { Physics, PhysicsParams } from "./physics.js";
import type * as ThreeModule from "three";
import { seedFromIds } from "./random.js";
import type {
  GraphCanvasProps,
  GraphController,
  LinkCategory,
  NodeCategory,
  PhysicsConfig,
} from "./types.js";

type ParamsPatch = Partial<PhysicsParams> & { settle?: number };

/** Every setParams call any solver created during a test received, in order. */
const setParamsCalls: ParamsPatch[] = [];

const createCalls: Array<{
  graph: Parameters<typeof PhysicsModule.createPhysics>[0];
  options: Parameters<typeof PhysicsModule.createPhysics>[1];
  startPositions: number[];
}> = [];

let reseedCalls = 0;

const rigCalls: Array<[string, ...unknown[]]> = [];

// The real rig, observed: its rules are tested in camera-rig.test.ts.
vi.mock("./camera-rig.js", async (importOriginal) => {
  const actual = await importOriginal<typeof CameraRigModule>();
  return {
    ...actual,
    createCameraRig: (deps: Parameters<typeof actual.createCameraRig>[0]) => {
      const rig = actual.createCameraRig(deps);
      const watched = [
        "intro",
        "fit",
        "reframe",
        "focus",
        "frameAround",
        "release",
        "reseed",
        "takeOver",
      ] as const;
      for (const name of watched) {
        const original = rig[name] as (...args: unknown[]) => void;
        (rig as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
          rigCalls.push([name, ...args]);
          original(...args);
        };
      }
      return rig;
    },
  };
});

/** Every WebGLRenderer constructed during a test, and the teardown calls it received, in order. */
const renderers: Array<{ domElement: HTMLCanvasElement; teardown: string[] }> = [];

// The real solver, with setParams observed. Mocking createPhysics outright
// would make the assertion about the mock rather than about the solver, so the
// numerics stay real and only the call is recorded.
vi.mock("./physics.js", async (importOriginal) => {
  const actual = await importOriginal<typeof PhysicsModule>();
  return {
    ...actual,
    createPhysics: (
      graph: Parameters<typeof actual.createPhysics>[0],
      options?: Parameters<typeof actual.createPhysics>[1],
    ): Physics => {
      const sim = actual.createPhysics(graph, options);
      createCalls.push({ graph, options, startPositions: Array.from(sim.pos) });
      return {
        ...sim,
        setParams: (p: ParamsPatch) => {
          setParamsCalls.push({ ...p });
          sim.setParams(p);
        },
        reseed: () => {
          reseedCalls++;
          sim.reseed();
        },
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
    constructor() {
      renderers.push(this);
    }
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
    dispose() {
      this.teardown.push("dispose");
    }
    forceContextLoss() {
      this.teardown.push("forceContextLoss");
    }
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

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
  createCalls.length = 0;
  reseedCalls = 0;
  rigCalls.length = 0;
  renderers.length = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships none of these. The frame loop is deliberately never scheduled:
  // this test is about what reaches the solver at mount, not about rendering.
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

  it("forwards all eight documented fields, defaulting the ones not passed", () => {
    mount({ gravity: 0.1 });
    expect(setParamsCalls[0]).toEqual({
      repulsion: 900,
      linkDistance: 78,
      gravity: 0.1,
      damping: 0.62,
      cursorForce: 0,
      sectorForce: 0,
      radiusForce: 0,
      settle: 0,
    });
  });

  it("forwards gravity and damping again when the prop changes after mount", () => {
    mount({ gravity: 0.1 });
    setParamsCalls.length = 0;
    mount({ gravity: 0.2, damping: 0.4 });
    expect(setParamsCalls[setParamsCalls.length - 1]).toEqual({
      repulsion: 900,
      linkDistance: 78,
      gravity: 0.2,
      damping: 0.4,
      cursorForce: 0,
      sectorForce: 0,
      radiusForce: 0,
      settle: 0,
    });
  });
});

describe("GraphCanvas layout seed and structure", () => {
  it("seeds the layout from the node ids when no seed is given", () => {
    mount();
    expect(createCalls.at(-1)!.options).toEqual({
      seed: seedFromIds(nodes.map((node) => node.id)),
    });
  });

  it("draws the same starting layout on every mount of the same graph", () => {
    mount();
    act(() => root.unmount());
    root = createRoot(container);
    mount();
    expect(createCalls).toHaveLength(2);
    expect(createCalls[1]!.startPositions).toEqual(createCalls[0]!.startPositions);
  });

  it("passes an explicit seed through unchanged", () => {
    mount(undefined, { seed: 42 });
    expect(createCalls.at(-1)!.options).toEqual({ seed: 42 });
  });

  it("leaves the solver unseeded for seed={null}", () => {
    mount(undefined, { seed: null });
    expect(createCalls.at(-1)!.options).toEqual({});
  });

  it("rebuilds the scene when the seed changes", () => {
    mount(undefined, { seed: 1 });
    mount(undefined, { seed: 2 });
    expect(createCalls.map((call) => call.options)).toEqual([{ seed: 1 }, { seed: 2 }]);
  });

  it("gives a node's own sectorAngle/radiusTarget precedence over its category's, and omits absent ones", () => {
    mount(undefined, {
      nodeCategories: {
        atlas: { ...nodeCategories["atlas"]!, sectorAngle: 1, radiusTarget: 100 },
      },
      nodes: [
        { id: "a", categoryId: "atlas", label: "A", sectorAngle: 2 },
        { id: "b", categoryId: "atlas", label: "B", radiusTarget: 300 },
        { id: "c", categoryId: "atlas", label: "C" },
      ],
      edges: [],
    });
    expect(createCalls.at(-1)!.graph.nodes).toEqual([
      { charge: 1, mass: 1, sectorAngle: 2, radiusTarget: 100 },
      { charge: 1, mass: 1, sectorAngle: 1, radiusTarget: 300 },
      { charge: 1, mass: 1, sectorAngle: 1, radiusTarget: 100 },
    ]);
  });

  it("forwards sectorForce and radiusForce, on mount and on change", () => {
    mount({ sectorForce: 0.02 });
    expect(setParamsCalls[0]).toMatchObject({ sectorForce: 0.02, radiusForce: 0 });
    mount({ sectorForce: 0.02, radiusForce: 0.05 });
    expect(setParamsCalls.at(-1)).toMatchObject({ sectorForce: 0.02, radiusForce: 0.05 });
  });

  it("reseeds the live solver through the controller without rebuilding the scene", () => {
    const ref = createRef<GraphController>();
    mount(undefined, { ref } as Partial<GraphCanvasProps>);
    const before = createCalls.length;
    act(() => ref.current!.reseed());
    expect(reseedCalls).toBe(1);
    expect(createCalls).toHaveLength(before);
    expect(renderers).toHaveLength(1);
  });
});

describe("GraphCanvas camera wiring", () => {
  const calls = (name: string) => rigCalls.filter((call) => call[0] === name);

  it("opens with the intro, sweeping unless reduced motion is on", () => {
    mount();
    expect(calls("intro")).toEqual([["intro", false]]);
  });

  it("does not frame the initial selection over the intro", () => {
    mount(undefined, { selectedId: "a" });
    expect(calls("frameAround")).toEqual([]);
  });

  it("frames a new selection with its neighbours, and releases on deselect", () => {
    mount();
    mount(undefined, { selectedId: "a" });
    expect(calls("frameAround")).toEqual([["frameAround", 0, [1]]]);
    mount(undefined, { selectedId: null });
    expect(calls("release")).toHaveLength(1);
  });

  it("leaves the camera alone on selection with followSelection={false}", () => {
    mount(undefined, { followSelection: false });
    mount(undefined, { followSelection: false, selectedId: "a" });
    mount(undefined, { followSelection: false, selectedId: null });
    expect(calls("frameAround")).toEqual([]);
    expect(calls("release")).toEqual([]);
  });

  it("asks for a re-frame when fitInset changes, and not when it is merely re-created", () => {
    mount(undefined, { fitInset: { right: 300 } });
    const after = calls("reframe").length;
    mount(undefined, { fitInset: { right: 300 } });
    expect(calls("reframe")).toHaveLength(after);
    mount(undefined, { fitInset: { right: 120 } });
    expect(calls("reframe")).toHaveLength(after + 1);
  });

  it("routes the controller's fit, focus and reseed to the rig", () => {
    const ref = createRef<GraphController>();
    mount(undefined, { ref } as Partial<GraphCanvasProps>);
    act(() => {
      ref.current!.fit();
      ref.current!.focus("b");
      ref.current!.focus("no-such-id");
      ref.current!.reseed();
    });
    expect(calls("fit")).toHaveLength(1);
    expect(calls("focus")).toEqual([["focus", 1]]);
    expect(calls("reseed")).toEqual([["reseed", false]]);
  });
});

describe("GraphCanvas history: controller.back() and canGoBack", () => {
  it("goes back through selection changes, restoring each earlier selection through onSelect", () => {
    const ref = createRef<GraphController>();
    const onSelect = vi.fn();
    const props = { ref, onSelect } as Partial<GraphCanvasProps>;
    mount(undefined, { ...props, selectedId: "a" });
    expect(ref.current!.canGoBack).toBe(false);

    mount(undefined, { ...props, selectedId: "b" });
    mount(undefined, { ...props, selectedId: null });
    expect(ref.current!.canGoBack).toBe(true);

    act(() => ref.current!.back());
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "b" }), "controller");
    act(() => ref.current!.back());
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }), "controller");
    expect(ref.current!.canGoBack).toBe(false);
  });

  it("starts with no history when mounted with a selection", () => {
    const ref = createRef<GraphController>();
    mount(undefined, { ref, selectedId: "b" } as Partial<GraphCanvasProps>);
    expect(ref.current!.canGoBack).toBe(false);
  });
});

describe("GraphCanvas keyboard and screen-reader navigation", () => {
  const focusTarget = () =>
    container.querySelector<HTMLButtonElement>("button[data-nx-graph-focus]");
  const spoken = () => container.querySelector("[aria-live]")!.textContent!.replace(/\u200b/g, "");
  const press = (key: string) =>
    act(() => {
      focusTarget()!.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    });
  const props = (extra: Partial<GraphCanvasProps> = {}) =>
    ({
      ariaLabel: "Test graph",
      linkCategories: {
        refs: { ...linkCategories["refs"]!, verb: "refers to", inverseVerb: "referred to by" },
      },
      ...extra,
    }) as Partial<GraphCanvasProps>;

  it("names the focus target as soon as it mounts, before any interaction", () => {
    mount(undefined, props());
    expect(focusTarget()!.getAttribute("aria-label")).toBe("A, atlas, 1 connection");
    expect(focusTarget()!.getAttribute("aria-pressed")).toBe("false");
  });

  it("offers one focus target that speaks a summary and the node on the way in", () => {
    mount(undefined, props());
    expect(container.querySelectorAll("button")).toHaveLength(1);
    act(() => focusTarget()!.focus());
    expect(spoken()).toBe("Graph, 2 nodes, 1 connection in 1 kind. A, atlas, 1 connection");
    expect(focusTarget()!.getAttribute("aria-label")).toBe("A, atlas, 1 connection");
  });

  it("browses with the arrows, follows with Enter, and goes back with Backspace", () => {
    const onNavigate = vi.fn();
    mount(undefined, props({ onNavigate }));
    act(() => focusTarget()!.focus());
    press("ArrowRight");
    expect(spoken()).toBe("refers to B, atlas. 1 of 1");
    press("Enter");
    expect(spoken()).toBe("B, atlas, 1 connection");
    expect(onNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "follow", node: expect.objectContaining({ id: "b" }) }),
    );
    press("ArrowRight");
    expect(spoken()).toBe("referred to by A, atlas. 1 of 1");
    press("Backspace");
    expect(spoken()).toBe("Back to A, atlas, 1 connection");
  });

  it("selects with Space through onSelect, and Escape steps out in stages", () => {
    const onSelect = vi.fn();
    mount(undefined, props({ onSelect }));
    act(() => focusTarget()!.focus());
    press(" ");
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }), "keyboard");
    expect(focusTarget()!.getAttribute("aria-pressed")).toBe("true");
    press("Escape");
    expect(onSelect).toHaveBeenLastCalledWith(null, "keyboard");
    press("Escape");
    const group = container.querySelector<HTMLElement>('[role="group"]')!;
    expect(document.activeElement).toBe(group);
  });

  it("selects when a screen reader activates the focus target with a click", () => {
    const onSelect = vi.fn();
    mount(undefined, props({ onSelect }));
    act(() => focusTarget()!.focus());
    act(() => focusTarget()!.click());
    // A screen reader's click is a keyboard selection: the reader is still in the graph.
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }), "keyboard");
    expect(spoken()).toBe("Selected");
  });

  it("after stepping out, the next Tab leaves the graph instead of re-entering it", () => {
    mount(undefined, props());
    act(() => focusTarget()!.focus());
    press("Escape");
    const group = container.querySelector<HTMLElement>('[role="group"]')!;
    expect(document.activeElement).toBe(group);
    expect(focusTarget()!.tabIndex).toBe(-1);
    act(() => group.blur());
    expect(focusTarget()!.tabIndex).toBe(0);
    act(() => focusTarget()!.focus());
    press("Escape");
    expect(focusTarget()!.tabIndex).toBe(-1);
    act(() => {
      container.querySelector("canvas")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(focusTarget()!.tabIndex).toBe(0);
  });

  it("speaks the connections the reader can reach, not ones a filter hides", () => {
    mount(undefined, props({ hiddenLinkCategories: ["refs"] }));
    act(() => focusTarget()!.focus());
    expect(focusTarget()!.getAttribute("aria-label")).toBe("A, atlas, 0 connections");
  });

  it("only rebuilds the focus target's name when something it depends on changes", () => {
    const describeNode = vi.fn((node: { label: string }) => node.label);
    mount(undefined, props({ describeNode }));
    act(() => focusTarget()!.focus());
    const calls = describeNode.mock.calls.length;
    // "?" toggles help, which changes nothing describeNode depends on.
    for (let k = 0; k < 5; k++) press("?");
    expect(describeNode.mock.calls.length).toBe(calls);
    press(" ");
    expect(describeNode.mock.calls.length).toBeGreaterThan(calls);
  });

  it("lists a self-loop from both ends in getNode(), as 1.x did", () => {
    const ref = createRef<GraphController>();
    mount(undefined, {
      ...props(),
      ref,
      edges: [
        { a: "a", b: "b", categoryId: "refs" },
        { a: "a", b: "a", categoryId: "refs" },
      ],
    } as Partial<GraphCanvasProps>);
    const rows = ref.current!.getNode("a")!.groups[0]!.rows;
    expect(rows.map((row) => [row.id, row.out])).toEqual([
      ["a", true],
      ["a", false],
      ["b", true],
    ]);
  });

  it("uses describeNode and rankConnections when given", () => {
    mount(
      undefined,
      props({
        describeNode: (node, ctx) => `${node.label} (${ctx.connections})`,
        rankConnections: () => 0,
      }),
    );
    act(() => focusTarget()!.focus());
    expect(spoken()).toMatch(/A \(1\)$/);
  });

  it("focusNode() puts the reader on a node and moves focus into the graph", () => {
    const ref = createRef<GraphController>();
    mount(undefined, { ...props(), ref } as Partial<GraphCanvasProps>);
    act(() => ref.current!.focusNode("b"));
    expect(document.activeElement).toBe(focusTarget());
    expect(spoken()).toBe("B, atlas, 1 connection");
    expect(ref.current!.canGoBack).toBe(true);
  });

  it("renders no focus target with keyboardNavigation={false}", () => {
    mount(undefined, props({ keyboardNavigation: false }));
    expect(focusTarget()).toBeNull();
  });

  it("warns when keyboard navigation is on and the graph has no name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(undefined, { ariaLabel: undefined });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no ariaLabel/));
  });

  it("mounts an empty graph, named for the graph, and keys on it are harmless", () => {
    const onFatal = vi.fn();
    mount(undefined, props({ nodes: [], edges: [], onFatal }));
    expect(onFatal).not.toHaveBeenCalled();
    expect(focusTarget()!.getAttribute("aria-label")).toBe(
      "Graph, 0 nodes, 0 connections in 0 kinds.",
    );
    act(() => focusTarget()!.focus());
    for (const key of ["ArrowRight", "ArrowDown", "Enter", " ", "Home", "d"]) press(key);
    expect(spoken()).toBe("Graph, 0 nodes, 0 connections in 0 kinds.");
    expect(onFatal).not.toHaveBeenCalled();
  });

  it("mounts with every category hidden, and lands on a node once one is shown", () => {
    const onFatal = vi.fn();
    mount(undefined, props({ hiddenNodeCategories: Object.keys(nodeCategories), onFatal }));
    expect(onFatal).not.toHaveBeenCalled();
    expect(focusTarget()!.getAttribute("aria-label")).toMatch(/^Graph, 0 nodes/);
    mount(undefined, props({ hiddenNodeCategories: [], onFatal }));
    expect(focusTarget()!.getAttribute("aria-label")).toBe("A, atlas, 1 connection");
  });

  it("keeps that warning out of production builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mount(undefined, { ariaLabel: undefined });
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/no ariaLabel/));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("GraphCanvas boot and teardown", () => {
  // The component reports a thrown boot through console.error as well as
  // onFatal; silenced so a passing run reads clean, and asserted on below.
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects an edge to an unknown node id before constructing a WebGLRenderer", () => {
    const onFatal = vi.fn();
    mount(undefined, { edges: [{ a: "a", b: "zzz", categoryId: "refs" }], onFatal });
    expect(renderers).toHaveLength(0);
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(onFatal.mock.calls[0]![0]).toBe(
      'GraphCanvas: edges[0].b references unknown node id "zzz"',
    );
    expect(container.textContent).toContain("SYSTEM HALT");
    expect(container.querySelector("canvas")).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it.each([
    [
      "a duplicate node id",
      { nodes: [...nodes, { id: "a", categoryId: "atlas", label: "A again" }] },
      'GraphCanvas: nodes[2] duplicates id "a"',
    ],
    [
      "a node category missing from nodeCategories",
      { nodes: [{ id: "a", categoryId: "ghost", label: "A" }], edges: [] },
      'GraphCanvas: nodes[0] has categoryId "ghost", which is not in nodeCategories',
    ],
    [
      "an edge category missing from linkCategories",
      { edges: [{ a: "a", b: "b", categoryId: "ghost" }] },
      'GraphCanvas: edges[0] has categoryId "ghost", which is not in linkCategories',
    ],
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          labelLayer = container.firstElementChild!.children[1]!;
          throw new Error("no ResizeObserver here");
        }
      },
    );
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

    act(() => {
      canvas.dispatchEvent(new Event("webglcontextlost"));
    });

    expect(cancel).toHaveBeenCalledWith(7);
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(onFatal).toHaveBeenCalledWith("WebGL context lost");
    expect(container.textContent).toContain("SYSTEM HALT");
  });
});
