import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { createPhysics, computeDegree } from "./physics.js";
import { project, unproject, glyphRadiusPx } from "./camera.js";
import type { Viewport } from "./camera.js";
import {
  NODE_VS, NODE_FS, EDGE_VS, EDGE_FS, FADE_VS, FADE_FS, POST_VS, BLUR_FS, COMPOSITE_FS,
} from "./shaders.js";
import { STATE_LABEL, ORPHAN_STATE, TIER_ZOOM } from "./types.js";
import type {
  GraphCanvasProps, GraphController, GraphNodeSnapshot, GraphStats, PhysicsConfig, OpticsConfig,
} from "./types.js";

/* ============================================================================
   GraphCanvas

   Ported from NexusCyberdeck.jsx's `boot()` — the physics/shader setup,
   render loop, interaction handlers, label pool and tooltip are structurally
   unchanged. What changed is exactly what had to: every lookup that used to
   read the module-global `NODE_TYPES`/`LINK_TYPES` tables now reads the
   `nodeCategories`/`linkCategories` props instead, node/edge `id`s (now
   arbitrary, caller-supplied) get resolved to dense internal indices once
   per graph, and the imperative `nodeOn`/`linkOn`/`isolate`/`selected`
   state the original parent component owned directly are now controlled
   props flowing in through refs, the same pattern the original already used
   for `cfg`/`running`/`labelMode`.
   ========================================================================== */

// Deliberately not sourced from @nexus-cyberdeck/tokens — this package has no
// dependency on the rest of Nexus, so its one self-contained failure state
// can't assume `var(--nx-*)` custom properties exist.
const FALLBACK_BG = "#08090A";
const FALLBACK_FG = "#DFF5C7";
const FALLBACK_CRITICAL = "#FF2E63";
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

const DEFAULT_PHYSICS: PhysicsConfig = {
  repulsion: 900, linkDistance: 78, gravity: 0.028, damping: 0.62, cursorForce: 0, settle: 0,
};
const DEFAULT_OPTICS: OpticsConfig = {
  glow: 0.8, trails: 0.16, edgeOpacity: 0.5, edgeWidth: 2.4, flowSpeed: 0.24,
  scan: 0.55, aberr: 1.0, curve: 0.55, grain: 0.45, bloom: 0.85, glitch: 0.5,
};

const hex4 = (i: number): string => (((i * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

interface InternalController {
  params?: (p: Partial<PhysicsConfig>) => void;
  refilterInternal?: () => void;
  applySelectionInternal?: (index: number) => void;
  fit?: () => void;
  focus?: (index: number) => void;
  reheat?: (v: number) => void;
  getNodeByIndex?: (index: number) => GraphNodeSnapshot | null;
}

export const GraphCanvas = forwardRef<GraphController, GraphCanvasProps>(function GraphCanvas(props, ref) {
  const {
    nodes, edges, nodeCategories, linkCategories,
    physics: physicsProp, optics: opticsProp,
    labelMode = "auto",
    hiddenNodeCategories, hiddenLinkCategories, isolateId = null, selectedId = null,
    running = true,
    onSelect, onStats, onFatal,
    className, style,
  } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const api = useRef<InternalController>({});
  const [fatal, setFatal] = useState<string | null>(null);

  const physicsCfg: PhysicsConfig = { ...DEFAULT_PHYSICS, ...physicsProp };
  const opticsCfg: OpticsConfig = { ...DEFAULT_OPTICS, ...opticsProp };

  const opticsRef = useRef(opticsCfg); opticsRef.current = opticsCfg;
  const runRef = useRef(running); runRef.current = running;
  const labelModeRef = useRef(labelMode); labelModeRef.current = labelMode;
  const hiddenNodeRef = useRef(hiddenNodeCategories); hiddenNodeRef.current = hiddenNodeCategories;
  const hiddenLinkRef = useRef(hiddenLinkCategories); hiddenLinkRef.current = hiddenLinkCategories;
  const isolateRef = useRef(isolateId); isolateRef.current = isolateId;

  useImperativeHandle(ref, () => ({
    fit: () => api.current.fit?.(),
    focus: (id) => {
      const idx = idToIndexRef.current.get(id);
      if (idx !== undefined) api.current.focus?.(idx);
    },
    reheat: (v = 1.0) => api.current.reheat?.(v),
    getNode: (id) => {
      const idx = idToIndexRef.current.get(id);
      return idx !== undefined ? (api.current.getNodeByIndex?.(idx) ?? null) : null;
    },
  }), []);

  // Populated fresh by the mount effect below; read by the imperative handle
  // above between mounts, so it has to live outside the effect's closure.
  const idToIndexRef = useRef<Map<unknown, number>>(new Map());

  // Forwards every field of PhysicsConfig, not a subset: gravity and damping
  // are documented props too, and omitting them here left them permanently
  // pinned to the solver's own defaults. Depends on the fields rather than on
  // physicsCfg, which is a fresh object every render. On first mount this is
  // still a no-op — api.current.params does not exist until the mount effect
  // below has run — so boot() applies the initial config itself.
  useEffect(() => {
    api.current.params?.({
      repulsion: physicsCfg.repulsion, linkDistance: physicsCfg.linkDistance,
      gravity: physicsCfg.gravity, damping: physicsCfg.damping,
      cursorForce: physicsCfg.cursorForce, settle: physicsCfg.settle,
    });
  }, [
    physicsCfg.repulsion, physicsCfg.linkDistance, physicsCfg.gravity,
    physicsCfg.damping, physicsCfg.cursorForce, physicsCfg.settle,
  ]);

  useEffect(() => {
    api.current.refilterInternal?.();
  }, [hiddenNodeCategories, hiddenLinkCategories, isolateId]);

  useEffect(() => {
    const idx = selectedId === null ? -1 : (idToIndexRef.current.get(selectedId) ?? -1);
    api.current.applySelectionInternal?.(idx);
  }, [selectedId]);

  useEffect(() => {
    const mount = mountRef.current, lab = labelRef.current;
    if (!mount || !lab) return;
    let dispose = () => { };
    try { dispose = boot(mount, lab); }
    catch (err) {
      const message = String((err as Error)?.message ?? err);
      console.error(err);
      setFatal(message);
      onFatal?.(message);
    }
    return () => { try { dispose(); } catch (e) { console.error(e); } };

    function boot(mountEl: HTMLDivElement, labelEl: HTMLDivElement) {
      const n = nodes.length, m = edges.length;
      const idToIndex = new Map<unknown, number>(nodes.map((node, i) => [node.id, i]));
      idToIndexRef.current = idToIndex;

      const nCategoryId = nodes.map((node) => node.categoryId);
      const eCategoryId = edges.map((edge) => edge.categoryId);
      const linkCategoryIds = Object.keys(linkCategories);
      const eA = new Int32Array(m), eB = new Int32Array(m);
      for (let e = 0; e < m; e++) {
        eA[e] = idToIndex.get(edges[e]!.a) ?? -1;
        eB[e] = idToIndex.get(edges[e]!.b) ?? -1;
      }
      const degree = computeDegree(
        Array.from({ length: m }, (_, e) => ({ a: eA[e]!, b: eB[e]! })),
        n,
      );
      // A node with no edges is always ORPHAN, regardless of its declared
      // state — derived from graph structure the engine already has, not
      // something the caller needs to remember to set by hand.
      const nState = new Uint8Array(n);
      for (let i = 0; i < n; i++) nState[i] = degree[i] === 0 ? ORPHAN_STATE : (nodes[i]!.state ?? 1);

      const sim = createPhysics({
        nodes: nodes.map((node) => {
          const cat = nodeCategories[node.categoryId]!;
          return { charge: cat.charge, mass: cat.mass };
        }),
        edges: Array.from({ length: m }, (_, e) => {
          const cat = linkCategories[eCategoryId[e]!]!;
          return { a: eA[e]!, b: eB[e]!, dist: cat.dist, strength: cat.strength };
        }),
      });
      // The params effect above cannot reach the solver on the render that
      // creates it, so the initial `physics` prop has to be applied here or it
      // never lands. Numerically inert when the prop is absent: physicsCfg is
      // DEFAULT_PHYSICS, which matches the solver's own starting params, and
      // setParams' alpha floor of 0.28 is below the alpha of 1 a fresh solver
      // already has.
      sim.setParams(physicsCfg);
      const pos = sim.pos;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      // Four full-screen passes at dpr 2 is a lot of fill for little gain;
      // the CRT grille and grain hide the difference anyway.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearColor(new THREE.Color(FALLBACK_BG), 1);
      renderer.autoClear = false;
      mountEl.appendChild(renderer.domElement);
      renderer.domElement.style.cssText =
        "display:block;touch-action:none;width:100%;height:100%";

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      camera.position.z = 5;
      let camZoom = 1;

      const nRadius = new Float32Array(n), nShape = new Float32Array(n);
      const nColor = new Float32Array(n * 3), nSeed = new Float32Array(n);
      const nDepth = new Float32Array(n).fill(-1);
      const nSel = new Float32Array(n), nHide = new Float32Array(n);
      const tc = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const cat = nodeCategories[nCategoryId[i]!]!;
        nRadius[i] = cat.size * (1 + Math.min(1.4, Math.log2(1 + degree[i]!) * 0.16));
        nShape[i] = cat.shape; tc.set(cat.color);
        nColor[i * 3] = tc.r; nColor[i * 3 + 1] = tc.g; nColor[i * 3 + 2] = tc.b;
        nSeed[i] = Math.random();
      }
      const eAPos = new Float32Array(m * 2), eBPos = new Float32Array(m * 2);
      const eColor = new Float32Array(m * 3);
      const eP0 = new Float32Array(m * 4);   // width, curve, dash, arrow
      const eP1 = new Float32Array(m * 4);   // flow, seed, radA, radB
      const eP2 = new Float32Array(m * 3);   // active, hide, jitter
      const A_ACT = 0, A_HIDE = 1, A_JIT = 2;
      for (let e = 0; e < m; e++) {
        const cat = linkCategories[eCategoryId[e]!]!;
        tc.set(cat.color);
        eColor[e * 3] = tc.r; eColor[e * 3 + 1] = tc.g; eColor[e * 3 + 2] = tc.b;
        eP0[e * 4] = cat.width;
        eP0[e * 4 + 1] = (cat.curve ?? 0) * (e % 2 === 0 ? 1 : -1);
        eP0[e * 4 + 2] = cat.dash ?? 0;
        eP0[e * 4 + 3] = cat.arrow ? 1 : 0;
        eP1[e * 4] = cat.flow ?? 0;
        eP1[e * 4 + 1] = Math.random();
        eP1[e * 4 + 2] = nRadius[eA[e]!]! * 1.15;
        eP1[e * 4 + 3] = nRadius[eB[e]!]! * 1.45;
        eP2[e * 3 + A_JIT] = cat.jit ?? 0;
      }
      const dyn = (arr: Float32Array, size: number) => {
        const a = new THREE.InstancedBufferAttribute(arr, size);
        a.setUsage(THREE.DynamicDrawUsage); return a;
      };
      const stat = (arr: Float32Array, size: number) => new THREE.InstancedBufferAttribute(arr, size);

      const SEG = 24;
      const ev = new Float32Array((SEG + 1) * 4); const ei: number[] = [];
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        ev[s * 4] = t; ev[s * 4 + 1] = -1; ev[s * 4 + 2] = t; ev[s * 4 + 3] = 1;
      }
      for (let s = 0; s < SEG; s++) { const b = s * 2; ei.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
      const edgeGeo = new THREE.InstancedBufferGeometry();
      edgeGeo.setAttribute("position", new THREE.BufferAttribute(ev, 2));
      edgeGeo.setIndex(ei);
      const aEA = dyn(eAPos, 2), aEB = dyn(eBPos, 2), aEP2 = dyn(eP2, 3);
      edgeGeo.setAttribute("iA", aEA);
      edgeGeo.setAttribute("iB", aEB);
      edgeGeo.setAttribute("iColor", stat(eColor, 3));
      edgeGeo.setAttribute("iP0", stat(eP0, 4));
      edgeGeo.setAttribute("iP1", stat(eP1, 4));
      edgeGeo.setAttribute("iP2", aEP2);
      edgeGeo.instanceCount = m;
      const edgeMat = new THREE.RawShaderMaterial({
        vertexShader: EDGE_VS, fragmentShader: EDGE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: {
          uPx: { value: 1 }, uWidth: { value: opticsCfg.edgeWidth }, uTime: { value: 0 },
          uOpacity: { value: opticsCfg.edgeOpacity }, uFlowSpeed: { value: opticsCfg.flowSpeed }, uFocus: { value: 0 },
        },
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.frustumCulled = false; edgeMesh.renderOrder = 0; scene.add(edgeMesh);

      const nodeGeo = new THREE.InstancedBufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2));
      nodeGeo.setIndex([0, 1, 2, 2, 1, 3]);
      // The JS logic keeps its readable per-node arrays; syncNodes() mirrors
      // them into the packed GPU buffers so only the upload path changed.
      const nN0 = new Float32Array(n * 4), nN1 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        nN0[i * 4] = nRadius[i]!; nN0[i * 4 + 1] = nShape[i]!; nN0[i * 4 + 2] = nSeed[i]!;
        nN1[i * 4] = nState[i]!;
      }
      const aPos = dyn(pos, 2), aN0 = dyn(nN0, 4), aN1 = dyn(nN1, 4);
      function syncNodes() {
        for (let i = 0; i < n; i++) {
          nN0[i * 4 + 3] = nDepth[i]!;
          nN1[i * 4 + 1] = nSel[i]!;
          nN1[i * 4 + 2] = nHide[i]!;
        }
        aN0.needsUpdate = true; aN1.needsUpdate = true;
      }
      syncNodes();
      nodeGeo.setAttribute("iPos", aPos);
      nodeGeo.setAttribute("iColor", stat(nColor, 3));
      nodeGeo.setAttribute("iN0", aN0);
      nodeGeo.setAttribute("iN1", aN1);
      nodeGeo.instanceCount = n;
      const nodeMat = new THREE.RawShaderMaterial({
        vertexShader: NODE_VS, fragmentShader: NODE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: {
          uTime: { value: 0 }, uPx: { value: 1 }, uHlStart: { value: -999 },
          uGlow: { value: opticsCfg.glow }, uFocus: { value: 0 },
        },
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.frustumCulled = false; nodeMesh.renderOrder = 1; scene.add(nodeMesh);

      const vc = new THREE.Color(FALLBACK_BG);
      const fadeGeo = new THREE.BufferGeometry();
      fadeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
      const fadeMat = new THREE.RawShaderMaterial({
        vertexShader: FADE_VS, fragmentShader: FADE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Vector3(vc.r, vc.g, vc.b) }, uAlpha: { value: 1 } },
      });
      const fadeMesh = new THREE.Mesh(fadeGeo, fadeMat);
      fadeMesh.frustumCulled = false; fadeMesh.renderOrder = -10; scene.add(fadeMesh);

      const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
      const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
      const bloomA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
      const bloomB = new THREE.WebGLRenderTarget(2, 2, rtOpts);

      const fsGeo = new THREE.BufferGeometry();
      fsGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
      fsGeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
      const blurMat = new THREE.RawShaderMaterial({
        vertexShader: POST_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
        uniforms: {
          uTex: { value: null }, uTexel: { value: new THREE.Vector2() },
          uDir: { value: new THREE.Vector2(1, 0) }, uThresh: { value: 0.34 },
        },
      });
      const compMat = new THREE.RawShaderMaterial({
        vertexShader: POST_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
        uniforms: {
          uScene: { value: null }, uBloom: { value: null },
          uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
          uScan: { value: opticsCfg.scan }, uAberr: { value: opticsCfg.aberr }, uCurve: { value: opticsCfg.curve },
          uGrain: { value: opticsCfg.grain }, uBloomAmt: { value: opticsCfg.bloom }, uGlitch: { value: 0 },
        },
      });
      const fsQuad = new THREE.Mesh(fsGeo, compMat);
      fsQuad.frustumCulled = false;
      const postScene = new THREE.Scene(); postScene.add(fsQuad);
      const postCam = new THREE.Camera();

      /* --------------------------------------------------------- label pool */
      const POOL = 60;
      const labels: HTMLDivElement[] = [], owner = new Int32Array(POOL).fill(-1);
      for (let i = 0; i < POOL; i++) {
        const el = document.createElement("div");
        el.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;" +
          `font:600 9.5px/1 ${MONO};letter-spacing:.09em;text-transform:uppercase;` +
          "text-shadow:1px 0 rgba(255,46,99,.4),-1px 0 rgba(23,226,229,.4),0 0 7px rgba(0,0,0,.98);" +
          "transform:translate3d(-9999px,-9999px,0);will-change:transform;opacity:0;transition:opacity .1s";
        labelEl.appendChild(el);
        labels.push(el);
      }
      const LAB_H = 11;

      // Measure once per node instead of guessing from character count — the
      // collision test is only as good as the box it is given.
      const meas = document.createElement("canvas").getContext("2d")!;
      const wCache = new Float32Array(n).fill(-1);
      function labelWidth(i: number): number {
        if (wCache[i]! < 0) {
          const t = nodes[i]!.label;
          const key = nodeCategories[nCategoryId[i]!]!.tier === 0;
          meas.font = key ? `700 10.5px ${MONO}` : `500 9px ${MONO}`;
          wCache[i] = meas.measureText(t).width + t.length * (key ? 1.47 : 0.72) + 7;
        }
        return wCache[i]!;
      }

      // Imperative tooltip. Driving this through React state re-rendered the
      // whole tree on every pointermove — 60 reconciles a second while hovering.
      // Its chrome colours (border, secondary text) are hardcoded defaults,
      // same status as FALLBACK_BG above — this package has no theme system
      // of its own, only per-category colours the caller already supplies.
      const tip = document.createElement("div");
      tip.style.cssText =
        "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;max-width:270px;" +
        "overflow:hidden;text-overflow:ellipsis;background:rgba(8,10,9,.95);border:1px solid #1B2318;" +
        "border-left-width:2px;padding:4px 7px;font:600 9px/1.4 " + MONO + ";letter-spacing:.11em;" +
        "text-transform:uppercase;opacity:0;transition:opacity .1s;" +
        "transform:translate3d(-9999px,-9999px,0);will-change:transform;z-index:5";
      labelEl.appendChild(tip);

      let W = 1, H = 1, px = 1;
      const bufSize = new THREE.Vector2();
      const camT = { x: 0, y: 0, zoom: 1 };
      const viewport: Viewport = { width: 1, height: 1, curve: opticsCfg.curve };
      function resize() {
        W = mountEl.clientWidth || 1; H = mountEl.clientHeight || 1;
        viewport.width = W; viewport.height = H;
        // updateStyle must stay on: with it off three sets canvas.width = W*dpr
        // but no CSS size, so the element lays out at W*dpr and every DOM
        // overlay is in a coordinate space half the size of the canvas.
        renderer.setSize(W, H);
        camera.left = -W / 2; camera.right = W / 2;
        camera.top = H / 2; camera.bottom = -H / 2;
        camera.updateProjectionMatrix();
        renderer.getDrawingBufferSize(bufSize);
        const bw = Math.max(2, bufSize.x | 0), bh = Math.max(2, bufSize.y | 0);
        sceneRT.setSize(bw, bh);
        const sw = Math.max(2, (bw / 3) | 0), sh = Math.max(2, (bh / 3) | 0);
        bloomA.setSize(sw, sh); bloomB.setSize(sw, sh);
        compMat.uniforms.uRes!.value.set(bw, bh);
        blurMat.uniforms.uTexel!.value.set(1 / sw, 1 / sh);
        renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.setRenderTarget(null);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mountEl);
      // Intro animation: land on the usual density-based framing, but arrive
      // there from a wide pull-back instead of snapping straight to rest —
      // this is also what a reseed sees, since that remounts the whole scene.
      const introZoom = Math.min(2.2, Math.max(0.5, 420 / (Math.sqrt(n) * 14)));
      camT.zoom = introZoom;
      camZoom = Math.max(0.12, introZoom * 0.2);

      const OUT: [number, number] = [0, 0];
      const toWorld = (sx: number, sy: number) => {
        viewport.curve = opticsRef.current.curve;
        return unproject(sx, sy, camZoom, camera.position.x, camera.position.y, viewport);
      };

      const inc: Array<Array<{ e: number; other: number; categoryId: string; out: boolean }>> =
        Array.from({ length: n }, () => []);
      for (let e = 0; e < m; e++) {
        inc[eA[e]!]!.push({ e, other: eB[e]!, categoryId: eCategoryId[e]!, out: true });
        inc[eB[e]!]!.push({ e, other: eA[e]!, categoryId: eCategoryId[e]!, out: false });
      }

      let selIdx = -1, hoverIdx = -1, clock = 0, glitchUntil = -1, drawnLinks = m;

      // If the edge program ever fails to link again, this makes it obvious
      // instead of silent: compare slots used against what the driver allows.
      const glc = renderer.getContext();
      const glCaps = {
        attribs: glc.getParameter(glc.MAX_VERTEX_ATTRIBS) as number,
        ver: renderer.capabilities.isWebGL2 ? 2 : 1,
      };
      const kick = (d: number) => { glitchUntil = clock + d; };
      kick(0.8); // glitch flourish riding along with the intro pull-back

      function refilter() {
        const hiddenNode = new Set(hiddenNodeRef.current ?? []);
        const hiddenLink = new Set(hiddenLinkRef.current ?? []);
        const isoId = isolateRef.current;
        const iso = isoId === null || isoId === undefined ? -1 : (idToIndex.get(isoId) ?? -1);
        let allow: Set<number> | null = null;
        if (iso >= 0 && iso < n) {
          allow = new Set([iso]);
          for (const it of inc[iso]!) allow.add(it.other);
        }
        for (let i = 0; i < n; i++) {
          nHide[i] = (hiddenNode.has(nCategoryId[i]!) || (allow !== null && !allow.has(i))) ? 1 : 0;
        }
        let shown = 0;
        for (let e = 0; e < m; e++) {
          const vis = !hiddenLink.has(eCategoryId[e]!) && !nHide[eA[e]!] && !nHide[eB[e]!];
          eP2[e * 3 + A_HIDE] = vis ? 0 : 1;
          if (vis) shown++;
        }
        drawnLinks = shown;
        syncNodes(); aEP2.needsUpdate = true;
      }
      refilter();

      function fitToIndices(indices: Iterable<number>): boolean {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
        for (const i of indices) {
          if (nHide[i]) continue;
          any = true;
          const x = pos[i * 2]!, y = pos[i * 2 + 1]!;
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (!any) return false;
        const gw = Math.max(1, x1 - x0), gh = Math.max(1, y1 - y0);
        camT.x = (x0 + x1) / 2; camT.y = (y0 + y1) / 2;
        camT.zoom = Math.min(16, Math.max(0.12, Math.min(W / (gw * 1.35), H / (gh * 1.35))));
        return true;
      }
      function fitAll() {
        const all: number[] = new Array(n);
        for (let i = 0; i < n; i++) all[i] = i;
        fitToIndices(all);
      }
      // The selected node plus its direct neighbours — the "local
      // neighbourhood" the select-zoom reveals, not the deeper depth-3 cone
      // `highlight()` dims/undims for the flow effect.
      function fitToNeighborhood(idx: number) {
        const ids = [idx];
        for (const it of inc[idx]!) ids.push(it.other);
        if (!fitToIndices(ids)) fitAll();
      }
      // Selecting/deselecting drives the camera automatically, but not for
      // the initial selectedId application at boot — that would fight the
      // intro pull-back with a fit computed off the pre-physics scatter.
      let cameraFollowSelection = false;

      function highlight(idx: number) {
        nDepth.fill(-1);
        for (let e = 0; e < m; e++) eP2[e * 3 + A_ACT] = 0;
        if (idx >= 0) {
          const q = [idx]; nDepth[idx] = 0;
          for (let h = 0; h < q.length; h++) {
            const v = q[h]!, d = nDepth[v]!;
            if (d >= 3) continue;
            for (const it of inc[v]!) {
              if (nDepth[it.other]! < -0.5 && !nHide[it.other]) { nDepth[it.other] = d + 1; q.push(it.other); }
            }
          }
          for (const it of inc[idx]!) eP2[it.e * 3 + A_ACT] = 1;
          nodeMat.uniforms.uHlStart!.value = clock;
        }
        syncNodes(); aEP2.needsUpdate = true;
        const f = idx >= 0 ? 1 : 0;
        nodeMat.uniforms.uFocus!.value = f; edgeMat.uniforms.uFocus!.value = f;
      }
      function showTip(idx: number, sx: number, sy: number) {
        if (idx < 0 || idx === selIdx) { tip.style.opacity = "0"; tip.dataset.k = ""; return; }
        const cat = nodeCategories[nCategoryId[idx]!]!;
        if (tip.dataset.k !== String(idx)) {
          tip.dataset.k = String(idx);
          tip.textContent = "";
          const a = document.createElement("span");
          a.style.color = cat.color; a.textContent = nodes[idx]!.label;
          const b = document.createElement("span");
          b.style.color = "#3D4C39"; b.textContent = " · " + cat.code + " · " + degree[idx];
          tip.appendChild(a); tip.appendChild(b);
          tip.style.borderLeftColor = cat.color;
        }
        tip.style.transform = "translate3d(" + ((sx + 16) | 0) + "px," + ((sy + 14) | 0) + "px,0)";
        tip.style.opacity = "1";
      }

      function marks() {
        nSel.fill(0);
        if (hoverIdx >= 0) nSel[hoverIdx] = 1;
        if (selIdx >= 0) nSel[selIdx] = 2;
        syncNodes();
      }
      function applySelection(idx: number) {
        selIdx = idx;
        if (idx >= 0) kick(0.22);
        marks();
        highlight(idx >= 0 ? idx : hoverIdx);
        if (idx >= 0 && idx === hoverIdx) showTip(-1, 0, 0);
        if (cameraFollowSelection) {
          if (idx >= 0) fitToNeighborhood(idx);
          else fitAll();
        }
      }
      const describe = (i: number): GraphNodeSnapshot => {
        // Iterates every declared link category in a fixed order (not
        // discovery order), then drops the empty ones — so the same
        // category always appears in the same position across different
        // nodes' adjacency lists, matching the original's `LINK_KEYS.map()`.
        const groups = linkCategoryIds
          .map((categoryId) => ({
            categoryId,
            rows: inc[i]!
              .filter((it) => it.categoryId === categoryId)
              .map((it) => ({ id: nodes[it.other]!.id, label: nodes[it.other]!.label, categoryId: nCategoryId[it.other]!, out: it.out }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          }))
          .filter((g) => g.rows.length > 0);
        return {
          id: nodes[i]!.id, categoryId: nCategoryId[i]!, label: nodes[i]!.label, hex: hex4(i),
          state: STATE_LABEL[nState[i]!]!, degree: degree[i]!, groups,
        };
      };

      api.current.params = (p) => sim.setParams(p);
      api.current.refilterInternal = () => { refilter(); highlight(selIdx >= 0 ? selIdx : hoverIdx); kick(0.14); };
      api.current.applySelectionInternal = (i) => applySelection(i);
      api.current.reheat = (v) => { sim.reheat(v); kick(0.3); };
      api.current.getNodeByIndex = (i) => (i >= 0 && i < n ? describe(i) : null);
      api.current.fit = fitAll;
      api.current.focus = (i) => {
        if (i < 0 || i >= n) return;
        camT.x = pos[i * 2]!; camT.y = pos[i * 2 + 1]!;
        camT.zoom = Math.max(camT.zoom, 2.6);
      };
      // hiddenNodeCategories/hiddenLinkCategories/isolateId are already
      // reflected by the unconditional refilter() call above (the refs it
      // reads are kept current every render, including the first). Initial
      // selectedId still needs applying explicitly: unlike the original,
      // where `selected` always started null in the same component,
      // selectedId is a prop a consumer can pass non-null from first mount.
      applySelection(selectedId === null || selectedId === undefined ? -1 : (idToIndex.get(selectedId) ?? -1));
      cameraFollowSelection = true;

      let drag = -1, panning = false, moved = false, lastP = { x: 0, y: 0 };
      const el = renderer.domElement;
      function pickNode(wx: number, wy: number): number {
        let best = -1, bd = Infinity;
        const grab = Math.max(5, 12 / camZoom);
        for (let i = 0; i < n; i++) {
          if (nHide[i]) continue;
          const dx = pos[i * 2]! - wx, dy = pos[i * 2 + 1]! - wy;
          const d2 = dx * dx + dy * dy, r = nRadius[i]! + grab;
          if (d2 < r * r && d2 < bd) { bd = d2; best = i; }
        }
        return best;
      }
      const onMove = (ev: PointerEvent) => {
        const rc = el.getBoundingClientRect();
        const sx = ev.clientX - rc.left, sy = ev.clientY - rc.top, w = toWorld(sx, sy);
        sim.cursor(w.x, w.y, true);
        if (drag >= 0) { sim.pin(drag, w.x, w.y); moved = true; return; }
        if (panning) {
          camera.position.x -= (sx - lastP.x) / camZoom;
          camera.position.y += (sy - lastP.y) / camZoom;
          camT.x = camera.position.x; camT.y = camera.position.y;
          lastP = { x: sx, y: sy }; moved = true; return;
        }
        const idx = pickNode(w.x, w.y);
        if (idx !== hoverIdx) {
          hoverIdx = idx;
          marks();
          if (selIdx < 0) highlight(idx);
          el.style.cursor = idx >= 0 ? "crosshair" : "grab";
        }
        showTip(idx, sx, sy);
      };
      const onDown = (ev: PointerEvent) => {
        try { el.setPointerCapture(ev.pointerId); } catch { /* noop */ }
        const rc = el.getBoundingClientRect();
        const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
        const idx = pickNode(w.x, w.y);
        moved = false;
        if (idx >= 0) { drag = idx; sim.pin(idx, w.x, w.y); }
        else { panning = true; lastP = { x: ev.clientX - rc.left, y: ev.clientY - rc.top }; }
        el.style.cursor = "grabbing";
      };
      const onUp = () => {
        if (drag >= 0) sim.pin(-1, 0, 0);
        drag = -1; panning = false;
        el.style.cursor = hoverIdx >= 0 ? "crosshair" : "grab";
      };
      const onClick = (ev: MouseEvent) => {
        if (moved) return;
        const rc = el.getBoundingClientRect();
        const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
        const idx = pickNode(w.x, w.y);
        const next = idx >= 0 && idx !== selIdx ? idx : -1;
        onSelect?.(next >= 0 ? describe(next) : null);
      };
      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const rc = el.getBoundingClientRect();
        const sx = ev.clientX - rc.left, sy = ev.clientY - rc.top;
        // Anchor against the TARGET camera, not the smoothed one. Solving
        // against a lagging camera makes fast scrolls compound their error.
        viewport.curve = opticsRef.current.curve;
        const b = unproject(sx, sy, camT.zoom, camT.x, camT.y, viewport);
        camT.zoom = Math.min(16, Math.max(0.12, camT.zoom * Math.exp(-ev.deltaY * 0.0015)));
        const a = unproject(sx, sy, camT.zoom, camT.x, camT.y, viewport);
        camT.x += b.x - a.x;
        camT.y += b.y - a.y;
      };
      const onLeave = () => {
        sim.cursor(0, 0, false); hoverIdx = -1; marks(); showTip(-1, 0, 0);
        if (selIdx < 0) highlight(-1);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("click", onClick);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("wheel", onWheel, { passive: false });
      el.style.cursor = "grab";

      let raf = 0, last = performance.now(), accum = 0, dirty = true;
      let fA = 0, fN = 0, fT = 0;
      const boxes: Array<[number, number, number]> = [];
      const screenPos = new Map<number, [number, number, number, number]>();

      function frame(now: number) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; clock += dt;
        const t0 = performance.now();
        const c = opticsRef.current;
        viewport.curve = c.curve;

        let didStep = false;
        if (runRef.current || drag >= 0) {
          accum += dt; let s = 0;
          while (accum >= 1 / 60 && s < 3) { if (sim.step()) didStep = true; accum -= 1 / 60; s++; }
          if (didStep) { aPos.needsUpdate = true; dirty = true; }
        } else accum = 0;

        const sp = 1 - Math.pow(0.0045, dt);
        camera.position.x += (camT.x - camera.position.x) * sp;
        camera.position.y += (camT.y - camera.position.y) * sp;
        camZoom += (camT.zoom - camZoom) * sp;
        camera.zoom = camZoom; camera.updateProjectionMatrix();
        px = 1 / camZoom;

        if (dirty) {
          for (let e = 0; e < m; e++) {
            const a = eA[e]!, b = eB[e]!;
            eAPos[e * 2] = pos[a * 2]!; eAPos[e * 2 + 1] = pos[a * 2 + 1]!;
            eBPos[e * 2] = pos[b * 2]!; eBPos[e * 2 + 1] = pos[b * 2 + 1]!;
          }
          aEA.needsUpdate = true; aEB.needsUpdate = true;
          dirty = didStep;
        }

        nodeMat.uniforms.uTime!.value = clock;
        nodeMat.uniforms.uPx!.value = px;
        nodeMat.uniforms.uGlow!.value = c.glow;
        edgeMat.uniforms.uTime!.value = clock;
        edgeMat.uniforms.uPx!.value = px;
        edgeMat.uniforms.uWidth!.value = c.edgeWidth;
        edgeMat.uniforms.uOpacity!.value = c.edgeOpacity;
        edgeMat.uniforms.uFlowSpeed!.value = c.flowSpeed;
        fadeMat.uniforms.uAlpha!.value = 1 - c.trails * 0.94;

        if (c.glitch > 0 && clock > glitchUntil && Math.random() < 0.0022 * c.glitch) kick(0.10 + Math.random() * 0.22);
        const gActive = clock < glitchUntil ? c.glitch : 0;

        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);

        blurMat.uniforms.uTex!.value = sceneRT.texture;
        blurMat.uniforms.uDir!.value.set(1, 0);
        blurMat.uniforms.uThresh!.value = 0.34;
        fsQuad.material = blurMat;
        renderer.setRenderTarget(bloomA); renderer.clear(); renderer.render(postScene, postCam);
        blurMat.uniforms.uTex!.value = bloomA.texture;
        blurMat.uniforms.uDir!.value.set(0, 1);
        blurMat.uniforms.uThresh!.value = 0.0;
        renderer.setRenderTarget(bloomB); renderer.clear(); renderer.render(postScene, postCam);

        compMat.uniforms.uScene!.value = sceneRT.texture;
        compMat.uniforms.uBloom!.value = bloomB.texture;
        compMat.uniforms.uTime!.value = clock;
        compMat.uniforms.uScan!.value = c.scan;
        compMat.uniforms.uAberr!.value = c.aberr;
        compMat.uniforms.uCurve!.value = c.curve;
        compMat.uniforms.uGrain!.value = c.grain;
        compMat.uniforms.uBloomAmt!.value = c.bloom;
        compMat.uniforms.uGlitch!.value = gActive;
        fsQuad.material = compMat;
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, postCam);

        /* ------------------------------------------------- label placement
           Anchored via project(), so the label sits at the node's *drawn*
           position and its gap is a constant number of pixels at any zoom.
           A leader tick makes the association explicit when nodes crowd.   */
        boxes.length = 0; screenPos.clear();
        const mode = labelModeRef.current;
        if (mode !== "off") {
          const cx = camera.position.x, cy = camera.position.y;
          const hw = W / 2 * px * 1.15, hh = H / 2 * px * 1.15;
          const focused = selIdx >= 0 || hoverIdx >= 0;
          const cand: Array<[number, number]> = [];
          for (let i = 0; i < n; i++) {
            if (nHide[i]) continue;
            const x = pos[i * 2]!, y = pos[i * 2 + 1]!;
            if (Math.abs(x - cx) > hw || Math.abs(y - cy) > hh) continue;

            const cat = nodeCategories[nCategoryId[i]!]!;
            const isTarget = i === selIdx || i === hoverIdx;
            const inFlow = nDepth[i]! >= 0;          // inside the active neighbourhood
            const landmark = cat.tier === 0;

            // Three ways to earn a name: you're the target, you're in the
            // active flow, or your tier has come into range at this zoom.
            let earns: boolean;
            if (mode === "all") earns = true;
            else if (mode === "key") earns = landmark || isTarget || nDepth[i] === 1;
            else earns = isTarget || inFlow || camZoom >= TIER_ZOOM[cat.tier]!;
            if (!earns) continue;

            // While something is focused, everything outside the flow steps
            // back — except landmarks, which you need to keep your bearings.
            if (focused && !inFlow && !isTarget && !landmark) continue;

            let sc = nRadius[i]! + (3 - cat.tier) * 9;
            if (inFlow) sc += nDepth[i] === 1 ? 70 : 30;
            if (i === hoverIdx) sc += 1e4;
            if (i === selIdx) sc += 2e4;
            cand.push([sc, i]);
          }
          cand.sort((a, b) => b[0] - a[0]);
          for (let k = 0; k < cand.length && screenPos.size < POOL; k++) {
            const i = cand[k]![1]!;
            const sp2 = project(pos[i * 2]!, pos[i * 2 + 1]!, camZoom, cx, cy, viewport, OUT);
            const sx = sp2[0], sy = sp2[1];
            if (sx < -60 || sx > W + 60 || sy < -24 || sy > H + 24) continue;
            const bx = sx + glyphRadiusPx(nRadius[i]!, camZoom) + 8;
            const by = sy - LAB_H * 0.5;
            const bw = labelWidth(i);
            let hit = false;
            for (let q = 0; q < boxes.length; q++) {
              const p = boxes[q]!;
              if (bx < p[0] + p[2] && bx + bw > p[0] && by < p[1] + LAB_H && by + LAB_H > p[1]) { hit = true; break; }
            }
            if (hit) continue;
            const cat2 = nodeCategories[nCategoryId[i]!]!;
            const op = (i === selIdx || i === hoverIdx) ? 1
              : nDepth[i]! >= 0 ? 0.92
                : (selIdx >= 0 || hoverIdx >= 0) ? 0.28     // landmark, holding position
                  : cat2.tier === 0 ? 0.82 : 0.52;
            boxes.push([bx, by, bw]);
            screenPos.set(i, [bx, by, op, cat2.tier === 0 ? 1 : 0]);
          }
        }
        for (let k = 0; k < POOL; k++) {
          if (owner[k]! >= 0 && !screenPos.has(owner[k]!)) { owner[k] = -1; labels[k]!.style.opacity = "0"; }
        }
        const held = new Set<number>();
        for (let k = 0; k < POOL; k++) if (owner[k]! >= 0) held.add(owner[k]!);
        let free = 0;
        for (const id of screenPos.keys()) {
          if (held.has(id)) continue;
          while (free < POOL && owner[free]! >= 0) free++;
          if (free >= POOL) break;
          owner[free] = id;
          const cat3 = nodeCategories[nCategoryId[id]!]!;
          const L3 = labels[free]!;
          L3.textContent = nodes[id]!.label;
          L3.style.color = cat3.color;
          // Landmarks read heavier so the eye can find structure without
          // parsing every name on screen.
          L3.style.fontSize = cat3.tier === 0 ? "10.5px" : "9px";
          L3.style.fontWeight = cat3.tier === 0 ? "700" : "500";
          L3.style.letterSpacing = cat3.tier === 0 ? ".16em" : ".08em";
          held.add(id);
        }
        for (let k = 0; k < POOL; k++) {
          const id = owner[k]!;
          if (id < 0) continue;
          const p = screenPos.get(id)!;
          labels[k]!.style.transform = `translate3d(${p[0] | 0}px,${p[1] | 0}px,0)`;
          labels[k]!.style.opacity = String(p[2]);
        }

        fA += 1 / Math.max(dt, 1e-4); fN++; fT += dt;
        if (fT > 0.5) {
          const stats: GraphStats = {
            fps: Math.round(fA / fN), nodes: n, edges: m,
            frameMs: +(performance.now() - t0).toFixed(2), settled: sim.isSettled(),
            drawnEdges: drawnLinks, vertexAttribs: glCaps.attribs, webglVersion: glCaps.ver as 1 | 2,
          };
          onStats?.(stats);
          fA = 0; fN = 0; fT = 0;
        }
      }
      raf = requestAnimationFrame(frame);

      return function cleanup() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        el.removeEventListener("click", onClick);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("wheel", onWheel);
        labels.forEach((l) => l.remove());
        tip.remove();
        [nodeGeo, edgeGeo, fadeGeo, fsGeo].forEach((g) => g.dispose());
        [nodeMat, edgeMat, fadeMat, blurMat, compMat].forEach((mm) => mm.dispose());
        [sceneRT, bloomA, bloomB].forEach((rt) => rt.dispose());
        renderer.dispose();
        if (el.parentNode) el.parentNode.removeChild(el);
        api.current = {};
      };
    }
    // Deliberate: this effect builds and tears down the entire WebGL scene, so
    // it may only re-run when the graph data itself changes. Optics, callbacks
    // and selection are read through the refs above precisely so a slider drag
    // doesn't reallocate every buffer on the GPU.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, nodeCategories, linkCategories]);

  if (fatal) {
    return (
      <div style={{
        width: "100%", height: "100%", background: FALLBACK_BG, color: FALLBACK_FG,
        padding: 40, font: `400 12px/1.8 ${MONO}`, ...style,
      }} className={className}>
        <div style={{ color: FALLBACK_CRITICAL, letterSpacing: ".24em", marginBottom: 12 }}>▚ SYSTEM HALT</div>
        <div>{fatal}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: FALLBACK_BG, overflow: "hidden", ...style }} className={className}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={labelRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    </div>
  );
});
