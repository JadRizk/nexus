/**
 * Mounts a real React tree, like GraphCanvas.physics.test.tsx, so it opts into
 * jsdom per-file. The frame loop is driven by hand: requestAnimationFrame is
 * stubbed to capture the callback, and the test invokes it once per assertion,
 * so what lands in the uniforms is observed directly rather than inferred.
 *
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "./GraphCanvas.js";
import { COMPOSITE_FS, FADE_FS, NODE_FS } from "./shaders.js";
import type * as ThreeModule from "three";
import type { LinkCategory, NodeCategory } from "./types.js";

type Uniforms = Record<string, { value: unknown }>;

/** Every RawShaderMaterial built during a test, keyed by its fragment source. */
const materials = new Map<string, { uniforms: Uniforms }>();

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
  class ObservedRawShaderMaterial extends actual.RawShaderMaterial {
    constructor(params: ConstructorParameters<typeof actual.RawShaderMaterial>[0]) {
      super(params);
      if (params?.fragmentShader) materials.set(params.fragmentShader, this as unknown as { uniforms: Uniforms });
    }
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer, RawShaderMaterial: ObservedRawShaderMaterial };
});

const nodeCategories: Record<string, NodeCategory> = {
  atlas: { label: "ATLAS", shape: 0, color: "#9EFF3D", code: "ATL", size: 7, charge: 1, mass: 1, tier: 0 },
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
  constructor(matches: boolean) { this.matches = matches; }
  addEventListener(_type: "change", fn: (ev: { matches: boolean }) => void) { this.listeners.add(fn); }
  removeEventListener(_type: "change", fn: (ev: { matches: boolean }) => void) { this.listeners.delete(fn); }
  get listenerCount() { return this.listeners.size; }
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
  frame = null;
  now = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() { } unobserve() { } disconnect() { } });
  vi.stubGlobal("requestAnimationFrame", (fn: (now: number) => void) => { frame = fn; return 1; });
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

function mount(query: FakeMediaQueryList | null) {
  if (query) vi.stubGlobal("matchMedia", (q: string) => {
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
    const { canvas, node, fade, comp } = mount(new FakeMediaQueryList(true));
    tick();
    expect(canvas.dataset.nxReducedMotion).toBe("true");
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

describe("shader sources", () => {
  // Structural guard on the GLSL: the uniform has to be declared and used in
  // every program that reads it, or the value the test above observes on the
  // JS side never reaches a pixel.
  it.each([["NODE_FS", NODE_FS], ["FADE_FS", FADE_FS], ["COMPOSITE_FS", COMPOSITE_FS]])(
    "%s declares and reads uReduced", (_name, src) => {
      expect(src).toMatch(/uniform float[^;]*\buReduced\b/);
      expect(src.split("uReduced").length).toBeGreaterThan(2);
    },
  );
});
