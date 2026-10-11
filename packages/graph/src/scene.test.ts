/**
 * @vitest-environment jsdom
 *
 * What the harness doesn't record: renderer options, culling and bounds,
 * the order of disposal entries, and the call order inside `resize`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createRenderer, createScene, resize } from "./scene.js";
import type { SceneInput } from "./scene.js";
import { createLabelLayer } from "./label-layer.js";
import type { OpticsConfig } from "./types.js";

const fake = vi.hoisted(() => ({ calls: [] as string[], options: [] as unknown[] }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  const log =
    (name: string) =>
    (...args: unknown[]) => {
      fake.calls.push(
        `${name}(${args.map((arg) => (arg === null ? "null" : typeof arg === "object" ? "obj" : String(arg))).join(",")})`,
      );
    };
  class WebGLRenderer {
    domElement = document.createElement("canvas");
    autoClear = true;
    constructor(options: unknown) {
      fake.options.push(options);
    }
    setPixelRatio = log("setPixelRatio");
    setClearColor = log("setClearColor");
    setSize = log("setSize");
    setRenderTarget = log("setRenderTarget");
    clear = log("clear");
    dispose = log("dispose");
    forceContextLoss = log("forceContextLoss");
    getDrawingBufferSize(target: THREE.Vector2) {
      fake.calls.push("getDrawingBufferSize");
      return target.set(301, 151);
    }
  }
  return { ...actual, WebGLRenderer };
});

const OPTICS: OpticsConfig = {
  glow: 0.8,
  trails: 0.16,
  edgeOpacity: 0.4,
  edgeWidth: 1.3,
  flowSpeed: 0.24,
  scan: 0.55,
  aberr: 0.5,
  curve: 0.55,
  grain: 0.45,
  bloom: 0.85,
  glitch: 0.5,
};

function sceneInput(scene: THREE.Scene, track: SceneInput["track"]): SceneInput {
  const nodeCount = 2,
    edgeCount = 1;
  return {
    scene,
    buffers: {
      nodeRadii: new Float32Array([3, 4]),
      nodeShapes: new Float32Array([1, 2]),
      nodeSeeds: new Float32Array([0.25, 0.5]),
      nodeColors: new Float32Array(nodeCount * 3),
      nodeDepths: new Float32Array([-1, -1]),
      nodeMarks: new Float32Array([0, 0]),
      nodeHidden: new Float32Array([0, 0]),
      edgeAPositions: new Float32Array(edgeCount * 2),
      edgeBPositions: new Float32Array(edgeCount * 2),
      edgeColors: new Float32Array(edgeCount * 3),
      edgeParams0: new Float32Array(edgeCount * 4),
      edgeParams1: new Float32Array(edgeCount * 4),
      edgeParams2: new Float32Array(edgeCount * 4),
    },
    nodeStates: new Uint8Array([1, 3]),
    positions: new Float32Array(nodeCount * 2),
    nodeCount,
    edgeCount,
    optics: OPTICS,
    track,
  };
}

beforeEach(() => {
  fake.calls.length = 0;
  fake.options.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRenderer", () => {
  it("asks for an antialiased, opaque, high-performance context and clears by hand", () => {
    const mount = document.createElement("div");
    const { renderer } = createRenderer(mount, () => {});
    expect(fake.options).toEqual([
      { antialias: true, alpha: false, powerPreference: "high-performance" },
    ]);
    expect(renderer.autoClear).toBe(false);
    expect(mount.firstChild).toBe(renderer.domElement);
  });

  it("tracks one release that disposes, drops the context, then removes the canvas", () => {
    const mount = document.createElement("div");
    const releases: (() => void)[] = [];
    createRenderer(mount, (release) => releases.push(release));
    expect(releases).toHaveLength(1);
    fake.calls.length = 0;
    releases[0]?.();
    expect(fake.calls).toEqual(["dispose()", "forceContextLoss()"]);
    expect(mount.childElementCount).toBe(0);
  });
});

describe("createScene", () => {
  it("adds edges, live edges, pads, nodes and fade in that order, none culled or bounded", () => {
    const scene = new THREE.Scene();
    const { screenQuad } = createScene(sceneInput(scene, () => {}));
    const meshes = [...(scene.children as THREE.Mesh[]), screenQuad];
    expect(scene.children.map((mesh) => mesh.renderOrder)).toEqual([0, 2, 1, 3, -10]);
    for (const mesh of meshes) {
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.geometry.boundingSphere?.radius).toBe(Infinity);
    }
  });

  it("tracks targets, then materials, then geometries, each in its fixed inner order", () => {
    const scene = new THREE.Scene();
    const releases: (() => void)[] = [];
    const parts = createScene(sceneInput(scene, (release) => releases.push(release)));
    const disposed: unknown[] = [];
    const record = function (this: unknown) {
      disposed.push(this);
    };
    vi.spyOn(THREE.WebGLRenderTarget.prototype, "dispose").mockImplementation(record);
    vi.spyOn(THREE.Material.prototype, "dispose").mockImplementation(record);
    vi.spyOn(THREE.BufferGeometry.prototype, "dispose").mockImplementation(record);
    const [edge, , pad, node, fade] = scene.children as [
      THREE.Mesh,
      THREE.Mesh,
      THREE.Mesh,
      THREE.Mesh,
      THREE.Mesh,
    ];

    expect(releases).toHaveLength(3);
    releases[0]?.();
    expect(disposed).toEqual([parts.sceneTarget, parts.bloomA, parts.bloomB]);
    disposed.length = 0;
    releases[1]?.();
    expect(disposed).toEqual([
      parts.nodeMaterial,
      parts.edgeMaterial,
      parts.edgeLiveMaterial,
      parts.padMaterial,
      parts.fadeMaterial,
      parts.blurMaterial,
      parts.compositeMaterial,
    ]);
    disposed.length = 0;
    releases[2]?.();
    expect(disposed).toEqual([
      node.geometry,
      edge.geometry,
      pad.geometry,
      fade.geometry,
      parts.screenQuad.geometry,
    ]);
  });

  it("syncs node params once while building and again from the caller's arrays", () => {
    const scene = new THREE.Scene();
    const input = sceneInput(scene, () => {});
    input.buffers.nodeDepths[1] = 2;
    const { syncNodes } = createScene(input);
    const node = scene.children[3] as THREE.Mesh;
    const params0 = node.geometry.getAttribute("iN0") as THREE.InstancedBufferAttribute;
    const params1 = node.geometry.getAttribute("iN1") as THREE.InstancedBufferAttribute;
    expect(Array.from(params0.array)).toEqual([3, 1, 0.25, -1, 4, 2, 0.5, 2]);
    expect(Array.from(params1.array)).toEqual([1, 0, 0, 0, 3, 0, 0, 0]);
    const versions = [params0.version, params1.version];

    input.buffers.nodeMarks[0] = 1;
    input.buffers.nodeHidden[1] = 1;
    syncNodes();
    expect(Array.from(params1.array)).toEqual([1, 1, 0, 0, 3, 0, 1, 0]);
    expect([params0.version, params1.version]).toEqual(versions.map((version) => version + 1));
  });
});

describe("resize", () => {
  it("sizes the renderer, camera and targets in a fixed order, then clears the scene target", () => {
    const stage = createRenderer(document.createElement("div"), () => {});
    const parts = createScene(sceneInput(stage.scene, () => {}));
    fake.calls.length = 0;
    resize(stage, parts, 400, 200);
    expect(fake.calls).toEqual([
      `setPixelRatio(${Math.min(window.devicePixelRatio, 1.6)})`,
      "setSize(400,200)",
      "getDrawingBufferSize",
      "setRenderTarget(obj)",
      "clear()",
      "setRenderTarget(null)",
    ]);
    expect([stage.camera.left, stage.camera.right, stage.camera.top, stage.camera.bottom]).toEqual([
      -200, 200, 100, -100,
    ]);
    expect([parts.sceneTarget.width, parts.sceneTarget.height]).toEqual([301, 151]);
    expect([parts.bloomA.width, parts.bloomA.height]).toEqual([100, 50]);
    expect([parts.bloomB.width, parts.bloomB.height]).toEqual([100, 50]);
    expect(parts.compositeMaterial.uniforms.uRes?.value.toArray()).toEqual([301, 151]);
    expect(parts.blurMaterial.uniforms.uTexel?.value.toArray()).toEqual([1 / 100, 1 / 50]);
  });
});

describe("boot's disposal stack", () => {
  it("holds six entries: renderer, targets, materials, geometries, labels, tooltip", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const mount = document.createElement("div"),
      labelEl = document.createElement("div");
    const entries: string[] = [];
    let owner = "renderer";
    const track = () => {
      entries.push(owner);
    };
    const stage = createRenderer(mount, track);
    owner = "scene";
    createScene(sceneInput(stage.scene, track));
    owner = "labels";
    createLabelLayer(labelEl, track);
    expect(entries).toEqual(["renderer", "scene", "scene", "scene", "labels", "labels"]);
  });
});
