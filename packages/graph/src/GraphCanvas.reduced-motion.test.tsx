/**
 * Mounts a real React tree, like GraphCanvas.physics.test.tsx, so it opts into
 * jsdom per-file. The frame loop is driven by hand: requestAnimationFrame is
 * stubbed to capture the callback, and the test invokes it once per assertion,
 * so what lands in the uniforms is observed directly rather than inferred.
 *
 * Started as the reduced-motion suite and grew into the one that inspects the
 * scene a mount builds — materials, meshes, the per-edge buffers — and what
 * the frame loop hands back (stats, onFrame). The physics file covers what
 * reaches the solver and the camera rig; this one covers what reaches the GPU.
 *
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import { COMPOSITE_FS, EDGE_FS, EDGE_VS, FADE_FS, NODE_FS, PAD_FS } from "./shaders.js";
import { OneFactor, OneMinusSrcAlphaFactor } from "three";
import type * as ThreeModule from "three";
import type { GraphCanvasProps, LinkCategory, NodeCategory } from "./types.js";

type Uniforms = Record<string, { value: unknown }>;

/** Every RawShaderMaterial built during a test, keyed by its fragment source. */
const materials = new Map<string, { uniforms: Uniforms }>();
/** Every mesh built during a test. */
const meshes: ThreeModule.Mesh[] = [];

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
    forceContextLoss() {}
  }
  class ObservedRawShaderMaterial extends actual.RawShaderMaterial {
    constructor(params: ConstructorParameters<typeof actual.RawShaderMaterial>[0]) {
      super(params);
      if (params?.fragmentShader)
        materials.set(params.fragmentShader, this as unknown as { uniforms: Uniforms });
    }
  }
  class ObservedMesh extends actual.Mesh {
    constructor(...args: ConstructorParameters<typeof actual.Mesh>) {
      super(...args);
      meshes.push(this);
    }
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    RawShaderMaterial: ObservedRawShaderMaterial,
    Mesh: ObservedMesh,
  };
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
  { id: "a", categoryId: "atlas", label: "A", state: 2 as const },
  { id: "b", categoryId: "atlas", label: "B" },
];
const edges = [{ a: "a", b: "b", categoryId: "refs" }];

/** A hand-driven stand-in for the MediaQueryList jsdom does not provide. */
class FakeMediaQueryList {
  matches: boolean;
  private listeners = new Set<(ev: { matches: boolean }) => void>();
  constructor(matches: boolean) {
    this.matches = matches;
  }
  addEventListener(_type: "change", fn: (ev: { matches: boolean }) => void) {
    this.listeners.add(fn);
  }
  removeEventListener(_type: "change", fn: (ev: { matches: boolean }) => void) {
    this.listeners.delete(fn);
  }
  get listenerCount() {
    return this.listeners.size;
  }
  flip(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((fn) => fn({ matches }));
  }
}

let container: HTMLDivElement;
let root: Root;
let frame: ((now: number) => void) | null;
let now: number;

function tick() {
  const fn = frame;
  frame = null;
  now += 16;
  act(() => fn?.(now));
}

beforeEach(() => {
  materials.clear();
  meshes.length = 0;
  frame = null;
  now = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (fn: (now: number) => void) => {
    frame = fn;
    return 1;
  });
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

function mount(query: FakeMediaQueryList | null) {
  if (query)
    vi.stubGlobal("matchMedia", (q: string) => {
      expect(q).toBe("(prefers-reduced-motion: reduce)");
      return query;
    });
  act(() => {
    root.render(
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        optics={{ glitch: 1, grain: 0.6, trails: 0.5 }}
      />,
    );
  });
  const canvas = container.querySelector("canvas");
  if (!canvas) throw new Error("canvas did not mount");
  return {
    canvas,
    edge: materials.get(EDGE_FS)!.uniforms,
    node: materials.get(NODE_FS)!.uniforms,
    fade: materials.get(FADE_FS)!.uniforms,
    comp: materials.get(COMPOSITE_FS)!.uniforms,
  };
}

describe("GraphCanvas prefers-reduced-motion", () => {
  it("mounts with motion when matchMedia is undefined (jsdom, SSR)", () => {
    expect(typeof window.matchMedia).toBe("undefined");
    const { canvas, comp } = mount(null);
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("false");
    expect(comp.uReduced!.value).toBe(0);
    // The intro glitch flourish is scheduled at boot; the uniform carries it.
    expect(comp.uGlitch!.value).toBe(1);
  });

  it("zeroes the composite uniforms and flags the canvas when reduce is set at mount", () => {
    const { canvas, edge, node, fade, comp } = mount(new FakeMediaQueryList(true));
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("true");
    expect(edge.uReduced!.value).toBe(1);
    expect(comp.uReduced!.value).toBe(1);
    expect(comp.uGlitch!.value).toBe(0);
    expect(node.uReduced!.value).toBe(1);
    expect(fade.uReduced!.value).toBe(1);
  });

  it("follows a change of the media query without a remount", () => {
    const query = new FakeMediaQueryList(false);
    const { canvas, comp } = mount(query);
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("false");
    expect(comp.uReduced!.value).toBe(0);

    query.flip(true);
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("true");
    expect(comp.uReduced!.value).toBe(1);
    expect(comp.uGlitch!.value).toBe(0);

    query.flip(false);
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("false");
    expect(comp.uReduced!.value).toBe(0);
  });

  it("unsubscribes from the media query on unmount", () => {
    const query = new FakeMediaQueryList(false);
    mount(query);
    expect(query.listenerCount).toBe(1);
    act(() => root.unmount());
    expect(query.listenerCount).toBe(0);
  });
});

describe("bounding spheres", () => {
  // three reads `boundingSphere` while projecting the scene to depth-sort,
  // even for a mesh with frustumCulled = false, and computes it lazily if it
  // is missing. From a 2-component `position` attribute that comes out NaN and
  // logs an error on every boot. The renderer is mocked here, so do what it
  // would: use the sphere if there is one, compute it if not.
  it("leaves every mesh with a usable bounding sphere, so three never has to compute a NaN one", () => {
    mount(new FakeMediaQueryList(false));

    expect(meshes.length).toBeGreaterThanOrEqual(4);
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      expect(Number.isNaN(geometry.boundingSphere!.radius)).toBe(false);
    }
  });
});

describe("edge pipeline", () => {
  function mountGraph() {
    act(() => {
      root.render(
        <GraphCanvas
          nodes={[
            { id: "a", categoryId: "atlas", label: "A" },
            { id: "b", categoryId: "atlas", label: "B" },
            { id: "c", categoryId: "atlas", label: "C" },
          ]}
          edges={[
            { a: "a", b: "b", categoryId: "uses" },
            { a: "b", b: "c", categoryId: "pairs", absentEnd: "b" },
            { a: "c", b: "a", categoryId: "cites", absentEnd: "a" },
          ]}
          nodeCategories={nodeCategories}
          linkCategories={{
            uses: { label: "USES", color: "#ffffff", width: 1, dist: 1, strength: 1, gain: 0.55 },
            pairs: {
              label: "PAIRS",
              color: "#ffffff",
              width: 1,
              dist: 1,
              strength: 1,
              routing: "etched",
              directed: false,
            },
            cites: {
              label: "CITES",
              color: "#ffffff",
              width: 1,
              dist: 1,
              strength: 1,
              routing: "arc",
              gain: 1.2,
            },
          }}
        />,
      );
    });
    const byFs = (fs: string) =>
      meshes.filter((m) => (m.material as { fragmentShader?: string }).fragmentShader === fs);
    return { edges: byFs(EDGE_FS), pads: byFs(PAD_FS) };
  }

  it("draws edges in two passes and pads between them, under the nodes", () => {
    const { edges, pads } = mountGraph();
    expect(edges.map((m) => m.renderOrder).sort()).toEqual([0, 2]);
    expect(pads.map((m) => m.renderOrder)).toEqual([1]);
    const node = meshes.find(
      (m) => (m.material as { fragmentShader?: string }).fragmentShader === NODE_FS,
    )!;
    expect(node.renderOrder).toBe(3);
  });

  it("composites the resting pass and adds the live one", () => {
    const { edges } = mountGraph();
    const resting = edges.find((m) => m.renderOrder === 0)!.material as ThreeModule.Material;
    const live = edges.find((m) => m.renderOrder === 2)!.material as ThreeModule.Material;
    expect(resting.blendDst).toBe(OneMinusSrcAlphaFactor);
    expect(live.blendDst).toBe(OneFactor);
  });

  it("encodes routing, signed gain, fray and a symmetric end trim per edge", () => {
    const { edges, pads } = mountGraph();
    const geo = edges[0]!.geometry;
    const p0 = geo.getAttribute("iP0").array as Float32Array;
    const p1 = geo.getAttribute("iP1").array as Float32Array;
    const p2 = geo.getAttribute("iP2").array as Float32Array;
    expect(geo.getAttribute("iP2").itemSize).toBe(4);
    // uses: straight, directed, gain 0.55
    expect(p0[1]).toBe(0);
    expect(p0[3]).toBeCloseTo(0.55);
    // pairs: etched, undirected (negative gain), b end absent
    expect(p0[5]).toBe(-1000);
    expect(p0[7]).toBe(-1);
    expect(p2[4 + 3]).toBe(1);
    // cites: arc. Arcs alternate sides by index; index 2 is even, so it bows positive.
    expect(p0[9]).toBeGreaterThan(0);
    expect(p0[11]).toBeCloseTo(1.2);
    expect(p2[8 + 3]).toBe(2);
    // Both ends trimmed by the same multiple of their node's radius.
    expect(p1[2]! / p1[3]!).toBeCloseTo(1);
    // The pads read the very same instance buffers.
    expect(pads[0]!.geometry.getAttribute("iP2")).toBe(geo.getAttribute("iP2"));
    expect(pads[0]!.geometry.getAttribute("iP0")).toBe(geo.getAttribute("iP0"));
  });
});

describe("props from qrntn: drop mode, scoped links, drawnNodes, onFrame", () => {
  const cats: Record<string, LinkCategory> = {
    refs: { label: "REFS", color: "#ffffff", width: 1, dist: 1, strength: 1 },
    sim: { label: "SIM", color: "#ffffff", width: 1, dist: 1, strength: 1 },
  };
  const threeNodes = [
    { id: "a", categoryId: "atlas", label: "A" },
    { id: "b", categoryId: "atlas", label: "B" },
    { id: "c", categoryId: "atlas", label: "C" },
  ];
  function mountWith(props: Partial<GraphCanvasProps>) {
    act(() => {
      root.render(
        <GraphCanvas
          nodes={threeNodes}
          edges={[]}
          nodeCategories={nodeCategories}
          linkCategories={cats}
          {...props}
        />,
      );
    });
  }
  /** The per-edge hide flags (iP2.y) the edge shader reads. */
  function hiddenFlags(): number[] {
    const mesh = meshes.find(
      (m) => (m.material as { fragmentShader?: string }).fragmentShader === EDGE_FS,
    )!;
    const p2 = mesh.geometry.getAttribute("iP2").array as Float32Array;
    return Array.from({ length: p2.length / 4 }, (_, e) => p2[e * 4 + 1]!);
  }
  const runFrames = (k: number) => {
    for (let i = 0; i < k; i++) tick();
  };

  it('invalidEdges="drop" draws the rest and reports what it dropped through onWarning', () => {
    const onWarning = vi.fn();
    const onFatal = vi.fn();
    mountWith({
      edges: [
        { a: "a", b: "b", categoryId: "refs" },
        { a: "a", b: "gone", categoryId: "refs" },
      ],
      invalidEdges: "drop",
      onWarning,
      onFatal,
    });
    expect(onFatal).not.toHaveBeenCalled();
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0]![0]).toMatch(/dropped 1 edge/);
    expect(onWarning.mock.calls[0]![1].dropped).toEqual([
      { index: 1, edge: { a: "a", b: "gone", categoryId: "refs" }, end: "b" },
    ]);
    expect(hiddenFlags()).toHaveLength(1);
  });

  it("falls back to console.warn when no onWarning is given, so a drop is never silent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountWith({ edges: [{ a: "zzz", b: "b", categoryId: "refs" }], invalidEdges: "drop" });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/dropped 1 edge/), expect.any(Array));
  });

  it("shows a selection-scoped category only on edges touching the selected node", () => {
    const edges = [
      { a: "a", b: "b", categoryId: "refs" },
      { a: "a", b: "b", categoryId: "sim" },
      { a: "b", b: "c", categoryId: "sim" },
    ];
    mountWith({ edges, selectionScopedLinkCategories: ["sim"] });
    expect(hiddenFlags()).toEqual([0, 1, 1]);
    mountWith({ edges, selectionScopedLinkCategories: ["sim"], selectedId: "c" });
    expect(hiddenFlags()).toEqual([0, 1, 0]);
    mountWith({ edges, selectionScopedLinkCategories: ["sim"], selectedId: null });
    expect(hiddenFlags()).toEqual([0, 1, 1]);
  });

  it("reports drawnNodes after hidden categories and isolation", () => {
    // tick() hands out timestamps from 0; the engine's start time comes from
    // performance.now(), so pin it there or every frame's dt is negative.
    vi.spyOn(performance, "now").mockReturnValue(0);
    const onStats = vi.fn();
    mountWith({
      edges: [{ a: "a", b: "b", categoryId: "refs" }],
      isolateId: "a",
      onStats,
    });
    runFrames(40);
    const last = onStats.mock.calls.at(-1)![0];
    // Isolating "a" keeps it and its one neighbour.
    expect(last).toMatchObject({ nodes: 3, drawnNodes: 2 });
  });

  it("calls onFrame every frame with live geometry, through the latest callback", () => {
    const first = vi.fn();
    mountWith({ onFrame: first });
    tick();
    expect(first).toHaveBeenCalledTimes(1);
    const g = first.mock.calls[0]![0];
    expect(g.ids).toEqual(["a", "b", "c"]);
    expect(g.positions).toHaveLength(6);
    expect(g.radii).toHaveLength(3);
    expect(g.camera.zoom).toBeGreaterThan(0);
    // One object, refilled every frame: nothing for the collector per frame.
    tick();
    expect(first.mock.calls[1]![0]).toBe(g);
    expect(first.mock.calls[1]![0].camera).toBe(g.camera);
    first.mockClear();
    const second = vi.fn();
    mountWith({ onFrame: second });
    tick();
    expect(second).toHaveBeenCalledTimes(1);
    // The old callback isn't called again once it is replaced.
    expect(first).not.toHaveBeenCalled();
  });
});

describe("shader sources", () => {
  // Structural guard on the GLSL: the uniform has to be declared and used in
  // every program that reads it, or the value the test above observes on the
  // JS side never reaches a pixel.
  it.each([
    ["EDGE_VS", EDGE_VS],
    ["EDGE_FS", EDGE_FS],
    ["NODE_FS", NODE_FS],
    ["FADE_FS", FADE_FS],
    ["COMPOSITE_FS", COMPOSITE_FS],
  ])("%s declares and reads uReduced", (_name, src) => {
    expect(src).toMatch(/uniform float[^;]*\buReduced\b/);
    expect(src.split("uReduced").length).toBeGreaterThan(2);
  });
});
