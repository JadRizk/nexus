import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactElement, RefAttributes } from "react";
import * as THREE from "three";
import { createPhysics, computeDegree } from "./physics.js";
import { mulberry32, seedFromIds } from "./random.js";
import { glyphRadiusPx, project, unproject, ZOOM_MAX, ZOOM_MIN } from "./camera.js";
import { createCameraRig } from "./camera-rig.js";
import type { FitInset } from "./camera.js";
import { computeNeighbourhood, TIER_NEARBY } from "./neighbourhood.js";
import { pickNode } from "./picking.js";
import { createLabelPlacer } from "./labels.js";
import type { LabelView, PlacedLabel } from "./labels.js";
import { validateGraph } from "./validate.js";
import { buildConnections, defaultRank, visibleConnections } from "./a11y/adjacency.js";
import { initialNavState, navigate } from "./a11y/navigator.js";
import type { NavAction, NavContext, NavState } from "./a11y/navigator.js";
import { createNavOverlay } from "./a11y/overlay.js";
import type { NavOverlay } from "./a11y/overlay.js";
import type { NavConnection } from "./a11y/adjacency.js";
import {
  HELP_TEXT,
  connectionText,
  defaultNodeText,
  detailText,
  filterText,
  relationText,
  summaryText,
} from "./describe.js";
import type { Viewport } from "./camera.js";
import {
  NODE_VS,
  NODE_FS,
  EDGE_VS,
  EDGE_FS,
  PAD_VS,
  PAD_FS,
  EDGE_ATTRS,
  DEFAULT_ARC_BOW,
  encodeGain,
  encodeRouting,
  FADE_VS,
  FADE_FS,
  POST_VS,
  BLUR_FS,
  COMPOSITE_FS,
} from "./shaders.js";
import { STATE_LABEL, ORPHAN_STATE } from "./types.js";
import type {
  GraphCanvasProps,
  GraphController,
  GraphNodeSnapshot,
  GraphStats,
  PhysicsConfig,
  OpticsConfig,
} from "./types.js";

/* ============================================================================
   GraphCanvas

   Ported from the prototype's `boot()` function — the physics/shader setup,
   render loop, interaction handlers, label pool and tooltip are structurally
   unchanged. What changed is exactly what had to: every lookup that used to
   read the module-global `NODE_TYPES`/`LINK_TYPES` tables now reads the
   `nodeCategories`/`linkCategories` props instead, node/edge `id`s (now
   arbitrary, caller-supplied) get resolved to dense internal indices once
   per graph, and the imperative `nodeOn`/`linkOn`/`isolate`/`selected`
   state the prototype's parent component owned directly are now controlled
   props flowing in through refs, the same pattern the prototype already used
   for `cfg`/`running`/`labelMode`.
   ========================================================================== */

// Deliberately not sourced from @nexus-cyberdeck/tokens — this package has no
// dependency on the rest of Nexus, so its one self-contained failure state
// can't assume `var(--nx-*)` custom properties exist.
const FALLBACK_BG = "#08090A";
const FALLBACK_FG = "#DFF5C7";
const FALLBACK_CRITICAL = "#FF2E63";
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

// Exported so a consumer building its own controls has one real source for
// "what does this slider reset to", instead of a second copy that drifts —
// which is exactly what happened to the showcase when 2.0 retuned the edges.
export const DEFAULT_PHYSICS: Readonly<PhysicsConfig> = {
  repulsion: 900,
  linkDistance: 78,
  gravity: 0.028,
  damping: 0.62,
  cursorForce: 0,
  sectorForce: 0,
  radiusForce: 0,
  settle: 0,
};
// edgeOpacity, edgeWidth and aberr were retuned with the 2.0 edge shader:
// edgeWidth is now a half-width the shader multiplies by EDGE_SPAN, so the
// 1.x value of 2.4 would draw every edge about twice as heavy as intended.
export const DEFAULT_OPTICS: Readonly<OpticsConfig> = {
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

/**
 * How far short of a node's centre its edges stop, as a multiple of the node
 * radius. The same at both ends: the terminal pads sit here, and an edge whose
 * two pads landed at different distances would read meaning into which
 * endpoint the data happened to list first.
 */
const EDGE_END_TRIM = 1.15;

/** Device-pixel-ratio ceiling for the CRT pass; see the note where it is applied. */
const MAX_DPR = 1.6;

/**
 * Gives a geometry a hand-set, unbounded sphere. These meshes are drawn with
 * `frustumCulled = false` because their vertices are positioned in the vertex
 * shader, so the attribute data says nothing about where they land on screen —
 * but three still reads `boundingSphere` while projecting the scene to
 * depth-sort, and computes it lazily from a 2-component `position` attribute
 * as NaN (logging an error each time). Draw order here comes from
 * `renderOrder`, with depth testing off, so the sphere only has to be valid.
 */
const unbounded = (geometry: THREE.BufferGeometry): void => {
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
};

const hex4 = (i: number): string =>
  (((i * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

interface InternalController {
  params?: (p: Partial<PhysicsConfig>) => void;
  refilterInternal?: () => void;
  applySelectionInternal?: (index: number) => void;
  fit?: () => void;
  focus?: (index: number) => void;
  reheat?: (v: number) => void;
  reseed?: () => void;
  /** Re-runs the whole-graph fit, but only while the auto-fit still owns the camera. */
  reframe?: () => void;
  getNodeByIndex?: (index: number) => GraphNodeSnapshot | null;
  back?: () => void;
  canGoBack?: () => boolean;
  focusNode?: (index: number) => void;
}

// Generic over the node `data` type at the boundary only: the cast at the end
// of this declaration gives callers `GraphCanvasProps<T>`, `onSelect` with a
// `GraphNodeSnapshot<T>`, and a `ref` typed `GraphController<T>`, so the
// payload comes back typed. forwardRef's own type is not generic, hence the
// cast — the same pattern as @nexus-cyberdeck/react's CommandPalette. The body
// works in `unknown` because it never reads `data`; describe() copies the
// reference from `nodes[i]` onto the snapshot and nothing else touches it, so
// whatever `T` the caller's nodes carry is what comes back. `T` defaults to
// `unknown`, which is what every caller that never names it already had. The
// cast's `displayName?` is not set here; it keeps the member the old
// ForwardRefExoticComponent type declared, so code that reads or assigns
// `GraphCanvas.displayName` still compiles.
export const GraphCanvas = forwardRef<GraphController, GraphCanvasProps>(
  function GraphCanvas(props, ref) {
    const {
      nodes,
      edges,
      nodeCategories,
      linkCategories,
      physics: physicsProp,
      optics: opticsProp,
      labelMode = "auto",
      hiddenNodeCategories,
      hiddenLinkCategories,
      selectionScopedLinkCategories,
      isolateId = null,
      selectedId = null,
      running = true,
      seed,
      fitInset,
      followSelection = true,
      onSelect,
      onStats,
      onFrame,
      onFatal,
      onWarning,
      invalidEdges = "error",
      ariaLabel,
      keyboardNavigation = true,
      keyHints = true,
      describeNode,
      rankConnections,
      onNavigate,
      className,
      style,
    } = props;

    const mountRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const api = useRef<InternalController>({});
    const [fatal, setFatal] = useState<string | null>(null);

    const physicsCfg: PhysicsConfig = { ...DEFAULT_PHYSICS, ...physicsProp };
    const opticsCfg: OpticsConfig = { ...DEFAULT_OPTICS, ...opticsProp };

    const opticsRef = useRef(opticsCfg);
    opticsRef.current = opticsCfg;
    const runRef = useRef(running);
    runRef.current = running;
    const labelModeRef = useRef(labelMode);
    labelModeRef.current = labelMode;
    const hiddenNodeRef = useRef(hiddenNodeCategories);
    hiddenNodeRef.current = hiddenNodeCategories;
    const hiddenLinkRef = useRef(hiddenLinkCategories);
    hiddenLinkRef.current = hiddenLinkCategories;
    const scopedLinkRef = useRef(selectionScopedLinkCategories);
    scopedLinkRef.current = selectionScopedLinkCategories;
    const isolateRef = useRef(isolateId);
    isolateRef.current = isolateId;
    const followSelectionRef = useRef(followSelection);
    followSelectionRef.current = followSelection;
    // Four plain numbers, so the re-frame effect below depends on values a
    // consumer doesn't have to memoize, and framing never branches on a
    // missing side.
    const insetTop = fitInset?.top ?? 0,
      insetRight = fitInset?.right ?? 0,
      insetBottom = fitInset?.bottom ?? 0,
      insetLeft = fitInset?.left ?? 0;
    const fitInsetRef = useRef<FitInset>({ top: 0, right: 0, bottom: 0, left: 0 });
    fitInsetRef.current = {
      top: insetTop,
      right: insetRight,
      bottom: insetBottom,
      left: insetLeft,
    };

    // onSelect/onStats/onFatal are read inside the mount effect's boot(), which
    // only re-runs when the graph data changes (see the comment on that effect's
    // dependency array below) — so they have to come from refs kept current in
    // their own effect, not from the closure, or a handler that closes over
    // state sees the first render's callback forever.
    const onSelectRef = useRef(onSelect);
    const onStatsRef = useRef(onStats);
    const onFatalRef = useRef(onFatal);
    const onFrameRef = useRef(onFrame);
    const onWarningRef = useRef(onWarning);
    const onNavigateRef = useRef(onNavigate);
    const describeNodeRef = useRef(describeNode);
    useEffect(() => {
      onSelectRef.current = onSelect;
      onStatsRef.current = onStats;
      onFatalRef.current = onFatal;
      onFrameRef.current = onFrame;
      onWarningRef.current = onWarning;
      onNavigateRef.current = onNavigate;
      describeNodeRef.current = describeNode;
    }, [onSelect, onStats, onFatal, onFrame, onWarning, onNavigate, describeNode]);
    // Read when the scene is built: a ranking is structure, so a new one
    // takes effect on the next rebuild, not mid-navigation.
    const rankConnectionsRef = useRef(rankConnections);
    rankConnectionsRef.current = rankConnections;
    const keyHintsRef = useRef(keyHints);
    keyHintsRef.current = keyHints;

    // A named group is what a screen reader announces on the way in; an
    // unnamed one fails WCAG 4.1.2. Warn once per mount, in development.
    const hasName = Boolean(ariaLabel);
    useEffect(() => {
      const env = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
        ?.NODE_ENV;
      if (keyboardNavigation && !hasName && env !== "production")
        console.warn(
          "GraphCanvas: keyboard navigation is on but no ariaLabel was given — screen readers will announce an unnamed group.",
        );
    }, [keyboardNavigation, hasName]);

    useImperativeHandle(
      ref,
      () => ({
        fit: () => api.current.fit?.(),
        focus: (id) => {
          const idx = idToIndexRef.current.get(id);
          if (idx !== undefined) api.current.focus?.(idx);
        },
        reheat: (v = 1.0) => api.current.reheat?.(v),
        focusNode: (id) => {
          const idx = idToIndexRef.current.get(id);
          if (idx !== undefined) api.current.focusNode?.(idx);
        },
        back: () => api.current.back?.(),
        get canGoBack() {
          return api.current.canGoBack?.() ?? false;
        },
        reseed: () => api.current.reseed?.(),
        getNode: (id) => {
          const idx = idToIndexRef.current.get(id);
          return idx !== undefined ? (api.current.getNodeByIndex?.(idx) ?? null) : null;
        },
      }),
      [],
    );

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
        repulsion: physicsCfg.repulsion,
        linkDistance: physicsCfg.linkDistance,
        gravity: physicsCfg.gravity,
        damping: physicsCfg.damping,
        cursorForce: physicsCfg.cursorForce,
        sectorForce: physicsCfg.sectorForce,
        radiusForce: physicsCfg.radiusForce,
        settle: physicsCfg.settle,
      });
    }, [
      physicsCfg.repulsion,
      physicsCfg.linkDistance,
      physicsCfg.gravity,
      physicsCfg.damping,
      physicsCfg.cursorForce,
      physicsCfg.sectorForce,
      physicsCfg.radiusForce,
      physicsCfg.settle,
    ]);

    // Compared by content, not by identity. `hiddenNodeCategories={["tag"]}`
    // written inline — the obvious way to write it — is a new array on every
    // render, and an identity comparison would refilter and fire the glitch
    // kick on every single one, including renders that have nothing to do with
    // the graph. The refs above are refreshed every render regardless, so the
    // refilter that does run always reads the current arrays. Absent and empty
    // mean the same thing, so they hash the same.
    const hiddenNodeKey = JSON.stringify(hiddenNodeCategories ?? []);
    const hiddenLinkKey = JSON.stringify(hiddenLinkCategories ?? []);
    const scopedLinkKey = JSON.stringify(selectionScopedLinkCategories ?? []);
    useEffect(() => {
      api.current.refilterInternal?.();
    }, [hiddenNodeKey, hiddenLinkKey, scopedLinkKey, isolateId]);

    // A dock collapsing or a drawer sliding in changes the free box. reframe
    // is a no-op once the reader has taken the camera by hand, so this can't
    // pull a deliberate pan back to centre.
    useEffect(() => {
      api.current.reframe?.();
    }, [insetTop, insetRight, insetBottom, insetLeft]);

    useEffect(() => {
      const idx = selectedId === null ? -1 : (idToIndexRef.current.get(selectedId) ?? -1);
      api.current.applySelectionInternal?.(idx);
    }, [selectedId]);

    useEffect(() => {
      const mount = mountRef.current,
        lab = labelRef.current,
        navLayer = navRef.current,
        root = rootRef.current;
      if (!mount || !lab) return;
      // Everything boot() creates registers its teardown here the moment it
      // exists, so a throw part-way through setup — after the renderer, its
      // canvas, the label pool and the ResizeObserver are live — releases what
      // was already built instead of leaving it alive until GC. A completed
      // boot hands the same list to the effect's cleanup; drained in reverse
      // so later resources (the frame loop, listeners) go before the renderer
      // they draw through.
      const disposables: Array<() => void> = [];
      const dispose = () => {
        while (disposables.length > 0) {
          try {
            disposables.pop()!();
          } catch (e) {
            console.error(e);
          }
        }
        api.current = {};
      };
      try {
        boot(mount, lab, navLayer, root);
      } catch (err) {
        dispose();
        const message = String((err as Error)?.message ?? err);
        console.error(err);
        setFatal(message);
        onFatalRef.current?.(message);
      }
      return dispose;

      function boot(
        mountEl: HTMLDivElement,
        labelEl: HTMLDivElement,
        navEl: HTMLDivElement | null,
        rootEl: HTMLDivElement | null,
      ) {
        // Validated before anything that needs tearing down exists — see
        // validate.ts for why this has to come first. From here on `liveEdges`
        // is the edge list: under invalidEdges="drop" it can be shorter than
        // the prop, and every per-edge array is sized and indexed from it.
        const {
          idToIndex,
          eA,
          eB,
          edges: liveEdges,
          dropped,
        } = validateGraph(nodes, edges, nodeCategories, linkCategories, invalidEdges);
        idToIndexRef.current = idToIndex;
        const n = nodes.length,
          m = liveEdges.length;
        if (dropped.length > 0) {
          const message = `GraphCanvas: dropped ${dropped.length} edge(s) whose endpoint matches no node`;
          if (onWarningRef.current) onWarningRef.current(message, { dropped });
          else console.warn(message, dropped);
        }

        const nCategoryId = nodes.map((node) => node.categoryId);
        const denseIds = nodes.map((node) => node.id);
        const eCategoryId = liveEdges.map((edge) => edge.categoryId);
        const linkCategoryIds = Object.keys(linkCategories);
        const degree = computeDegree(
          Array.from({ length: m }, (_, e) => ({ a: eA[e]!, b: eB[e]! })),
          n,
        );
        // A node with no edges is always ORPHAN, regardless of its declared
        // state — derived from graph structure the engine already has, not
        // something the caller needs to remember to set by hand.
        const nState = new Uint8Array(n);
        for (let i = 0; i < n; i++)
          nState[i] = degree[i] === 0 ? ORPHAN_STATE : (nodes[i]!.state ?? 1);

        // Undefined means unseeded (Math.random); see GraphCanvasProps.seed.
        const layoutSeed =
          seed === null ? undefined : (seed ?? seedFromIds(nodes.map((node) => node.id)));
        // The shader seeds come from their own stream (the layout seed run
        // through a fixed salt), so how many of them get drawn never moves a
        // node.
        const visualRandom =
          layoutSeed === undefined ? Math.random : mulberry32(layoutSeed ^ 0x5bd1e995);

        const sim = createPhysics(
          {
            nodes: nodes.map((node) => {
              const cat = nodeCategories[node.categoryId]!;
              // A node's own value wins over its category's. Spread in only
              // when defined: physics reads "key absent" as "no target", and
              // under exactOptionalPropertyTypes an explicit undefined is not
              // the same thing.
              const sectorAngle = node.sectorAngle ?? cat.sectorAngle;
              const radiusTarget = node.radiusTarget ?? cat.radiusTarget;
              return {
                charge: cat.charge,
                mass: cat.mass,
                ...(sectorAngle === undefined ? {} : { sectorAngle }),
                ...(radiusTarget === undefined ? {} : { radiusTarget }),
              };
            }),
            edges: Array.from({ length: m }, (_, e) => {
              const cat = linkCategories[eCategoryId[e]!]!;
              return { a: eA[e]!, b: eB[e]!, dist: cat.dist, strength: cat.strength };
            }),
          },
          layoutSeed === undefined ? {} : { seed: layoutSeed },
        );
        // The params effect above cannot reach the solver on the render that
        // creates it, so the initial `physics` prop has to be applied here or it
        // never lands. Numerically inert when the prop is absent: physicsCfg is
        // DEFAULT_PHYSICS, which matches the solver's own starting params, and
        // setParams' alpha floor of 0.28 is below the alpha of 1 a fresh solver
        // already has.
        sim.setParams(physicsCfg);
        const pos = sim.pos;

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
        // Four full-screen passes at dpr 2 is a lot of fill for little gain;
        // the CRT grille and grain hide the difference anyway. resize() re-reads
        // devicePixelRatio and re-applies this cap on every observed resize.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
        renderer.setClearColor(new THREE.Color(FALLBACK_BG), 1);
        renderer.autoClear = false;
        mountEl.appendChild(renderer.domElement);
        renderer.domElement.style.cssText =
          "display:block;touch-action:none;width:100%;height:100%";
        disposables.push(() => {
          renderer.dispose();
          // dispose() alone leaves the GL context alive until the canvas is
          // collected; under StrictMode, HMR or a list of graphs that is
          // enough to hit the browser's context cap. Losing it explicitly
          // gives it back now.
          renderer.forceContextLoss();
          renderer.domElement.remove();
        });

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
        camera.position.z = 5;

        const nRadius = new Float32Array(n),
          nShape = new Float32Array(n);
        const nColor = new Float32Array(n * 3),
          nSeed = new Float32Array(n);
        const nDepth = new Float32Array(n).fill(-1);
        const nSel = new Float32Array(n),
          nHide = new Float32Array(n);
        const nTier = new Float32Array(n); // per-node category tier, for the label placer
        const tc = new THREE.Color();
        for (let i = 0; i < n; i++) {
          const cat = nodeCategories[nCategoryId[i]!]!;
          nRadius[i] =
            (nodes[i]!.size ?? cat.size) * (1 + Math.min(1.4, Math.log2(1 + degree[i]!) * 0.16));
          nShape[i] = cat.shape;
          tc.set(cat.color);
          nColor[i * 3] = tc.r;
          nColor[i * 3 + 1] = tc.g;
          nColor[i * 3 + 2] = tc.b;
          nSeed[i] = visualRandom();
          nTier[i] = cat.tier;
        }
        const eAPos = new Float32Array(m * 2),
          eBPos = new Float32Array(m * 2);
        const eColor = new Float32Array(m * 3);
        // Sized from the layout shaders.ts declares, so the two are one statement.
        const eP0 = new Float32Array(m * EDGE_ATTRS.iP0); // width, curve, dash, signed gain
        const eP1 = new Float32Array(m * EDGE_ATTRS.iP1); // flow, seed, radA, radB
        const eP2 = new Float32Array(m * EDGE_ATTRS.iP2); // tier, hide, jit, fray
        const A_TIER = 0,
          A_HIDE = 1,
          A_JIT = 2,
          A_FRAY = 3;
        for (let e = 0; e < m; e++) {
          const cat = linkCategories[eCategoryId[e]!]!;
          tc.set(cat.color);
          eColor[e * 3] = tc.r;
          eColor[e * 3 + 1] = tc.g;
          eColor[e * 3 + 2] = tc.b;
          eP0[e * 4] = cat.width;
          // Routing shares `curve`'s float, so it costs no attribute. The
          // encoding lives in shaders.ts beside the dispatch that reads it;
          // writing the float by hand is how an earlier version drew every
          // odd-indexed arc as an etched trace. The alternating sign keeps
          // adjacent arcs from overlapping.
          eP0[e * 4 + 1] = encodeRouting(
            cat.routing,
            (cat.curve ?? DEFAULT_ARC_BOW) * (e % 2 === 0 ? 1 : -1),
          );
          eP0[e * 4 + 2] = cat.dash ?? 0;
          eP0[e * 4 + 3] = encodeGain(cat.gain ?? 1, cat.directed ?? true);
          eP1[e * 4] = cat.flow ?? 0;
          eP1[e * 4 + 1] = visualRandom();
          eP1[e * 4 + 2] = nRadius[eA[e]!]! * EDGE_END_TRIM;
          eP1[e * 4 + 3] = nRadius[eB[e]!]! * EDGE_END_TRIM;
          eP2[e * 4 + A_JIT] = cat.jit ?? 0;
          const absent = liveEdges[e]!.absentEnd;
          eP2[e * 4 + A_FRAY] = absent === "b" ? 1 : absent === "a" ? 2 : 0;
        }
        const dyn = (arr: Float32Array, size: number) => {
          const a = new THREE.InstancedBufferAttribute(arr, size);
          a.setUsage(THREE.DynamicDrawUsage);
          return a;
        };
        const stat = (arr: Float32Array, size: number) =>
          new THREE.InstancedBufferAttribute(arr, size);

        const SEG = 24;
        const ev = new Float32Array((SEG + 1) * 4);
        const ei: number[] = [];
        for (let s = 0; s <= SEG; s++) {
          const t = s / SEG;
          ev[s * 4] = t;
          ev[s * 4 + 1] = -1;
          ev[s * 4 + 2] = t;
          ev[s * 4 + 3] = 1;
        }
        for (let s = 0; s < SEG; s++) {
          const b = s * 2;
          ei.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
        }
        const edgeGeo = new THREE.InstancedBufferGeometry();
        edgeGeo.setAttribute("position", new THREE.BufferAttribute(ev, 2));
        edgeGeo.setIndex(ei);
        // One set of instance attributes, shared by the ribbon and the pads.
        const aEA = dyn(eAPos, 2),
          aEB = dyn(eBPos, 2),
          aEP2 = dyn(eP2, EDGE_ATTRS.iP2);
        const aEP0 = stat(eP0, EDGE_ATTRS.iP0),
          aEP1 = stat(eP1, EDGE_ATTRS.iP1),
          aEColor = stat(eColor, 3);
        edgeGeo.setAttribute("iA", aEA);
        edgeGeo.setAttribute("iB", aEB);
        edgeGeo.setAttribute("iColor", aEColor);
        edgeGeo.setAttribute("iP0", aEP0);
        edgeGeo.setAttribute("iP1", aEP1);
        edgeGeo.setAttribute("iP2", aEP2);
        edgeGeo.instanceCount = m;
        unbounded(edgeGeo);
        const edgeUniforms = (pass: number) => ({
          uPx: { value: 1 },
          uWidth: { value: opticsCfg.edgeWidth },
          uTime: { value: 0 },
          uOpacity: { value: opticsCfg.edgeOpacity },
          uFlowSpeed: { value: opticsCfg.flowSpeed },
          uFocus: { value: 0 },
          uSignal: { value: 1 },
          uPass: { value: pass },
          uReduced: { value: 0 },
        });
        // Two draws of the same instances, two blend modes. The RESTING layer
        // composites (premultiplied), so two crossing edges stay as dark as one
        // instead of summing toward white exactly where the picture is busiest.
        // The LIVE layer (edges touching the hovered or selected node) stays
        // additive, so it still blooms like phosphor. `uPass` makes each
        // program discard the other's instances, which is simpler than keeping
        // two partitioned instance ranges in step as hover moves.
        //
        // DoubleSide: the ribbon's winding flips with the bow's direction, and
        // a RawShaderMaterial culls back faces by default, so without it a
        // share of every curved edge set silently disappears.
        const edgeMat = new THREE.RawShaderMaterial({
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
          uniforms: edgeUniforms(0),
        });
        const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
        edgeMesh.frustumCulled = false;
        edgeMesh.renderOrder = 0;
        scene.add(edgeMesh);
        const edgeLiveMat = new THREE.RawShaderMaterial({
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
          uniforms: edgeUniforms(1),
        });
        const edgeLiveMesh = new THREE.Mesh(edgeGeo, edgeLiveMat);
        edgeLiveMesh.frustumCulled = false;
        edgeLiveMesh.renderOrder = 2;
        scene.add(edgeLiveMesh);

        // Terminal pads: two quads per edge, sharing the ribbon's instance
        // buffers. A trace lands on a pad and never touches the glyph, and the
        // pads' shapes carry direction (see PAD_VS).
        const padGeo = new THREE.InstancedBufferGeometry();
        const pv = new Float32Array(8 * 3);
        const pIdx: number[] = [];
        const corners = [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const;
        for (let end = 0; end < 2; end++) {
          const base = end * 4;
          for (let c = 0; c < 4; c++) {
            pv[(base + c) * 3] = corners[c]![0];
            pv[(base + c) * 3 + 1] = corners[c]![1];
            pv[(base + c) * 3 + 2] = end;
          }
          pIdx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        padGeo.setAttribute("aPad", new THREE.BufferAttribute(pv, 3));
        padGeo.setIndex(pIdx);
        padGeo.setAttribute("iA", aEA);
        padGeo.setAttribute("iB", aEB);
        padGeo.setAttribute("iColor", aEColor);
        padGeo.setAttribute("iP0", aEP0);
        padGeo.setAttribute("iP1", aEP1);
        padGeo.setAttribute("iP2", aEP2);
        padGeo.instanceCount = m;
        unbounded(padGeo);
        const padMat = new THREE.RawShaderMaterial({
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
            uWidth: { value: opticsCfg.edgeWidth },
            uOpacity: { value: opticsCfg.edgeOpacity },
            uFocus: { value: 0 },
          },
        });
        const padMesh = new THREE.Mesh(padGeo, padMat);
        padMesh.frustumCulled = false;
        padMesh.renderOrder = 1;
        scene.add(padMesh); // fade -10 < edges 0 < pads 1 < live edges 2 < nodes 3

        const nodeGeo = new THREE.InstancedBufferGeometry();
        nodeGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2),
        );
        nodeGeo.setIndex([0, 1, 2, 2, 1, 3]);
        // The JS logic keeps its readable per-node arrays; syncNodes() mirrors
        // them into the packed GPU buffers so only the upload path changed.
        const nN0 = new Float32Array(n * 4),
          nN1 = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          nN0[i * 4] = nRadius[i]!;
          nN0[i * 4 + 1] = nShape[i]!;
          nN0[i * 4 + 2] = nSeed[i]!;
          nN1[i * 4] = nState[i]!;
        }
        const aPos = dyn(pos, 2),
          aN0 = dyn(nN0, 4),
          aN1 = dyn(nN1, 4);
        function syncNodes() {
          for (let i = 0; i < n; i++) {
            nN0[i * 4 + 3] = nDepth[i]!;
            nN1[i * 4 + 1] = nSel[i]!;
            nN1[i * 4 + 2] = nHide[i]!;
          }
          aN0.needsUpdate = true;
          aN1.needsUpdate = true;
        }
        syncNodes();
        nodeGeo.setAttribute("iPos", aPos);
        nodeGeo.setAttribute("iColor", stat(nColor, 3));
        nodeGeo.setAttribute("iN0", aN0);
        nodeGeo.setAttribute("iN1", aN1);
        nodeGeo.instanceCount = n;
        unbounded(nodeGeo);
        const nodeMat = new THREE.RawShaderMaterial({
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
            uGlow: { value: opticsCfg.glow },
            uFocus: { value: 0 },
            uReduced: { value: 0 },
          },
        });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.frustumCulled = false;
        nodeMesh.renderOrder = 3;
        scene.add(nodeMesh);

        const vc = new THREE.Color(FALLBACK_BG);
        const fadeGeo = new THREE.BufferGeometry();
        fadeGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
        );
        unbounded(fadeGeo);
        const fadeMat = new THREE.RawShaderMaterial({
          vertexShader: FADE_VS,
          fragmentShader: FADE_FS,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uColor: { value: new THREE.Vector3(vc.r, vc.g, vc.b) },
            uAlpha: { value: 1 },
            uReduced: { value: 0 },
          },
        });
        const fadeMesh = new THREE.Mesh(fadeGeo, fadeMat);
        fadeMesh.frustumCulled = false;
        fadeMesh.renderOrder = -10;
        scene.add(fadeMesh);

        const rtOpts = {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
        };
        const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
        const bloomA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
        const bloomB = new THREE.WebGLRenderTarget(2, 2, rtOpts);

        const fsGeo = new THREE.BufferGeometry();
        fsGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2),
        );
        fsGeo.setAttribute(
          "uv",
          new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
        );
        const blurMat = new THREE.RawShaderMaterial({
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
        const compMat = new THREE.RawShaderMaterial({
          vertexShader: POST_VS,
          fragmentShader: COMPOSITE_FS,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uScene: { value: null },
            uBloom: { value: null },
            uRes: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uScan: { value: opticsCfg.scan },
            uAberr: { value: opticsCfg.aberr },
            uCurve: { value: opticsCfg.curve },
            uGrain: { value: opticsCfg.grain },
            uBloomAmt: { value: opticsCfg.bloom },
            uGlitch: { value: 0 },
            uReduced: { value: 0 },
          },
        });
        unbounded(fsGeo);
        const fsQuad = new THREE.Mesh(fsGeo, compMat);
        fsQuad.frustumCulled = false;
        const postScene = new THREE.Scene();
        postScene.add(fsQuad);
        const postCam = new THREE.Camera();
        disposables.push(() => [sceneRT, bloomA, bloomB].forEach((rt) => rt.dispose()));
        disposables.push(() =>
          [nodeMat, edgeMat, edgeLiveMat, padMat, fadeMat, blurMat, compMat].forEach((mm) =>
            mm.dispose(),
          ),
        );
        disposables.push(() =>
          [nodeGeo, edgeGeo, padGeo, fadeGeo, fsGeo].forEach((g) => g.dispose()),
        );

        /* --------------------------------------------------------- label pool */
        const POOL = 60;
        const labels: HTMLDivElement[] = [],
          owner = new Int32Array(POOL).fill(-1);
        for (let i = 0; i < POOL; i++) {
          const el = document.createElement("div");
          el.style.cssText =
            "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;" +
            `font:600 9.5px/1 ${MONO};letter-spacing:.09em;text-transform:uppercase;` +
            "text-shadow:1px 0 rgba(255,46,99,.4),-1px 0 rgba(23,226,229,.4),0 0 7px rgba(0,0,0,.98);" +
            "transform:translate3d(-9999px,-9999px,0);will-change:transform;opacity:0;transition:opacity .1s";
          // The pool is a rotating subset of node names driven straight by
          // layout math, not by anything a screen reader should announce —
          // aria-hidden keeps this decorative, same as the tooltip below.
          el.setAttribute("aria-hidden", "true");
          labelEl.appendChild(el);
          labels.push(el);
        }
        disposables.push(() => labels.forEach((l) => l.remove()));
        const LAB_H = 11;

        // Raw text measurement only — the placer owns the per-node width
        // cache and the padding math (labels.ts).
        const meas = document.createElement("canvas").getContext("2d")!;
        const labelPlacer = createLabelPlacer({
          poolSize: POOL,
          labelHeight: LAB_H,
          measure: (text, font) => {
            meas.font = font;
            return meas.measureText(text).width;
          },
        });

        // Imperative tooltip. Driving this through React state re-rendered the
        // whole tree on every pointermove — 60 reconciles a second while hovering.
        // Its chrome colours (border, secondary text) are hardcoded defaults,
        // same status as FALLBACK_BG above — this package has no theme system
        // of its own, only per-category colours the caller already supplies.
        const tip = document.createElement("div");
        tip.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;max-width:270px;" +
          "overflow:hidden;text-overflow:ellipsis;background:rgba(8,10,9,.95);border:1px solid #1B2318;" +
          "border-left-width:2px;padding:4px 7px;font:600 9px/1.4 " +
          MONO +
          ";letter-spacing:.11em;" +
          "text-transform:uppercase;opacity:0;transition:opacity .1s;" +
          "transform:translate3d(-9999px,-9999px,0);will-change:transform;z-index:5";
        tip.setAttribute("aria-hidden", "true");
        labelEl.appendChild(tip);
        disposables.push(() => tip.remove());

        let W = 1,
          H = 1,
          px = 1;
        const bufSize = new THREE.Vector2();
        // Camera ownership and easing live in camera-rig.ts. computeBounds is
        // a hoisted declaration further down; W and H are kept current by
        // resize().
        const rig = createCameraRig({
          bounds: (indices) => computeBounds(indices),
          position: (i) => [pos[i * 2]!, pos[i * 2 + 1]!],
          viewport: () => ({ width: W, height: H }),
          inset: () => fitInsetRef.current,
        });
        const viewport: Viewport = { width: 1, height: 1, curve: opticsCfg.curve };
        // The label placer's view of the scene. Mutated per frame rather than
        // rebuilt: the typed arrays are the same long-lived buffers the
        // renderer already writes, and only the camera and focus fields move.
        const labelView: LabelView = {
          count: n,
          pos,
          hidden: nHide,
          radii: nRadius,
          depth: nDepth,
          tier: nTier,
          label: (i) => nodes[i]!.label,
          zoom: 1,
          cx: 0,
          cy: 0,
          viewport,
          mode: "auto",
          selIdx: -1,
          hoverIdx: -1,
        };
        function resize() {
          W = mountEl.clientWidth || 1;
          H = mountEl.clientHeight || 1;
          viewport.width = W;
          viewport.height = H;
          // Re-read rather than trusting the value boot() sampled: devicePixelRatio
          // changes when the window is dragged to a display with a different
          // density, or when the page is zoomed, and a ResizeObserver callback is
          // exactly when that shows up. Sampling once at mount left the canvas
          // rendering at the old density until something remounted it.
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
          // updateStyle must stay on: with it off three sets canvas.width = W*dpr
          // but no CSS size, so the element lays out at W*dpr and every DOM
          // overlay is in a coordinate space half the size of the canvas.
          renderer.setSize(W, H);
          camera.left = -W / 2;
          camera.right = W / 2;
          camera.top = H / 2;
          camera.bottom = -H / 2;
          camera.updateProjectionMatrix();
          renderer.getDrawingBufferSize(bufSize);
          const bw = Math.max(2, bufSize.x | 0),
            bh = Math.max(2, bufSize.y | 0);
          sceneRT.setSize(bw, bh);
          const sw = Math.max(2, (bw / 3) | 0),
            sh = Math.max(2, (bh / 3) | 0);
          bloomA.setSize(sw, sh);
          bloomB.setSize(sw, sh);
          compMat.uniforms.uRes!.value.set(bw, bh);
          blurMat.uniforms.uTexel!.value.set(1 / sw, 1 / sh);
          renderer.setRenderTarget(sceneRT);
          renderer.clear();
          renderer.setRenderTarget(null);
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(mountEl);
        disposables.push(() => ro.disconnect());
        const toWorld = (sx: number, sy: number) => {
          viewport.curve = opticsRef.current.curve;
          return unproject(sx, sy, rig.live.zoom, rig.live.x, rig.live.y, viewport);
        };

        const inc: Array<Array<{ e: number; other: number; categoryId: string; out: boolean }>> =
          Array.from({ length: n }, () => []);
        for (let e = 0; e < m; e++) {
          inc[eA[e]!]!.push({ e, other: eB[e]!, categoryId: eCategoryId[e]!, out: true });
          inc[eB[e]!]!.push({ e, other: eA[e]!, categoryId: eCategoryId[e]!, out: false });
        }
        const neighbourhoodGraph = { inc, eA, eB, hidden: nHide };
        // Scratch for computeNeighbourhood's dense per-edge tier output,
        // scattered into eP2 by highlight().
        const eTierBuf = new Float32Array(m);

        let selIdx = -1,
          hoverIdx = -1,
          clock = 0,
          glitchUntil = -1,
          drawnLinks = m,
          drawnNodes = n;

        const kick = (d: number) => {
          glitchUntil = clock + d;
        };

        // prefers-reduced-motion. Read once here and tracked live, so flipping
        // the OS setting while the canvas is up takes effect on the next frame
        // without a remount. Guarded: jsdom and SSR have no matchMedia, and
        // Safari before 14 has a MediaQueryList with addListener only. The flag
        // reaches the GPU as `uReduced` (see shaders.ts for what it gates) and
        // is mirrored onto the canvas as data-nx-reduced-motion so the state is
        // observable from outside — the uniforms themselves are not.
        const motionQuery =
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null;
        let reduced = motionQuery?.matches ?? false;
        const applyReduced = () => {
          renderer.domElement.dataset.nxReducedMotion = String(reduced);
        };
        const onMotionChange = (ev: MediaQueryListEvent) => {
          reduced = ev.matches;
          applyReduced();
        };
        if (motionQuery) {
          if (typeof motionQuery.addEventListener === "function")
            motionQuery.addEventListener("change", onMotionChange);
          else motionQuery.addListener(onMotionChange);
        }
        applyReduced();
        disposables.push(() => {
          if (!motionQuery) return;
          if (typeof motionQuery.removeEventListener === "function")
            motionQuery.removeEventListener("change", onMotionChange);
          else motionQuery.removeListener(onMotionChange);
        });

        if (!reduced) kick(0.8); // glitch flourish riding along with the intro pull-back

        function refilter() {
          const hiddenNode = new Set(hiddenNodeRef.current ?? []);
          const hiddenLink = new Set(hiddenLinkRef.current ?? []);
          const scopedLink = new Set(scopedLinkRef.current ?? []);
          const isoId = isolateRef.current;
          const iso = isoId === null || isoId === undefined ? -1 : (idToIndex.get(isoId) ?? -1);
          let allow: Set<number> | null = null;
          if (iso >= 0 && iso < n) {
            allow = new Set([iso]);
            for (const it of inc[iso]!) allow.add(it.other);
          }
          let shownNodes = 0;
          for (let i = 0; i < n; i++) {
            nHide[i] = hiddenNode.has(nCategoryId[i]!) || (allow !== null && !allow.has(i)) ? 1 : 0;
            if (!nHide[i]) shownNodes++;
          }
          drawnNodes = shownNodes;
          let shown = 0;
          for (let e = 0; e < m; e++) {
            const cat = eCategoryId[e]!;
            // A selection-scoped category only shows on edges touching the
            // selected node, and nowhere when nothing is selected.
            const scopedOut = scopedLink.has(cat) && eA[e] !== selIdx && eB[e] !== selIdx;
            const vis = !hiddenLink.has(cat) && !scopedOut && !nHide[eA[e]!] && !nHide[eB[e]!];
            eP2[e * 4 + A_HIDE] = vis ? 0 : 1;
            if (vis) shown++;
          }
          drawnLinks = shown;
          syncNodes();
          aEP2.needsUpdate = true;
        }
        refilter();

        /** Bounds of the visible nodes among `indices` (all nodes when omitted), or null if none are visible. */
        function computeBounds(
          indices?: readonly number[],
        ): [number, number, number, number] | null {
          let x0 = Infinity,
            y0 = Infinity,
            x1 = -Infinity,
            y1 = -Infinity,
            any = false;
          const count = indices ? indices.length : n;
          for (let k = 0; k < count; k++) {
            const i = indices ? indices[k]! : k;
            if (nHide[i]) continue;
            any = true;
            const x = pos[i * 2]!,
              y = pos[i * 2 + 1]!;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
          return any ? [x0, y0, x1, y1] : null;
        }
        // Selecting drives the camera (when followSelection is on), but not
        // for the initial selectedId at boot: that would fight the intro sweep
        // with a frame computed off the pre-physics scatter.
        let cameraFollowSelection = false;

        function highlight(idx: number) {
          computeNeighbourhood(neighbourhoodGraph, idx, nDepth, eTierBuf);
          // Three tiers reach the edge shader: incident (1), inside the
          // two-hop neighbourhood (TIER_NEARBY), and everything else (0).
          for (let e = 0; e < m; e++) eP2[e * 4 + A_TIER] = eTierBuf[e]!;
          if (idx >= 0) {
            nodeMat.uniforms.uHlStart!.value = clock;
          }
          syncNodes();
          aEP2.needsUpdate = true;
          const f = idx >= 0 ? 1 : 0;
          nodeMat.uniforms.uFocus!.value = f;
          edgeMat.uniforms.uFocus!.value = f;
          edgeLiveMat.uniforms.uFocus!.value = f;
          padMat.uniforms.uFocus!.value = f;
        }
        // The hovered node's tooltip, or -1. Escape dismisses it (WCAG 1.4.13)
        // and it stays dismissed until the pointer moves to another node.
        let tipIdx = -1,
          tipSuppressed = -1;
        const TIP_OUT: [number, number] = [0, 0];
        function showTip(idx: number) {
          if (idx < 0 || idx === selIdx || idx === tipSuppressed) {
            tip.style.opacity = "0";
            tip.dataset.k = "";
            tipIdx = -1;
            return;
          }
          tipIdx = idx;
          const cat = nodeCategories[nCategoryId[idx]!]!;
          if (tip.dataset.k !== String(idx)) {
            tip.dataset.k = String(idx);
            tip.textContent = "";
            const a = document.createElement("span");
            a.style.color = cat.color;
            a.textContent = nodes[idx]!.label;
            const b = document.createElement("span");
            // The old #3D4C39 measured 2.17:1 against the tooltip ground — see
            // GraphCanvas.contrast.test.ts. This tooltip's ground is
            // rgba(8,10,9,.95) composited over whatever the canvas is drawing
            // underneath it, so the worst case is a bright node colour behind
            // a translucent panel, not the flat dark background: over a node
            // as bright as #9EFF3D this literal measures 4.5184:1, clearing
            // the 4.5 AA floor. Kept as a hardcoded literal rather than a
            // token name on purpose — this package has no dependency on the
            // tokens layer (FALLBACK_BG/FALLBACK_FG above are the same story),
            // so naming a token here would go stale silently if that token's
            // value ever moved again.
            b.style.color = "#6F8465";
            b.textContent = " · " + cat.code + " · " + degree[idx];
            tip.appendChild(a);
            tip.appendChild(b);
            tip.style.borderLeftColor = cat.color;
          }
          // Anchored beside the node, not the pointer, so it never covers the
          // glyph being read, and on the side fewer of its edges leave from,
          // so it covers as little of them as it can. Flips when it would run
          // into the consumer's chrome or off the canvas.
          const p = project(
            pos[idx * 2]!,
            pos[idx * 2 + 1]!,
            rig.live.zoom,
            rig.live.x,
            rig.live.y,
            viewport,
            TIP_OUT,
          );
          const r = glyphRadiusPx(nRadius[idx]!, rig.live.zoom);
          const w = tip.offsetWidth,
            h = tip.offsetHeight;
          let toRight = 0,
            toLeft = 0;
          for (const it of inc[idx]!) {
            if (pos[it.other * 2]! >= pos[idx * 2]!) toRight++;
            else toLeft++;
          }
          const ins = fitInsetRef.current;
          const rightX = p[0] + r + 12,
            leftX = p[0] - r - 12 - w;
          let x = toRight <= toLeft ? rightX : leftX;
          if (x === rightX && x + w > W - ins.right) x = leftX;
          else if (x === leftX && x < ins.left) x = rightX;
          const y = Math.min(
            Math.max(p[1] - h / 2, ins.top + 4),
            Math.max(ins.top + 4, H - ins.bottom - h - 4),
          );
          tip.style.transform = "translate3d(" + (x | 0) + "px," + (y | 0) + "px,0)";
          tip.style.opacity = "1";
        }

        // Node marks for the shader: 1 hovered (or the far end of the
        // connection being browsed), 2 selected, +4 holding keyboard focus.
        function marks() {
          nSel.fill(0);
          if (hoverIdx >= 0) nSel[hoverIdx] = 1;
          const c = cursorConnection();
          if (c) nSel[c.other] = Math.max(nSel[c.other]!, 1);
          if (selIdx >= 0) nSel[selIdx] = 2;
          const f = focusedNode();
          if (f >= 0) nSel[f] = nSel[f]! + 4;
          syncNodes();
        }
        function applySelection(idx: number) {
          selIdx = idx;
          // A selection from outside the navigator (a click, or the consumer)
          // is a move the reader can go back from. Echoes of the navigator's
          // own select effects arrive here too, and change nothing.
          if (nav) dispatch({ type: "selected", index: idx });
          if (scopedLinkRef.current?.length) refilter();
          if (idx >= 0) kick(0.22);
          refresh();
          if (idx >= 0 && idx === hoverIdx) showTip(-1);
          if (cameraFollowSelection && followSelectionRef.current) {
            // The selected node plus its direct neighbours — the local
            // neighbourhood a selection reveals, not the deeper cone
            // highlight() dims and undims.
            if (idx >= 0)
              rig.frameAround(
                idx,
                inc[idx]!.map((it) => it.other),
              );
            else rig.release();
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
              rows: inc[i]!.filter((it) => it.categoryId === categoryId)
                .map((it) => ({
                  id: nodes[it.other]!.id,
                  label: nodes[it.other]!.label,
                  categoryId: nCategoryId[it.other]!,
                  out: it.out,
                }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            }))
            .filter((g) => g.rows.length > 0);
          return {
            id: nodes[i]!.id,
            categoryId: nCategoryId[i]!,
            label: nodes[i]!.label,
            hex: hex4(i),
            state: STATE_LABEL[nState[i]!]!,
            degree: degree[i]!,
            groups,
            // Passed through by reference, never read or copied: the consumer
            // gets back the exact object it put on the node.
            data: nodes[i]!.data,
          };
        };

        /* ------------------------------------------------- navigation core
         The keyboard/screen-reader model (a11y/navigator.ts) runs here from
         the start, because its history also backs controller.back() for
         mouse readers. The DOM it speaks through arrives with the focus
         layer (phase 7); until then its announcements go nowhere.          */
        const nodeLabels = nodes.map((node) => node.label);
        const categoryLabel = (i: number) => nodeCategories[nCategoryId[i]!]!.label;
        // A consumer's ranking sees nodes and edges, not dense indices.
        const userRank = rankConnectionsRef.current;
        const toPublic = (c: NavConnection) => ({
          other: nodes[c.other]!,
          edge: liveEdges[c.edge]!,
          categoryId: c.categoryId,
          direction: c.direction,
          strength: c.strength,
        });
        const connections = buildConnections(
          n,
          eA,
          eB,
          eCategoryId,
          linkCategories,
          userRank
            ? (a, b) => userRank(toPublic(a), toPublic(b))
            : defaultRank(nodeLabels, linkCategoryIds),
        );
        const isVisible = (i: number) => i >= 0 && i < n && nHide[i] === 0;
        const isEdgeVisible = (e: number) => eP2[e * 4 + A_HIDE] === 0;
        // The node a reader lands on when there's nowhere better: the most
        // connected visible node, ties broken by label.
        const fallback = () => {
          let best = -1;
          for (let i = 0; i < n; i++) {
            if (!isVisible(i)) continue;
            if (
              best < 0 ||
              degree[i]! > degree[best]! ||
              (degree[i] === degree[best] && nodeLabels[i]!.localeCompare(nodeLabels[best]!) < 0)
            )
              best = i;
          }
          return best;
        };
        const describeCtx = (i: number, selected: boolean) => ({
          categoryLabel: categoryLabel(i),
          connections: connections[i]!.length,
          selected,
        });
        const navContext: NavContext = {
          connections: (i, filter) =>
            visibleConnections(connections[i]!, isVisible, isEdgeVisible, filter),
          allConnections: (i) => connections[i]!,
          isVisible,
          fallback,
          text: {
            summary: () => {
              let shownNodes = 0;
              for (let i = 0; i < n; i++) if (isVisible(i)) shownNodes++;
              const kinds = new Set<string>();
              for (let e = 0; e < m; e++) if (isEdgeVisible(e)) kinds.add(eCategoryId[e]!);
              return summaryText(shownNodes, drawnLinks, kinds.size);
            },
            node: (i, selected) =>
              describeNodeRef.current
                ? describeNodeRef.current(nodes[i]!, describeCtx(i, selected))
                : defaultNodeText(nodeLabels[i]!, describeCtx(i, selected)),
            connection: (_i, c, position, of) =>
              connectionText(
                linkCategories[c.categoryId]!,
                c,
                nodeLabels[c.other]!,
                categoryLabel(c.other),
                position,
                of,
              ),
            filter: filterText,
            detail: (i, selected) => {
              const counts = new Map<string, number>();
              for (const c of connections[i]!) {
                const rel = relationText(linkCategories[c.categoryId]!, c.direction);
                counts.set(rel, (counts.get(rel) ?? 0) + 1);
              }
              return detailText(nodeLabels[i]!, describeCtx(i, selected), [...counts]);
            },
            help: HELP_TEXT,
          },
        };
        let nav: NavState | null = null;
        let overlay: NavOverlay | null = null;

        /** The node holding keyboard focus, or -1 while focus is elsewhere. */
        function focusedNode(): number {
          return overlay?.focused && nav?.entered ? nav.current : -1;
        }
        /** The connection under the browse cursor, while browsing with focus inside. */
        function cursorConnection(): NavConnection | undefined {
          if (!nav || focusedNode() < 0 || nav.cursor < 0) return undefined;
          return navContext.connections(nav.current, nav.filter)[nav.cursor];
        }
        /**
         * Redraws whatever depends on attention. The neighbourhood follows
         * keyboard focus first, then the selection, then the pointer: the
         * reader's attention is wherever they are actively working. While
         * browsing, the connection Enter would follow stays incident-bright
         * and the node's other edges step down a tier, so it stands out
         * without anything changing width.
         */
        let hlTarget = -2,
          hlCursorEdge = -1;
        function refresh(force = false) {
          const f = focusedNode();
          const target = f >= 0 ? f : selIdx >= 0 ? selIdx : hoverIdx;
          const c = f >= 0 ? cursorConnection() : undefined;
          const cursorEdge = c ? c.edge : -1;
          // Only re-walk the neighbourhood when what it's centred on changes:
          // highlight() restarts the node ripple, and re-running it on every
          // hover over a selected graph would replay the selection's ripple.
          if (force || target !== hlTarget || cursorEdge !== hlCursorEdge) {
            highlight(target);
            if (c) {
              for (const it of inc[f]!) eP2[it.e * 4 + A_TIER] = it.e === c.edge ? 1 : TIER_NEARBY;
              aEP2.needsUpdate = true;
            }
            hlTarget = target;
            hlCursorEdge = cursorEdge;
          }
          marks();
          if (overlay && nav) {
            const sel = nav.selected === nav.current;
            overlay.setNode(navContext.text.node(nav.current, sel), sel);
            overlay.setHints(overlay.focused && keyHintsRef.current, fitInsetRef.current);
          }
        }
        function dispatch(action: NavAction) {
          if (!nav) return;
          const [next, fx] = navigate(nav, action, navContext);
          nav = next;
          if (fx.announce) overlay?.announce(fx.announce);
          if (fx.select !== undefined) {
            onSelectRef.current?.(fx.select >= 0 ? describe(fx.select) : null);
          }
          if (fx.leave) {
            overlay?.blur();
            rootEl?.focus({ preventScroll: true });
          }
          // Keyboard travel keeps the node in view; a click or the consumer
          // moving the selection is the selection camera's business.
          if (fx.moved && overlay?.focused && nav.current >= 0) rig.reveal(nav.current);
          if (action.type !== "selected" && action.type !== "visibility")
            onNavigateRef.current?.({
              action: action.type,
              node: nav.entered && nav.current >= 0 ? describe(nav.current) : null,
              announcement: fx.announce ?? "",
            });
          refresh();
        }
        // Escape steps out in stages: drop the selection, then the tooltip,
        // then leave the graph.
        function onEscape() {
          if (nav && nav.selected >= 0) return dispatch({ type: "escape" });
          if (tipIdx >= 0) {
            tipSuppressed = tipIdx;
            showTip(-1);
            return;
          }
          dispatch({ type: "escape" });
        }
        if (navEl) {
          overlay = createNavOverlay({
            container: navEl,
            onAction: dispatch,
            onEscape,
            onFocusChange: (focused) => {
              if (focused && nav && !nav.entered) dispatch({ type: "enter" });
              else refresh();
            },
          });
          const o = overlay;
          disposables.push(() => o.dispose());
        }
        // For a pointer reader too: Escape dismisses a hover tooltip without
        // having to move the pointer off the node (WCAG 1.4.13).
        const onWindowKey = (ev: KeyboardEvent) => {
          if (ev.key !== "Escape" || tipIdx < 0 || overlay?.focused) return;
          tipSuppressed = tipIdx;
          showTip(-1);
        };
        window.addEventListener("keydown", onWindowKey);
        disposables.push(() => window.removeEventListener("keydown", onWindowKey));
        api.current.focusNode = (i) => {
          if (!overlay || !nav) return;
          dispatch({ type: "focusNode", index: i });
          overlay.focus();
          if (nav.current >= 0) rig.reveal(nav.current);
        };
        api.current.back = () => dispatch({ type: "back" });
        api.current.canGoBack = () => (nav?.history.length ?? 0) > 0;

        api.current.params = (p) => sim.setParams(p);
        api.current.refilterInternal = () => {
          refilter();
          dispatch({ type: "visibility" });
          refresh(true);
          kick(0.14);
        };
        api.current.applySelectionInternal = (i) => applySelection(i);
        api.current.reheat = (v) => {
          sim.reheat(v);
          kick(0.3);
        };
        // A fresh arrangement of the same graph, without rebuilding the scene.
        // It scrambles the layout as much as a mount does, so the camera goes
        // back to tracking it. The intro sweep only replays if the camera never
        // left the auto-fit: a reader who has panned or zoomed gets a re-fit in
        // place, not a full-screen zoom they didn't ask for.
        api.current.reseed = () => {
          sim.reseed();
          aPos.needsUpdate = true;
          dirty = true;
          rig.reseed(reduced);
          kick(0.3);
        };
        api.current.getNodeByIndex = (i) => (i >= 0 && i < n ? describe(i) : null);
        api.current.fit = () => rig.fit();
        api.current.reframe = () => rig.reframe();
        api.current.focus = (i) => {
          if (i >= 0 && i < n) rig.focus(i);
        };
        // hiddenNodeCategories/hiddenLinkCategories/isolateId are already
        // reflected by the unconditional refilter() call above (the refs it
        // reads are kept current every render, including the first). Initial
        // selectedId still needs applying explicitly: unlike the original,
        // where `selected` always started null in the same component,
        // selectedId is a prop a consumer can pass non-null from first mount.
        applySelection(
          selectedId === null || selectedId === undefined ? -1 : (idToIndex.get(selectedId) ?? -1),
        );
        cameraFollowSelection = true;
        // Started after the initial selection, so a selection the consumer
        // mounts with is where the reader begins, not a move to go back from.
        nav = { ...initialNavState(selIdx >= 0 ? selIdx : fallback()), selected: selIdx };
        // Name the focus target now, not on the first interaction: an unnamed
        // button is the first thing a screen reader would meet tabbing in.
        refresh(true);

        // Seed the camera on the measured bounds of the (still spiral-seeded)
        // layout, then let the auto-fit track them as physics spreads it out.
        // The sweep starts zoomed in and eases out to that frame; under reduced
        // motion the camera simply starts there.
        rig.intro(reduced);

        /* A press only becomes a gesture once the pointer travels DRAG_SLOP_PX.
         Until then it is a click: it selects (or clears), and nothing else
         happens. Pinning a node on pointerdown used to reheat the whole
         layout on every click, shuffling the picture a reader was trying to
         learn, and a press on empty space used to take the camera off the
         auto-fit before anyone had panned anything.                          */
        const DRAG_SLOP_PX = 3;
        let drag = -1,
          panning = false,
          moved = false,
          pressIdx = -1,
          pressed = false,
          pressX = 0,
          pressY = 0,
          lastP = { x: 0, y: 0 };
        const el = renderer.domElement;
        const onMove = (ev: PointerEvent) => {
          const rc = el.getBoundingClientRect();
          const sx = ev.clientX - rc.left,
            sy = ev.clientY - rc.top,
            w = toWorld(sx, sy);
          sim.cursor(w.x, w.y, true);
          if (pressed && drag < 0 && !panning) {
            if (Math.hypot(sx - pressX, sy - pressY) > DRAG_SLOP_PX) {
              if (pressIdx >= 0) {
                drag = pressIdx;
              } else {
                // Only panning moves the view. A node drag doesn't, and ending
                // the auto-fit on one would freeze the intro's tracking while
                // the rest of the unsettled layout keeps rearranging around it.
                rig.takeOver();
                panning = true;
                lastP = { x: pressX, y: pressY };
              }
            }
          }
          if (drag >= 0) {
            sim.pin(drag, w.x, w.y);
            moved = true;
            return;
          }
          if (panning) {
            rig.panBy(-(sx - lastP.x) / rig.live.zoom, (sy - lastP.y) / rig.live.zoom);
            lastP = { x: sx, y: sy };
            moved = true;
            return;
          }
          const idx = pickNode(w.x, w.y, n, pos, nRadius, nHide, rig.live.zoom);
          if (idx !== hoverIdx) {
            hoverIdx = idx;
            tipSuppressed = -1;
            refresh();
            el.style.cursor = idx >= 0 ? "crosshair" : "grab";
          }
          showTip(idx);
        };
        const onDown = (ev: PointerEvent) => {
          try {
            el.setPointerCapture(ev.pointerId);
          } catch {
            /* noop */
          }
          const rc = el.getBoundingClientRect();
          const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
          moved = false;
          pressed = true;
          pressIdx = pickNode(w.x, w.y, n, pos, nRadius, nHide, rig.live.zoom);
          pressX = ev.clientX - rc.left;
          pressY = ev.clientY - rc.top;
          el.style.cursor = "grabbing";
        };
        const onUp = () => {
          if (drag >= 0) sim.pin(-1, 0, 0);
          drag = -1;
          panning = false;
          pressed = false;
          el.style.cursor = hoverIdx >= 0 ? "crosshair" : "grab";
        };
        const onClick = (ev: MouseEvent) => {
          if (moved) return;
          const rc = el.getBoundingClientRect();
          const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
          const idx = pickNode(w.x, w.y, n, pos, nRadius, nHide, rig.live.zoom);
          const next = idx >= 0 && idx !== selIdx ? idx : -1;
          onSelectRef.current?.(next >= 0 ? describe(next) : null);
        };
        const onWheel = (ev: WheelEvent) => {
          ev.preventDefault();
          rig.takeOver();
          const camT = rig.target;
          const rc = el.getBoundingClientRect();
          const sx = ev.clientX - rc.left,
            sy = ev.clientY - rc.top;
          // Anchor against the TARGET camera, not the smoothed one. Solving
          // against a lagging camera makes fast scrolls compound their error.
          viewport.curve = opticsRef.current.curve;
          const b = unproject(sx, sy, camT.zoom, camT.x, camT.y, viewport);
          camT.zoom = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, camT.zoom * Math.exp(-ev.deltaY * 0.0015)),
          );
          const a = unproject(sx, sy, camT.zoom, camT.x, camT.y, viewport);
          camT.x += b.x - a.x;
          camT.y += b.y - a.y;
        };
        const onLeave = () => {
          sim.cursor(0, 0, false);
          hoverIdx = -1;
          tipSuppressed = -1;
          refresh();
          showTip(-1);
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        el.addEventListener("click", onClick);
        el.addEventListener("pointerleave", onLeave);
        el.addEventListener("wheel", onWheel, { passive: false });
        el.style.cursor = "grab";
        disposables.push(() => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointerup", onUp);
          el.removeEventListener("click", onClick);
          el.removeEventListener("pointerleave", onLeave);
          el.removeEventListener("wheel", onWheel);
        });

        let raf = 0,
          last = performance.now(),
          accum = 0,
          dirty = true;
        let fA = 0,
          fN = 0,
          fT = 0;

        const screenPos = new Map<number, PlacedLabel>();
        const FOCUS_OUT: [number, number] = [0, 0];

        function frame(now: number) {
          raf = requestAnimationFrame(frame);
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          clock += dt;
          const t0 = performance.now();
          const c = opticsRef.current;
          viewport.curve = c.curve;

          let didStep = false;
          if (runRef.current || drag >= 0) {
            accum += dt;
            let s = 0;
            while (accum >= 1 / 60 && s < 3) {
              if (sim.step()) didStep = true;
              accum -= 1 / 60;
              s++;
            }
            if (didStep) {
              aPos.needsUpdate = true;
              dirty = true;
            }
          } else accum = 0;

          rig.tick({ dt, stepped: didStep, settled: sim.isSettled(), reduced });
          camera.position.x = rig.live.x;
          camera.position.y = rig.live.y;
          const camZoom = rig.live.zoom;
          onFrameRef.current?.({
            ids: denseIds,
            positions: pos,
            hidden: nHide,
            radii: nRadius,
            camera: { x: rig.live.x, y: rig.live.y, zoom: camZoom },
            viewport,
          });
          camera.zoom = camZoom;
          camera.updateProjectionMatrix();
          px = 1 / camZoom;

          if (dirty) {
            for (let e = 0; e < m; e++) {
              const a = eA[e]!,
                b = eB[e]!;
              eAPos[e * 2] = pos[a * 2]!;
              eAPos[e * 2 + 1] = pos[a * 2 + 1]!;
              eBPos[e * 2] = pos[b * 2]!;
              eBPos[e * 2 + 1] = pos[b * 2 + 1]!;
            }
            aEA.needsUpdate = true;
            aEB.needsUpdate = true;
            dirty = didStep;
          }

          nodeMat.uniforms.uTime!.value = clock;
          nodeMat.uniforms.uPx!.value = px;
          nodeMat.uniforms.uGlow!.value = c.glow;
          const uReduced = reduced ? 1 : 0;
          for (const mm of [edgeMat, edgeLiveMat]) {
            mm.uniforms.uTime!.value = clock;
            mm.uniforms.uPx!.value = px;
            mm.uniforms.uWidth!.value = c.edgeWidth;
            mm.uniforms.uOpacity!.value = c.edgeOpacity;
            mm.uniforms.uFlowSpeed!.value = c.flowSpeed;
            mm.uniforms.uReduced!.value = uReduced;
          }
          padMat.uniforms.uPx!.value = px;
          padMat.uniforms.uWidth!.value = c.edgeWidth;
          padMat.uniforms.uOpacity!.value = c.edgeOpacity;
          fadeMat.uniforms.uAlpha!.value = 1 - c.trails * 0.94;
          nodeMat.uniforms.uReduced!.value = uReduced;
          fadeMat.uniforms.uReduced!.value = uReduced;
          compMat.uniforms.uReduced!.value = uReduced;

          // The composite shader already gates the bands on uReduced; not
          // scheduling bursts at all just keeps the uniform at zero instead of
          // handing the GPU a value it is going to multiply away.
          if (!reduced && c.glitch > 0 && clock > glitchUntil && Math.random() < 0.0022 * c.glitch)
            kick(0.1 + Math.random() * 0.22);
          const gActive = !reduced && clock < glitchUntil ? c.glitch : 0;

          renderer.setRenderTarget(sceneRT);
          renderer.render(scene, camera);

          blurMat.uniforms.uTex!.value = sceneRT.texture;
          blurMat.uniforms.uDir!.value.set(1, 0);
          blurMat.uniforms.uThresh!.value = 0.34;
          fsQuad.material = blurMat;
          renderer.setRenderTarget(bloomA);
          renderer.clear();
          renderer.render(postScene, postCam);
          blurMat.uniforms.uTex!.value = bloomA.texture;
          blurMat.uniforms.uDir!.value.set(0, 1);
          blurMat.uniforms.uThresh!.value = 0.0;
          renderer.setRenderTarget(bloomB);
          renderer.clear();
          renderer.render(postScene, postCam);

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
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(postScene, postCam);

          /* ------------------------------------------------- label placement
           Which nodes earn a label, where, and how bright is decided in
           labels.ts. What follows only hands those placements to the DOM
           pool, keeping each label on the element it already owns.         */
          labelView.zoom = camZoom;
          labelView.cx = camera.position.x;
          labelView.cy = camera.position.y;
          labelView.mode = labelModeRef.current;
          labelView.selIdx = selIdx;
          const kf = focusedNode();
          labelView.hoverIdx = kf >= 0 ? kf : hoverIdx;
          labelPlacer.place(labelView, screenPos);
          // Keep the focus target over the node the reader is on, so a screen
          // reader's focus box and the canvas ring land in the same place.
          if (overlay && nav && nav.current >= 0) {
            const c = nav.current;
            const fp = project(
              pos[c * 2]!,
              pos[c * 2 + 1]!,
              camZoom,
              rig.live.x,
              rig.live.y,
              viewport,
              FOCUS_OUT,
            );
            overlay.place(fp[0], fp[1], glyphRadiusPx(nRadius[c]!, camZoom) * 2);
          }
          for (let k = 0; k < POOL; k++) {
            if (owner[k]! >= 0 && !screenPos.has(owner[k]!)) {
              owner[k] = -1;
              labels[k]!.style.opacity = "0";
            }
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

          fA += 1 / Math.max(dt, 1e-4);
          fN++;
          fT += dt;
          if (fT > 0.5) {
            const stats: GraphStats = {
              fps: Math.round(fA / fN),
              nodes: n,
              edges: m,
              frameMs: +(performance.now() - t0).toFixed(2),
              settled: sim.isSettled(),
              drawnNodes,
              drawnEdges: drawnLinks,
            };
            onStatsRef.current?.(stats);
            fA = 0;
            fN = 0;
            fT = 0;
          }
        }
        raf = requestAnimationFrame(frame);
        disposables.push(() => cancelAnimationFrame(raf));

        // A lost context can't be drawn to. three's WebGLRenderer registers its
        // own listeners on this canvas: its webglcontextlost handler calls
        // preventDefault() — so the browser IS asked to restore the context —
        // and its webglcontextrestored handler re-initialises three's GL state.
        // This component deliberately does not resume: the frame loop stops
        // here and the failure surfaces the same way a thrown boot does,
        // through the halt panel and onFatal, and nothing in this component
        // listens for webglcontextrestored (a future change could, and restart
        // the loop). Unmount still drains everything above. Registered last so
        // it is the first thing removed on teardown — the forceContextLoss() in
        // cleanup fires this very event.
        const onContextLost = () => {
          cancelAnimationFrame(raf);
          const message = "WebGL context lost";
          setFatal(message);
          onFatalRef.current?.(message);
        };
        el.addEventListener("webglcontextlost", onContextLost);
        disposables.push(() => el.removeEventListener("webglcontextlost", onContextLost));
      }
      // Deliberate: this effect builds and tears down the entire WebGL scene, so
      // it may only re-run when the graph data itself changes. Optics, callbacks
      // and selection are read through the refs above precisely so a slider drag
      // doesn't reallocate every buffer on the GPU.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, nodeCategories, linkCategories, seed, invalidEdges, keyboardNavigation]);

    if (fatal) {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: FALLBACK_BG,
            color: FALLBACK_FG,
            padding: 40,
            font: `400 12px/1.8 ${MONO}`,
            ...style,
          }}
          className={className}
        >
          <div style={{ color: FALLBACK_CRITICAL, letterSpacing: ".24em", marginBottom: 12 }}>
            ▚ SYSTEM HALT
          </div>
          <div>{fatal}</div>
        </div>
      );
    }

    // With keyboard navigation on, the root is a named group the reader tabs
    // into: its one focus target is a button inside it, and children of
    // role="img" would be presentational, hidden from assistive tech. Off, it
    // is a named image as in 1.x. role="img" only appears with a name: an
    // unnamed image role is itself an axe "role-img-alt" (WCAG A) failure.
    // tabIndex -1 lets Escape hand focus back to the graph as a whole rather
    // than dropping it on <body>.
    return (
      <div
        ref={rootRef}
        role={keyboardNavigation ? "group" : hasName ? "img" : undefined}
        aria-roledescription={keyboardNavigation ? "graph" : undefined}
        aria-label={hasName ? ariaLabel : undefined}
        tabIndex={keyboardNavigation ? -1 : undefined}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: FALLBACK_BG,
          overflow: "hidden",
          ...style,
        }}
        className={className}
      >
        <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
        {/* Rotating label pool + tooltip are placement-driven decoration, not
          content — aria-hidden here backstops the same attribute set on each
          element as it's created in boot(), so the whole layer reads as
          hidden even before the canvas mounts. */}
        <div
          ref={labelRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
        {/* The navigation layer: the focus target, the live region and the
          key hint (a11y/overlay.ts). Visible to assistive tech, unlike the
          label layer above. */}
        {keyboardNavigation && (
          <div ref={navRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        )}
      </div>
    );
  },
) as (<T = unknown>(
  props: GraphCanvasProps<T> & RefAttributes<GraphController<T>>,
) => ReactElement) & { displayName?: string };
