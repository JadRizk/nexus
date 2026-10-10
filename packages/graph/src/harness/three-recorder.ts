import type * as Three from "three";
import * as shaders from "../shaders.js";
import { formatNumber, hashBytes, stableJson } from "./serialise.js";

type ThreeModule = typeof Three;

/** Shader source → its export name, so a mesh reads as `EDGE_FS`, not as GLSL. */
const SHADER_NAMES = new Map<unknown, string>(
  Object.entries(shaders).map(([name, source]) => [source, name] as const),
);

function shaderName(material: Three.Material): string {
  const source = "fragmentShader" in material ? material.fragmentShader : undefined;
  return SHADER_NAMES.get(source) ?? material.type;
}

function isMesh(object: Three.Object3D): object is Three.Mesh {
  return "isMesh" in object;
}

function formatVector(value: { toArray(): number[] }): string {
  return `[${value.toArray().map(formatNumber).join(",")}]`;
}

/**
 * Everything three was asked to do since the last drain. Render-time state
 * (uniforms, attributes, cameras) accumulates in one map that only ever
 * overwrites, so a field that stops changing stops appearing in the diff.
 */
class Recording {
  private events: string[] = [];
  private calls: string[] = [];
  private passes = 0;
  private state = new Map<string, string>();
  private names = new Map<object, string>();
  private counts = new Map<string, number>();
  /** Attribute version at the last frame drain; the recording shows the delta. */
  private versions = new Map<Three.BufferAttribute, number>();
  private owners = new Map<Three.BufferAttribute, string>();

  reset() {
    this.events = [];
    this.calls = [];
    this.passes = 0;
    this.state = new Map();
    this.names = new Map();
    this.counts = new Map();
    this.versions = new Map();
    this.owners = new Map();
  }

  event(line: string) {
    this.events.push(line);
  }

  call(line: string) {
    this.calls.push(line);
  }

  /** A stable name by first sighting: `rt0`, `g2`, `tex0`. */
  name(kind: string, object: object): string {
    const known = this.names.get(object);
    if (known !== undefined) return known;
    const count = this.counts.get(kind) ?? 0;
    this.counts.set(kind, count + 1);
    const name = `${kind}${count}`;
    this.names.set(object, name);
    return name;
  }

  target(target: Three.WebGLRenderTarget, width: number, height: number) {
    const name = this.name("rt", target);
    this.names.set(target.texture, `${name}.texture`);
    this.event(`create ${name} ${width}x${height}`);
  }

  /** Called from `render()`, so uniforms are read as the draw saw them, not at frame end. */
  pass(target: string, scene: Three.Scene, camera: Three.Camera) {
    const prefix = `p${this.passes++}`;
    this.state.set(`${prefix}.target`, target);
    const view = [...camera.projectionMatrix.elements, ...camera.position.toArray()];
    this.state.set(`${prefix}.camera`, view.map(formatNumber).join(","));
    const meshes = scene.children.filter(isMesh).sort((a, b) => a.renderOrder - b.renderOrder);
    for (const mesh of meshes) this.mesh(prefix, mesh);
  }

  /** Events since the last drain; a step drains these alone and leaves the frame state open. */
  drainEvents(): string[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  drainFrame(): { events: string[]; state: ReadonlyMap<string, string> } {
    this.state.set("renderer.calls", this.calls.length > 0 ? this.calls.join(" ") : "none");
    this.calls = [];
    this.passes = 0;
    for (const attribute of this.versions.keys()) this.versions.set(attribute, attribute.version);
    return { events: this.drainEvents(), state: this.state };
  }

  private mesh(prefix: string, mesh: Three.Mesh) {
    const material = mesh.material as Three.ShaderMaterial;
    const geometry = mesh.geometry as Partial<Three.InstancedBufferGeometry> & Three.BufferGeometry;
    const key = `${prefix}.${shaderName(material)}@${mesh.renderOrder}`;
    const geometryName = this.name("g", geometry);
    const instances = geometry.instanceCount ?? "-";
    const { start, count } = geometry.drawRange;
    this.state.set(
      key,
      `visible=${mesh.visible} ${geometryName} instances=${instances} range=${start}+${count}`,
    );
    for (const [name, uniform] of Object.entries(material.uniforms)) {
      this.state.set(`${key}.${name}`, this.format(uniform.value));
    }
    this.geometry(geometryName, geometry);
  }

  /** An attribute shared by two geometries is written under the first and pointed at from the second. */
  private geometry(name: string, geometry: Three.BufferGeometry) {
    for (const [attributeName, attribute] of Object.entries(geometry.attributes)) {
      if (!("isBufferAttribute" in attribute)) continue;
      const key = `${name}.${attributeName}`;
      const owner = this.owners.get(attribute) ?? key;
      this.owners.set(attribute, owner);
      if (owner !== key) {
        this.state.set(key, `same as ${owner}`);
        continue;
      }
      const delta = attribute.version - (this.versions.get(attribute) ?? 0);
      if (!this.versions.has(attribute)) this.versions.set(attribute, 0);
      this.state.set(key, `+${delta} ${hashBytes(attribute.array)}`);
    }
  }

  private format(value: unknown): string {
    if (typeof value === "number") return formatNumber(value);
    if (value === null || typeof value !== "object") return String(value);
    if ("isTexture" in value) return this.name("tex", value);
    if ("isColor" in value) return `#${(value as Three.Color).getHexString()}`;
    if ("toArray" in value) return formatVector(value as Three.Vector4);
    if (ArrayBuffer.isView(value)) return `#${hashBytes(value)}`;
    return stableJson(value);
  }
}

export const recording = new Recording();

/** Stands in for `WebGLRenderer`, the one part of three that needs a GL context. */
class RecordingRenderer {
  readonly domElement = document.createElement("canvas");
  autoClear = true;
  readonly capabilities = { isWebGL2: true };
  private width = 0;
  private height = 0;
  private pixelRatio = 1;
  private target = "screen";

  setPixelRatio(ratio: number) {
    this.pixelRatio = ratio;
    recording.event(`renderer.setPixelRatio ${ratio}`);
  }
  setClearColor(color: Three.Color, alpha: number) {
    recording.event(`renderer.setClearColor #${color.getHexString()} ${alpha}`);
  }
  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    recording.event(`renderer.setSize ${width} ${height}`);
  }
  getDrawingBufferSize(out: Three.Vector2) {
    return out.set(this.width * this.pixelRatio, this.height * this.pixelRatio);
  }
  setRenderTarget(target: Three.WebGLRenderTarget | null) {
    this.target = target ? recording.name("rt", target) : "screen";
    recording.call(`target:${this.target}`);
  }
  clear() {
    recording.call("clear");
  }
  render(scene: Three.Scene, camera: Three.Camera) {
    recording.call("render");
    recording.pass(this.target, scene, camera);
  }
  getContext() {
    return { MAX_VERTEX_ATTRIBS: 0x8869, getParameter: () => 16 };
  }
  dispose() {
    recording.event("renderer.dispose");
  }
  forceContextLoss() {
    recording.event("renderer.forceContextLoss");
  }
}

function recordingTarget(actual: ThreeModule) {
  return class RecordingTarget extends actual.WebGLRenderTarget {
    constructor(...args: ConstructorParameters<typeof actual.WebGLRenderTarget>) {
      super(...args);
      recording.target(this, args[0] ?? 1, args[1] ?? 1);
    }
    override setSize(width: number, height: number, depth?: number) {
      recording.event(`${recording.name("rt", this)}.setSize ${width} ${height}`);
      super.setSize(width, height, depth);
    }
    override dispose() {
      recording.event(`dispose ${recording.name("rt", this)}`);
      super.dispose();
    }
  };
}

/** Dispose order is part of the contract, so materials and geometries log theirs too. */
function patchDispose(actual: ThreeModule) {
  const disposeMaterial = actual.Material.prototype.dispose;
  actual.Material.prototype.dispose = function (this: Three.Material) {
    recording.event(`dispose ${shaderName(this)}`);
    disposeMaterial.call(this);
  };
  const disposeGeometry = actual.BufferGeometry.prototype.dispose;
  actual.BufferGeometry.prototype.dispose = function (this: Three.BufferGeometry) {
    recording.event(`dispose ${recording.name("g", this)}`);
    disposeGeometry.call(this);
  };
}

/** The `vi.mock("three")` factory body: three as it is, with the GL boundary recorded. */
export function mockThree(actual: ThreeModule): ThreeModule {
  patchDispose(actual);
  return {
    ...actual,
    WebGLRenderer: RecordingRenderer as unknown as ThreeModule["WebGLRenderer"],
    WebGLRenderTarget: recordingTarget(actual) as unknown as ThreeModule["WebGLRenderTarget"],
  };
}
