import * as THREE from "three";
import {
  NODE_VS,
  NODE_FS,
  EDGE_VS,
  EDGE_FS,
  PAD_VS,
  PAD_FS,
  EDGE_ATTRS,
  FADE_VS,
  FADE_FS,
} from "./shaders.js";
import type { EdgeBuffers, NodeBuffers } from "./buffers.js";
import type { OpticsConfig } from "./types.js";

// Not from @nexus-cyberdeck/tokens: this package can't assume `--nx-*` properties exist.
export const FALLBACK_BG = "#08090A";

const RIBBON_SEGMENTS = 24;

// Vertices are placed in the shader, so three would compute a NaN bounding sphere from the attributes.
export const unbounded = (geometry: THREE.BufferGeometry): void => {
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
};

const dynamicAttribute = (values: Float32Array, size: number) => {
  const attribute = new THREE.InstancedBufferAttribute(values, size);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
};
const staticAttribute = (values: Float32Array, size: number) =>
  new THREE.InstancedBufferAttribute(values, size);

/** What every mesh builder reads: where meshes go and the optics they start from. */
export interface MeshContext {
  scene: THREE.Scene;
  optics: OpticsConfig;
  edgeCount: number;
}

/** Wraps the packed edge arrays without copying; endpoints and `iP2` are dynamic. */
export function createEdgeAttributes(buffers: EdgeBuffers) {
  const edgeAAttribute = dynamicAttribute(buffers.edgeAPositions, 2),
    edgeBAttribute = dynamicAttribute(buffers.edgeBPositions, 2),
    edgeParams2Attribute = dynamicAttribute(buffers.edgeParams2, EDGE_ATTRS.iP2);
  const edgeParams0Attribute = staticAttribute(buffers.edgeParams0, EDGE_ATTRS.iP0),
    edgeParams1Attribute = staticAttribute(buffers.edgeParams1, EDGE_ATTRS.iP1),
    edgeColorAttribute = staticAttribute(buffers.edgeColors, 3);
  return {
    edgeAAttribute,
    edgeBAttribute,
    edgeParams2Attribute,
    edgeParams0Attribute,
    edgeParams1Attribute,
    edgeColorAttribute,
  };
}

/** Per-edge attributes, shared by the edge ribbons and the end pads. */
export type EdgeAttributes = ReturnType<typeof createEdgeAttributes>;

function setEdgeInstances(
  geometry: THREE.InstancedBufferGeometry,
  attributes: EdgeAttributes,
  edgeCount: number,
): void {
  geometry.setAttribute("iA", attributes.edgeAAttribute);
  geometry.setAttribute("iB", attributes.edgeBAttribute);
  geometry.setAttribute("iColor", attributes.edgeColorAttribute);
  geometry.setAttribute("iP0", attributes.edgeParams0Attribute);
  geometry.setAttribute("iP1", attributes.edgeParams1Attribute);
  geometry.setAttribute("iP2", attributes.edgeParams2Attribute);
  geometry.instanceCount = edgeCount;
  unbounded(geometry);
}

function addMesh(
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  renderOrder: number,
): void {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  scene.add(mesh);
}

function ribbonGeometry(attributes: EdgeAttributes, edgeCount: number) {
  const ribbonVertices = new Float32Array((RIBBON_SEGMENTS + 1) * 4);
  const ribbonIndices: number[] = [];
  for (let s = 0; s <= RIBBON_SEGMENTS; s++) {
    const t = s / RIBBON_SEGMENTS;
    ribbonVertices[s * 4] = t;
    ribbonVertices[s * 4 + 1] = -1;
    ribbonVertices[s * 4 + 2] = t;
    ribbonVertices[s * 4 + 3] = 1;
  }
  for (let s = 0; s < RIBBON_SEGMENTS; s++) {
    const base = s * 2;
    ribbonIndices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const edgeGeometry = new THREE.InstancedBufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.BufferAttribute(ribbonVertices, 2));
  edgeGeometry.setIndex(ribbonIndices);
  setEdgeInstances(edgeGeometry, attributes, edgeCount);
  return edgeGeometry;
}

const edgeUniforms = (optics: OpticsConfig, pass: number) => ({
  uPx: { value: 1 },
  uWidth: { value: optics.edgeWidth },
  uTime: { value: 0 },
  uOpacity: { value: optics.edgeOpacity },
  uFlowSpeed: { value: optics.flowSpeed },
  uFocus: { value: 0 },
  uSignal: { value: 1 },
  uPass: { value: pass },
  uReduced: { value: 0 },
});

/** The resting (order 0) and live (order 2) edge passes over one ribbon geometry. */
export function buildEdges(context: MeshContext, attributes: EdgeAttributes) {
  const { scene, optics, edgeCount } = context;
  const edgeGeometry = ribbonGeometry(attributes, edgeCount);
  // Resting edges composite so crossings don't sum to white; live edges stay additive to bloom.
  // DoubleSide: the ribbon's winding flips with the bow's direction.
  const edgeMaterial = new THREE.RawShaderMaterial({
    vertexShader: EDGE_VS,
    fragmentShader: EDGE_FS,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: edgeUniforms(optics, 0),
  });
  addMesh(scene, edgeGeometry, edgeMaterial, 0);
  const edgeLiveMaterial = new THREE.RawShaderMaterial({
    vertexShader: EDGE_VS,
    fragmentShader: EDGE_FS,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: edgeUniforms(optics, 1),
  });
  addMesh(scene, edgeGeometry, edgeLiveMaterial, 2);
  return { edgeGeometry, edgeMaterial, edgeLiveMaterial };
}

function padGeometryFor(attributes: EdgeAttributes, edgeCount: number) {
  const padGeometry = new THREE.InstancedBufferGeometry();
  const padVertices = new Float32Array(8 * 3);
  const padIndices: number[] = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;
  for (let end = 0; end < 2; end++) {
    const base = end * 4;
    for (let c = 0; c < 4; c++) {
      padVertices[(base + c) * 3] = corners[c]![0];
      padVertices[(base + c) * 3 + 1] = corners[c]![1];
      padVertices[(base + c) * 3 + 2] = end;
    }
    padIndices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  padGeometry.setAttribute("aPad", new THREE.BufferAttribute(padVertices, 3));
  padGeometry.setIndex(padIndices);
  setEdgeInstances(padGeometry, attributes, edgeCount);
  return padGeometry;
}

/** The end pads, two quads per edge, drawn between resting and live edges. */
export function buildPads(context: MeshContext, attributes: EdgeAttributes) {
  const { scene, optics, edgeCount } = context;
  const padGeometry = padGeometryFor(attributes, edgeCount);
  const padMaterial = new THREE.RawShaderMaterial({
    vertexShader: PAD_VS,
    fragmentShader: PAD_FS,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uPx: { value: 1 },
      uWidth: { value: optics.edgeWidth },
      uOpacity: { value: optics.edgeOpacity },
      uFocus: { value: 0 },
    },
  });
  addMesh(scene, padGeometry, padMaterial, 1); // fade -10 < edges 0 < pads 1 < live edges 2 < nodes 3
  return { padGeometry, padMaterial };
}

export type NodeArrays = Pick<
  NodeBuffers,
  | "nodeRadii"
  | "nodeShapes"
  | "nodeSeeds"
  | "nodeColors"
  | "nodeDepths"
  | "nodeMarks"
  | "nodeHidden"
>;

export interface NodeInput {
  /** Read by reference: `syncNodes` copies their current values into the GPU params. */
  buffers: NodeArrays;
  nodeStates: Uint8Array;
  /** The live solver positions, 2 floats per node. */
  positions: Float32Array;
  nodeCount: number;
}

function nodeAttributes(input: NodeInput) {
  const { buffers, nodeStates, positions, nodeCount } = input;
  const { nodeRadii, nodeShapes, nodeSeeds, nodeDepths, nodeMarks, nodeHidden } = buffers;
  const nodeParams0 = new Float32Array(nodeCount * 4),
    nodeParams1 = new Float32Array(nodeCount * 4);
  for (let i = 0; i < nodeCount; i++) {
    nodeParams0[i * 4] = nodeRadii[i]!;
    nodeParams0[i * 4 + 1] = nodeShapes[i]!;
    nodeParams0[i * 4 + 2] = nodeSeeds[i]!;
    nodeParams1[i * 4] = nodeStates[i]!;
  }
  const positionAttribute = dynamicAttribute(positions, 2),
    nodeParams0Attribute = dynamicAttribute(nodeParams0, 4),
    nodeParams1Attribute = dynamicAttribute(nodeParams1, 4);
  function syncNodes() {
    for (let i = 0; i < nodeCount; i++) {
      nodeParams0[i * 4 + 3] = nodeDepths[i]!;
      nodeParams1[i * 4 + 1] = nodeMarks[i]!;
      nodeParams1[i * 4 + 2] = nodeHidden[i]!;
    }
    nodeParams0Attribute.needsUpdate = true;
    nodeParams1Attribute.needsUpdate = true;
  }
  syncNodes();
  return { positionAttribute, nodeParams0Attribute, nodeParams1Attribute, syncNodes };
}

/**
 * The node glyphs, drawn last (order 3). Returns `syncNodes`, which re-reads
 * depth, mark and hidden into the GPU params; it has already run once.
 */
export function buildNodes(context: MeshContext, input: NodeInput) {
  const { scene, optics } = context;
  const nodeGeometry = new THREE.InstancedBufferGeometry();
  nodeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2),
  );
  nodeGeometry.setIndex([0, 1, 2, 2, 1, 3]);
  const { positionAttribute, nodeParams0Attribute, nodeParams1Attribute, syncNodes } =
    nodeAttributes(input);
  nodeGeometry.setAttribute("iPos", positionAttribute);
  nodeGeometry.setAttribute("iColor", staticAttribute(input.buffers.nodeColors, 3));
  nodeGeometry.setAttribute("iN0", nodeParams0Attribute);
  nodeGeometry.setAttribute("iN1", nodeParams1Attribute);
  nodeGeometry.instanceCount = input.nodeCount;
  unbounded(nodeGeometry);
  const nodeMaterial = new THREE.RawShaderMaterial({
    vertexShader: NODE_VS,
    fragmentShader: NODE_FS,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: 1 },
      uHlStart: { value: -999 },
      uGlow: { value: optics.glow },
      uFocus: { value: 0 },
      uReduced: { value: 0 },
    },
  });
  addMesh(scene, nodeGeometry, nodeMaterial, 3);
  return { nodeGeometry, nodeMaterial, positionAttribute, syncNodes };
}

/** The full-screen fade that leaves trails, drawn first (order -10). */
export function buildFade(scene: THREE.Scene) {
  const backgroundColor = new THREE.Color(FALLBACK_BG);
  const fadeGeometry = new THREE.BufferGeometry();
  fadeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
  );
  unbounded(fadeGeometry);
  const fadeMaterial = new THREE.RawShaderMaterial({
    vertexShader: FADE_VS,
    fragmentShader: FADE_FS,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uColor: {
        value: new THREE.Vector3(backgroundColor.r, backgroundColor.g, backgroundColor.b),
      },
      uAlpha: { value: 1 },
      uReduced: { value: 0 },
    },
  });
  addMesh(scene, fadeGeometry, fadeMaterial, -10);
  return { fadeGeometry, fadeMaterial };
}
