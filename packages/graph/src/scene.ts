import * as THREE from "three";
import {
  buildEdges,
  buildFade,
  buildNodes,
  buildPads,
  createEdgeAttributes,
  FALLBACK_BG,
  unbounded,
} from "./scene-meshes.js";
import { BLUR_FS, COMPOSITE_FS, POST_VS } from "./shaders.js";
import type { NodeArrays } from "./scene-meshes.js";
import type { EdgeBuffers } from "./buffers.js";
import type { OpticsConfig } from "./types.js";

// Four full-screen passes at dpr 2 cost a lot of fill the CRT grain hides anyway.
const MAX_DPR = 1.6;

/** Pushes a release onto the caller's disposal stack, which drains in reverse. */
export type Track = (release: () => void) => void;

export interface RendererParts {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
}

/**
 * Builds the renderer, appends its canvas to `mountEl`, and creates the main
 * scene and camera. Unseeded, the Scene's and Camera's uuids draw from
 * `Math.random`, so the caller packs its random-seeded buffers after this.
 */
export function createRenderer(mountEl: HTMLElement, track: Track): RendererParts {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setClearColor(new THREE.Color(FALLBACK_BG), 1);
  renderer.autoClear = false;
  mountEl.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "display:block;touch-action:none;width:100%;height:100%";
  track(() => {
    renderer.dispose();
    // Frees the context now; under StrictMode or HMR waiting for GC hits the browser's context cap.
    renderer.forceContextLoss();
    renderer.domElement.remove();
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 5;
  return { renderer, scene, camera };
}

function createTargets() {
  const renderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const sceneTarget = new THREE.WebGLRenderTarget(2, 2, renderTargetOptions);
  const bloomA = new THREE.WebGLRenderTarget(2, 2, renderTargetOptions);
  const bloomB = new THREE.WebGLRenderTarget(2, 2, renderTargetOptions);
  return { sceneTarget, bloomA, bloomB };
}

function screenTriangle() {
  const screenGeometry = new THREE.BufferGeometry();
  screenGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
  );
  screenGeometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  );
  return screenGeometry;
}

/**
 * The post-process: a scene target, two bloom targets at a third of its size,
 * and one full-screen triangle that swaps between the blur and composite.
 */
export function buildPost(optics: OpticsConfig) {
  const targets = createTargets();
  const screenGeometry = screenTriangle();
  const blurMaterial = new THREE.RawShaderMaterial({
    vertexShader: POST_VS,
    fragmentShader: BLUR_FS,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTex: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uDir: { value: new THREE.Vector2(1, 0) },
      uThresh: { value: 0.34 },
    },
  });
  const compositeMaterial = new THREE.RawShaderMaterial({
    vertexShader: POST_VS,
    fragmentShader: COMPOSITE_FS,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uScene: { value: null },
      uBloom: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uScan: { value: optics.scan },
      uAberr: { value: optics.aberr },
      uCurve: { value: optics.curve },
      uGrain: { value: optics.grain },
      uBloomAmt: { value: optics.bloom },
      uGlitch: { value: 0 },
      uReduced: { value: 0 },
    },
  });
  unbounded(screenGeometry);
  const screenQuad = new THREE.Mesh(screenGeometry, compositeMaterial);
  screenQuad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(screenQuad);
  const postCamera = new THREE.Camera();
  return {
    ...targets,
    screenGeometry,
    blurMaterial,
    compositeMaterial,
    screenQuad,
    postScene,
    postCamera,
  };
}

export interface SceneInput {
  scene: THREE.Scene;
  /** Read by reference; the caller mutates depth, mark, hidden and `edgeParams2` in place. */
  buffers: NodeArrays & EdgeBuffers;
  nodeStates: Uint8Array;
  /** The live solver positions, 2 floats per node. */
  positions: Float32Array;
  nodeCount: number;
  edgeCount: number;
  optics: OpticsConfig;
  track: Track;
}

/**
 * Builds the meshes into `input.scene` and the post-process around them, then
 * tracks three releases in order: render targets, materials, geometries.
 */
export function createScene(input: SceneInput) {
  const { scene, buffers, optics, edgeCount, track } = input;
  const context = { scene, optics, edgeCount };
  const edgeAttributes = createEdgeAttributes(buffers);
  const { edgeGeometry, edgeMaterial, edgeLiveMaterial } = buildEdges(context, edgeAttributes);
  const { padGeometry, padMaterial } = buildPads(context, edgeAttributes);
  const { nodeGeometry, nodeMaterial, positionAttribute, syncNodes } = buildNodes(context, input);
  const { fadeGeometry, fadeMaterial } = buildFade(scene);
  const post = buildPost(optics);
  const { sceneTarget, bloomA, bloomB, screenGeometry, blurMaterial, compositeMaterial } = post;
  track(() => [sceneTarget, bloomA, bloomB].forEach((target) => target.dispose()));
  track(() =>
    [
      nodeMaterial,
      edgeMaterial,
      edgeLiveMaterial,
      padMaterial,
      fadeMaterial,
      blurMaterial,
      compositeMaterial,
    ].forEach((material) => material.dispose()),
  );
  track(() =>
    [nodeGeometry, edgeGeometry, padGeometry, fadeGeometry, screenGeometry].forEach((geometry) =>
      geometry.dispose(),
    ),
  );
  return {
    ...post,
    edgeMaterial,
    edgeLiveMaterial,
    padMaterial,
    nodeMaterial,
    fadeMaterial,
    edgeAAttribute: edgeAttributes.edgeAAttribute,
    edgeBAttribute: edgeAttributes.edgeBAttribute,
    edgeParams2Attribute: edgeAttributes.edgeParams2Attribute,
    positionAttribute,
    syncNodes,
    bufferSize: new THREE.Vector2(),
  };
}

export type SceneParts = ReturnType<typeof createScene>;

/**
 * Sizes the canvas, camera and render targets to `width` x `height` CSS
 * pixels; the bloom targets get a third of the drawing buffer, at least 2.
 */
export function resize(
  stage: RendererParts,
  parts: SceneParts,
  width: number,
  height: number,
): void {
  const { renderer, camera } = stage;
  const { sceneTarget, bloomA, bloomB, compositeMaterial, blurMaterial, bufferSize } = parts;
  // devicePixelRatio changes with zoom or a move to another display.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  // updateStyle must stay on, or the canvas lays out at viewWidth*dpr and overlays misalign.
  renderer.setSize(width, height);
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(bufferSize);
  const bufferWidth = Math.max(2, bufferSize.x | 0),
    bufferHeight = Math.max(2, bufferSize.y | 0);
  sceneTarget.setSize(bufferWidth, bufferHeight);
  const bloomWidth = Math.max(2, (bufferWidth / 3) | 0),
    bloomHeight = Math.max(2, (bufferHeight / 3) | 0);
  bloomA.setSize(bloomWidth, bloomHeight);
  bloomB.setSize(bloomWidth, bloomHeight);
  compositeMaterial.uniforms.uRes!.value.set(bufferWidth, bufferHeight);
  blurMaterial.uniforms.uTexel!.value.set(1 / bloomWidth, 1 / bloomHeight);
  renderer.setRenderTarget(sceneTarget);
  renderer.clear();
  renderer.setRenderTarget(null);
}
