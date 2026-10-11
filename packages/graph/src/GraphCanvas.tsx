import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactElement, RefAttributes } from "react";
import { createPhysics } from "./physics.js";
import { mulberry32 } from "./random.js";
import { prepareGraph } from "./prepare.js";
import { A_HIDE, A_TIER, packBuffers } from "./buffers.js";
import { createRenderer, createScene, resize as resizeScene } from "./scene.js";
import { FALLBACK_BG } from "./scene-meshes.js";
import type { Track } from "./scene.js";
import { glyphRadiusPx, project, unproject, ZOOM_MAX, ZOOM_MIN } from "./camera.js";
import { createCameraRig } from "./camera-rig.js";
import type { FitInset } from "./camera.js";
import { computeNeighbourhood, isolationSet, TIER_NEARBY } from "./neighbourhood.js";
import { pickNode } from "./picking.js";
import { createLabelLayer, LABEL_POOL_SIZE, MONO } from "./label-layer.js";
import type { LabelView, PlacedLabel } from "./labels.js";
import { buildConnections, defaultRank, visibleConnections } from "./a11y/adjacency.js";
import { initialNavState, lastVisible, navigate } from "./a11y/navigator.js";
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
import { STATE_LABEL } from "./types.js";
import type {
  GraphCanvasProps,
  GraphController,
  GraphNodeSnapshot,
  FrameGeometry,
  GraphStats,
  PhysicsConfig,
  OpticsConfig,
  SelectSource,
} from "./types.js";

// Not from @nexus-cyberdeck/tokens: this package can't assume `--nx-*` properties exist.
const FALLBACK_FG = "#DFF5C7";
const FALLBACK_CRITICAL = "#FF2E63";

/** What `physics` is merged over. */
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
/** What `optics` is merged over. */
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

// Not @types/node: the package runs in browsers.
declare const process: { env: { NODE_ENV?: string } };

// The literal `process.env.NODE_ENV` is what bundlers replace; unbundled, `process` is missing.
function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
}

const hex4 = (i: number): string =>
  (((i * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

interface InternalController {
  params?: (physics: Partial<PhysicsConfig>) => void;
  refilterInternal?: () => void;
  applySelectionInternal?: (index: number) => void;
  fit?: () => void;
  focus?: (index: number) => void;
  reheat?: (energy: number) => void;
  reseed?: () => void;
  /** Re-runs the whole-graph fit, but only while the auto-fit still owns the camera. */
  reframe?: () => void;
  getNodeByIndex?: (index: number) => GraphNodeSnapshot | null;
  back?: () => void;
  canGoBack?: () => boolean;
  focusNode?: (index: number) => void;
}

// forwardRef isn't generic, so the cast at the end types `data` for callers.
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
    const navigationRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const api = useRef<InternalController>({});
    const [fatal, setFatal] = useState<string | null>(null);

    const physicsConfig: PhysicsConfig = { ...DEFAULT_PHYSICS, ...physicsProp };
    const opticsConfig: OpticsConfig = { ...DEFAULT_OPTICS, ...opticsProp };

    // Ref mirrors, not useEffectEvent: that needs React 19 and this package supports 18.3.
    const opticsRef = useRef(opticsConfig);
    opticsRef.current = opticsConfig;
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
    const rankConnectionsRef = useRef(rankConnections);
    rankConnectionsRef.current = rankConnections;
    const keyHintsRef = useRef(keyHints);
    keyHintsRef.current = keyHints;

    const hasName = Boolean(ariaLabel);
    useEffect(() => {
      if (keyboardNavigation && !hasName && isDevelopment())
        console.warn(
          "GraphCanvas: keyboard navigation is on but no ariaLabel was given — screen readers will announce an unnamed group.",
        );
    }, [keyboardNavigation, hasName]);

    useImperativeHandle(
      ref,
      () => ({
        fit: () => api.current.fit?.(),
        focus: (id) => {
          const index = idToIndexRef.current.get(id);
          if (index !== undefined) api.current.focus?.(index);
        },
        reheat: (energy = 1.0) => api.current.reheat?.(energy),
        focusNode: (id) => {
          const index = idToIndexRef.current.get(id);
          if (index !== undefined) api.current.focusNode?.(index);
        },
        back: () => api.current.back?.(),
        get canGoBack() {
          return api.current.canGoBack?.() ?? false;
        },
        reseed: () => api.current.reseed?.(),
        getNode: (id) => {
          const index = idToIndexRef.current.get(id);
          return index !== undefined ? (api.current.getNodeByIndex?.(index) ?? null) : null;
        },
      }),
      [],
    );

    const idToIndexRef = useRef<Map<unknown, number>>(new Map());

    // Depends on the fields: physicsConfig is a new object every render.
    useEffect(() => {
      api.current.params?.({
        repulsion: physicsConfig.repulsion,
        linkDistance: physicsConfig.linkDistance,
        gravity: physicsConfig.gravity,
        damping: physicsConfig.damping,
        cursorForce: physicsConfig.cursorForce,
        sectorForce: physicsConfig.sectorForce,
        radiusForce: physicsConfig.radiusForce,
        settle: physicsConfig.settle,
      });
    }, [
      physicsConfig.repulsion,
      physicsConfig.linkDistance,
      physicsConfig.gravity,
      physicsConfig.damping,
      physicsConfig.cursorForce,
      physicsConfig.sectorForce,
      physicsConfig.radiusForce,
      physicsConfig.settle,
    ]);

    // By content: an inline `["tag"]` is a new array every render.
    const hiddenNodeKey = JSON.stringify(hiddenNodeCategories ?? []);
    const hiddenLinkKey = JSON.stringify(hiddenLinkCategories ?? []);
    const scopedLinkKey = JSON.stringify(selectionScopedLinkCategories ?? []);
    useEffect(() => {
      api.current.refilterInternal?.();
    }, [hiddenNodeKey, hiddenLinkKey, scopedLinkKey, isolateId]);

    useEffect(() => {
      api.current.reframe?.();
    }, [insetTop, insetRight, insetBottom, insetLeft]);

    useEffect(() => {
      const index = selectedId === null ? -1 : (idToIndexRef.current.get(selectedId) ?? -1);
      api.current.applySelectionInternal?.(index);
    }, [selectedId]);

    useEffect(() => {
      const mount = mountRef.current,
        labelLayer = labelRef.current,
        navigationLayer = navigationRef.current,
        root = rootRef.current;
      if (!mount || !labelLayer) return;
      // Registered as each resource is built, so a throw mid-boot releases what exists; drained in reverse.
      const disposables: Array<() => void> = [];
      const track: Track = (release) => {
        disposables.push(release);
      };
      const dispose = () => {
        while (disposables.length > 0) {
          try {
            disposables.pop()!();
          } catch (error) {
            console.error(error);
          }
        }
        api.current = {};
      };
      try {
        boot(mount, labelLayer, navigationLayer, root);
      } catch (error) {
        dispose();
        const message = String((error as Error)?.message ?? error);
        console.error(error);
        setFatal(message);
        onFatalRef.current?.(message);
      }
      return dispose;

      function boot(
        mountEl: HTMLDivElement,
        labelEl: HTMLDivElement,
        navigationEl: HTMLDivElement | null,
        rootEl: HTMLDivElement | null,
      ) {
        const {
          idToIndex,
          edgeEndA,
          edgeEndB,
          liveEdges,
          dropped,
          nodeCount,
          edgeCount,
          nodeCategoryIds,
          denseIds,
          edgeCategoryIds,
          linkCategoryIds,
          degree,
          nodeStates,
          layoutSeed,
          physicsGraph,
        } = prepareGraph({ nodes, edges, nodeCategories, linkCategories, invalidEdges, seed });
        idToIndexRef.current = idToIndex;
        if (dropped.length > 0) {
          const message = `GraphCanvas: dropped ${dropped.length} edge(s) whose endpoint matches no node`;
          if (onWarningRef.current) onWarningRef.current(message, { dropped });
          else console.warn(message, dropped);
        }

        // A separate stream, so drawing shader seeds never moves a node.
        const visualRandom =
          layoutSeed === undefined ? Math.random : mulberry32(layoutSeed ^ 0x5bd1e995);

        const simulation = createPhysics(
          physicsGraph,
          layoutSeed === undefined ? {} : { seed: layoutSeed },
        );
        // The params effect can't reach the solver on the render that creates it.
        simulation.setParams(physicsConfig);
        const positions = simulation.pos;

        const stage = createRenderer(mountEl, track);
        const { renderer, scene, camera } = stage;

        // After the Scene and Camera: unseeded, their uuids draw from the same Math.random.
        const buffers = packBuffers({
          nodes,
          nodeCategories,
          nodeCategoryIds,
          degree,
          liveEdges,
          linkCategories,
          edgeCategoryIds,
          edgeEndA,
          edgeEndB,
          visualRandom,
        });
        const {
          nodeRadii,
          nodeDepths,
          nodeMarks,
          nodeHidden,
          nodeTiers,
          edgeAPositions,
          edgeBPositions,
          edgeParams2,
        } = buffers;
        const sceneParts = createScene({
          scene,
          buffers,
          nodeStates,
          positions,
          nodeCount,
          edgeCount,
          optics: opticsConfig,
          track,
        });
        const {
          nodeMaterial,
          edgeMaterial,
          edgeLiveMaterial,
          padMaterial,
          fadeMaterial,
          blurMaterial,
          compositeMaterial,
          sceneTarget,
          bloomA,
          bloomB,
          screenQuad,
          postScene,
          postCamera,
          edgeAAttribute,
          edgeBAttribute,
          edgeParams2Attribute,
          positionAttribute,
          syncNodes,
        } = sceneParts;

        const { labels, owner, labelPlacer, tooltip } = createLabelLayer(labelEl, track);

        let viewWidth = 1,
          viewHeight = 1,
          pixelSize = 1;
        const rig = createCameraRig({
          bounds: (indices) => computeBounds(indices),
          position: (i) => [positions[i * 2]!, positions[i * 2 + 1]!],
          viewport: () => ({ width: viewWidth, height: viewHeight }),
          inset: () => fitInsetRef.current,
        });
        const viewport: Viewport = { width: 1, height: 1, curve: opticsConfig.curve };
        const labelView: LabelView = {
          count: nodeCount,
          pos: positions,
          hidden: nodeHidden,
          radii: nodeRadii,
          depth: nodeDepths,
          tier: nodeTiers,
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
          viewWidth = mountEl.clientWidth || 1;
          viewHeight = mountEl.clientHeight || 1;
          viewport.width = viewWidth;
          viewport.height = viewHeight;
          resizeScene(stage, sceneParts, viewWidth, viewHeight);
        }
        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mountEl);
        disposables.push(() => resizeObserver.disconnect());
        const toWorld = (sx: number, sy: number) => {
          viewport.curve = opticsRef.current.curve;
          return unproject(sx, sy, rig.live.zoom, rig.live.x, rig.live.y, viewport);
        };

        const nodeLabels = nodes.map((node) => node.label);
        const userRank = rankConnectionsRef.current;
        const toPublic = (connection: NavConnection) => ({
          other: nodes[connection.other]!,
          edge: liveEdges[connection.edge]!,
          categoryId: connection.categoryId,
          direction: connection.direction,
          strength: connection.strength,
        });
        const connections = buildConnections(
          nodeCount,
          edgeEndA,
          edgeEndB,
          edgeCategoryIds,
          linkCategories,
          userRank
            ? (a, b) => userRank(toPublic(a), toPublic(b))
            : defaultRank(nodeLabels, linkCategoryIds),
        );
        const neighbourhoodGraph = {
          inc: connections,
          eA: edgeEndA,
          eB: edgeEndB,
          hidden: nodeHidden,
          edgeHidden: (e: number) => edgeParams2[e * 4 + A_HIDE] !== 0,
        };
        const edgeTiers = new Float32Array(edgeCount);

        let selectedIndex = -1,
          hoveredIndex = -1,
          clock = 0,
          glitchUntil = -1,
          drawnLinks = edgeCount,
          drawnNodes = nodeCount,
          visibilityEpoch = 0;

        const kick = (seconds: number) => {
          glitchUntil = clock + seconds;
        };

        // Guarded: jsdom and SSR lack matchMedia, Safari < 14 has addListener only.
        const motionQuery =
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null;
        let reduced = motionQuery?.matches ?? false;
        const applyReduced = () => {
          renderer.domElement.dataset.nxReducedMotion = String(reduced);
        };
        const handleMotionChange = (event: MediaQueryListEvent) => {
          reduced = event.matches;
          applyReduced();
        };
        if (motionQuery) {
          if (typeof motionQuery.addEventListener === "function")
            motionQuery.addEventListener("change", handleMotionChange);
          else motionQuery.addListener(handleMotionChange);
        }
        applyReduced();
        disposables.push(() => {
          if (!motionQuery) return;
          if (typeof motionQuery.removeEventListener === "function")
            motionQuery.removeEventListener("change", handleMotionChange);
          else motionQuery.removeListener(handleMotionChange);
        });

        if (!reduced) kick(0.8);

        function refilter() {
          const hiddenNode = new Set(hiddenNodeRef.current ?? []);
          const hiddenLink = new Set(hiddenLinkRef.current ?? []);
          const scopedLink = new Set(scopedLinkRef.current ?? []);
          const isolatedId = isolateRef.current;
          const isolatedIndex =
            isolatedId === null || isolatedId === undefined
              ? -1
              : (idToIndex.get(isolatedId) ?? -1);
          const allow = isolationSet(isolatedIndex, edgeEndA, edgeEndB);
          let shownNodes = 0;
          for (let i = 0; i < nodeCount; i++) {
            nodeHidden[i] =
              hiddenNode.has(nodeCategoryIds[i]!) || (allow !== null && !allow.has(i)) ? 1 : 0;
            if (!nodeHidden[i]) shownNodes++;
          }
          drawnNodes = shownNodes;
          let shown = 0;
          for (let e = 0; e < edgeCount; e++) {
            const categoryId = edgeCategoryIds[e]!;
            const scopedOut =
              scopedLink.has(categoryId) &&
              edgeEndA[e] !== selectedIndex &&
              edgeEndB[e] !== selectedIndex;
            const isShown =
              !hiddenLink.has(categoryId) &&
              !scopedOut &&
              !nodeHidden[edgeEndA[e]!] &&
              !nodeHidden[edgeEndB[e]!];
            edgeParams2[e * 4 + A_HIDE] = isShown ? 0 : 1;
            if (isShown) shown++;
          }
          drawnLinks = shown;
          visibilityEpoch++;
          syncNodes();
          edgeParams2Attribute.needsUpdate = true;
        }
        refilter();

        function computeBounds(
          indices?: readonly number[],
        ): [number, number, number, number] | null {
          let x0 = Infinity,
            y0 = Infinity,
            x1 = -Infinity,
            y1 = -Infinity,
            hasAny = false;
          const count = indices ? indices.length : nodeCount;
          for (let k = 0; k < count; k++) {
            const i = indices ? indices[k]! : k;
            if (nodeHidden[i]) continue;
            hasAny = true;
            const x = positions[i * 2]!,
              y = positions[i * 2 + 1]!;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
          return hasAny ? [x0, y0, x1, y1] : null;
        }
        // Off during boot: framing the pre-physics scatter would fight the intro sweep.
        let cameraFollowSelection = false;

        function highlight(index: number) {
          computeNeighbourhood(neighbourhoodGraph, index, nodeDepths, edgeTiers);
          for (let e = 0; e < edgeCount; e++) edgeParams2[e * 4 + A_TIER] = edgeTiers[e]!;
          if (index >= 0) {
            nodeMaterial.uniforms.uHlStart!.value = clock;
          }
          syncNodes();
          edgeParams2Attribute.needsUpdate = true;
          const focus = index >= 0 ? 1 : 0;
          nodeMaterial.uniforms.uFocus!.value = focus;
          edgeMaterial.uniforms.uFocus!.value = focus;
          edgeLiveMaterial.uniforms.uFocus!.value = focus;
          padMaterial.uniforms.uFocus!.value = focus;
        }
        let tooltipIndex = -1,
          suppressedTooltip = -1;
        const TOOLTIP_OUT: [number, number] = [0, 0];
        function showTooltip(index: number) {
          if (index < 0 || index === selectedIndex || index === suppressedTooltip) {
            tooltip.style.opacity = "0";
            tooltip.dataset.k = "";
            tooltipIndex = -1;
            return;
          }
          tooltipIndex = index;
          const category = nodeCategories[nodeCategoryIds[index]!]!;
          if (tooltip.dataset.k !== String(index)) {
            tooltip.dataset.k = String(index);
            tooltip.textContent = "";
            const name = document.createElement("span");
            name.style.color = category.color;
            name.textContent = nodes[index]!.label;
            const meta = document.createElement("span");
            // 4.5:1 over the brightest node colour behind the translucent ground.
            meta.style.color = "#6F8465";
            meta.textContent = " · " + category.code + " · " + degree[index];
            tooltip.appendChild(name);
            tooltip.appendChild(meta);
            tooltip.style.borderLeftColor = category.color;
          }
          // Beside the node, on the side fewer of its edges leave from.
          const anchor = project(
            positions[index * 2]!,
            positions[index * 2 + 1]!,
            rig.live.zoom,
            rig.live.x,
            rig.live.y,
            viewport,
            TOOLTIP_OUT,
          );
          const radius = glyphRadiusPx(nodeRadii[index]!, rig.live.zoom);
          const width = tooltip.offsetWidth,
            height = tooltip.offsetHeight;
          let toRight = 0,
            toLeft = 0;
          for (const connection of connections[index]!) {
            if (positions[connection.other * 2]! >= positions[index * 2]!) toRight++;
            else toLeft++;
          }
          const inset = fitInsetRef.current;
          const rightX = anchor[0] + radius + 12,
            leftX = anchor[0] - radius - 12 - width;
          let x = toRight <= toLeft ? rightX : leftX;
          if (x === rightX && x + width > viewWidth - inset.right) x = leftX;
          else if (x === leftX && x < inset.left) x = rightX;
          const y = Math.min(
            Math.max(anchor[1] - height / 2, inset.top + 4),
            Math.max(inset.top + 4, viewHeight - inset.bottom - height - 4),
          );
          tooltip.style.transform = "translate3d(" + (x | 0) + "px," + (y | 0) + "px,0)";
          tooltip.style.opacity = "1";
        }

        // Shader marks: 1 hovered or browsed, 2 selected, +4 keyboard focus.
        function marks() {
          nodeMarks.fill(0);
          if (hoveredIndex >= 0) nodeMarks[hoveredIndex] = 1;
          const browsed = cursorConnection();
          if (browsed) nodeMarks[browsed.other] = Math.max(nodeMarks[browsed.other]!, 1);
          if (selectedIndex >= 0) nodeMarks[selectedIndex] = 2;
          const focused = focusedNode();
          if (focused >= 0) nodeMarks[focused] = nodeMarks[focused]! + 4;
          syncNodes();
        }
        function applySelection(index: number) {
          selectedIndex = index;
          if (navigation) dispatch({ type: "selected", index });
          const scoped = Boolean(scopedLinkRef.current?.length);
          if (scoped) refilterKeepingCursor();
          if (index >= 0) kick(0.22);
          refresh(scoped);
          if (index >= 0 && index === hoveredIndex) showTooltip(-1);
          if (cameraFollowSelection && followSelectionRef.current) {
            if (index >= 0)
              rig.frameAround(
                index,
                connections[index]!.map((connection) => connection.other),
              );
            else rig.release();
          }
        }
        const describe = (i: number): GraphNodeSnapshot => {
          // Declared category order, so a category sits in the same place for every node.
          const groups = linkCategoryIds
            .map((categoryId) => ({
              categoryId,
              // A self-loop is one connection but a row from each end.
              rows: connections[i]!.filter((connection) => connection.categoryId === categoryId)
                .flatMap((connection) =>
                  connection.other === i
                    ? [
                        { connection, out: true },
                        { connection, out: false },
                      ]
                    : [{ connection, out: connection.out }],
                )
                .sort(
                  (first, second) =>
                    nodeLabels[first.connection.other]!.localeCompare(
                      nodeLabels[second.connection.other]!,
                    ) ||
                    first.connection.edge - second.connection.edge ||
                    Number(second.out) - Number(first.out),
                )
                .map(({ connection, out }) => ({
                  id: nodes[connection.other]!.id,
                  label: nodes[connection.other]!.label,
                  categoryId: nodeCategoryIds[connection.other]!,
                  out,
                })),
            }))
            .filter((group) => group.rows.length > 0);
          return {
            id: nodes[i]!.id,
            categoryId: nodeCategoryIds[i]!,
            label: nodes[i]!.label,
            hex: hex4(i),
            state: STATE_LABEL[nodeStates[i]!]!,
            degree: degree[i]!,
            groups,
            data: nodes[i]!.data,
          };
        };

        const categoryLabel = (i: number) => nodeCategories[nodeCategoryIds[i]!]!.label;
        const isVisible = (i: number) => i >= 0 && i < nodeCount && nodeHidden[i] === 0;
        const isEdgeVisible = (e: number) => edgeParams2[e * 4 + A_HIDE] === 0;
        const fallback = () => {
          let best = -1;
          for (let i = 0; i < nodeCount; i++) {
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
        // The count spoken on landing must match the list browsing reads.
        const reachable = (i: number) =>
          visibleConnections(connections[i]!, isVisible, isEdgeVisible, "all");
        const describeContext = (i: number, selected: boolean) => ({
          categoryLabel: categoryLabel(i),
          connections: reachable(i).length,
          selected,
        });
        const navigationContext: NavContext = {
          connections: (i, filter) =>
            visibleConnections(connections[i]!, isVisible, isEdgeVisible, filter),
          allConnections: (i) => connections[i]!,
          isVisible,
          fallback,
          text: {
            summary: () => {
              let shownNodes = 0;
              for (let i = 0; i < nodeCount; i++) if (isVisible(i)) shownNodes++;
              const kinds = new Set<string>();
              for (let e = 0; e < edgeCount; e++)
                if (isEdgeVisible(e)) kinds.add(edgeCategoryIds[e]!);
              return summaryText(shownNodes, drawnLinks, kinds.size);
            },
            node: (i, selected) =>
              describeNodeRef.current
                ? describeNodeRef.current(nodes[i]!, describeContext(i, selected))
                : defaultNodeText(nodeLabels[i]!, describeContext(i, selected)),
            connection: (_i, connection, position, of) =>
              connectionText(
                linkCategories[connection.categoryId]!,
                connection,
                nodeLabels[connection.other]!,
                categoryLabel(connection.other),
                position,
                of,
              ),
            filter: filterText,
            detail: (i, selected) => {
              const counts = new Map<string, number>();
              for (const connection of reachable(i)) {
                const relation = relationText(
                  linkCategories[connection.categoryId]!,
                  connection.direction,
                );
                counts.set(relation, (counts.get(relation) ?? 0) + 1);
              }
              return detailText(nodeLabels[i]!, describeContext(i, selected), [...counts]);
            },
            help: HELP_TEXT,
          },
        };
        let navigation: NavState | null = null;
        let overlay: NavOverlay | null = null;

        function focusedNode(): number {
          return overlay?.focused && navigation?.entered ? navigation.current : -1;
        }
        function cursorConnection(): NavConnection | undefined {
          if (!navigation || focusedNode() < 0 || navigation.cursor < 0) return undefined;
          return navigationContext.connections(navigation.current, navigation.filter)[
            navigation.cursor
          ];
        }
        // Attention follows keyboard focus, then the selection, then the pointer.
        let highlightTarget = -2,
          highlightCursorEdge = -1;
        // The focus target's name never depends on the pointer, so hover doesn't rebuild it.
        let labelKey = "",
          labelDescriber: typeof describeNodeRef.current | null = null;
        function refresh(force = false) {
          const focused = focusedNode();
          const target = focused >= 0 ? focused : selectedIndex >= 0 ? selectedIndex : hoveredIndex;
          const browsed = focused >= 0 ? cursorConnection() : undefined;
          const cursorEdge = browsed ? browsed.edge : -1;
          // highlight() restarts the ripple, so only when its centre changes.
          if (force || target !== highlightTarget || cursorEdge !== highlightCursorEdge) {
            highlight(target);
            if (browsed) {
              for (const connection of connections[focused]!)
                edgeParams2[connection.edge * 4 + A_TIER] =
                  connection.edge === browsed.edge ? 1 : TIER_NEARBY;
              edgeParams2Attribute.needsUpdate = true;
            }
            highlightTarget = target;
            highlightCursorEdge = cursorEdge;
          }
          marks();
          if (overlay && navigation) {
            const isSelected =
              navigation.current >= 0 && navigation.selected === navigation.current;
            const key = `${navigation.current}|${isSelected}|${visibilityEpoch}`;
            if (key !== labelKey || describeNodeRef.current !== labelDescriber) {
              labelKey = key;
              labelDescriber = describeNodeRef.current;
              overlay.setNode(
                navigation.current >= 0
                  ? navigationContext.text.node(navigation.current, isSelected)
                  : navigationContext.text.summary(),
                isSelected,
              );
            }
            overlay.setHints(overlay.focused && keyHintsRef.current, fitInsetRef.current);
          }
        }
        function dispatch(action: NavAction, via: SelectSource = "keyboard") {
          if (!navigation) return;
          const [next, effects] = navigate(navigation, action, navigationContext);
          navigation = next;
          // A filter change is only news to a reader inside the graph.
          if (effects.announce && (action.type !== "visibility" || overlay?.focused))
            overlay?.announce(effects.announce);
          if (effects.select !== undefined) {
            onSelectRef.current?.(effects.select >= 0 ? describe(effects.select) : null, via);
          }
          if (effects.leave && rootEl) {
            // Untabbable until focus moves on, or the next Tab lands straight back in.
            overlay?.setTabbable(false);
            overlay?.blur();
            rootEl.focus({ preventScroll: true });
          } else if (effects.leave) overlay?.blur();
          if (effects.moved && overlay?.focused && navigation.current >= 0)
            rig.reveal(navigation.current);
          if (action.type !== "selected" && action.type !== "visibility")
            onNavigateRef.current?.({
              action: action.type,
              node:
                navigation.entered && navigation.current >= 0 ? describe(navigation.current) : null,
              announcement: effects.announce ?? "",
            });
          refresh();
        }
        function handleEscape() {
          if (navigation && navigation.selected >= 0) return dispatch({ type: "escape" });
          if (tooltipIndex >= 0) {
            suppressedTooltip = tooltipIndex;
            showTooltip(-1);
            return;
          }
          dispatch({ type: "escape" });
        }
        if (navigationEl) {
          overlay = createNavOverlay({
            container: navigationEl,
            onAction: dispatch,
            onEscape: handleEscape,
            onFocusChange: (focused) => {
              if (focused && navigation && !navigation.entered) dispatch({ type: "enter" });
              else refresh();
            },
          });
          const navOverlay = overlay;
          disposables.push(() => navOverlay.dispose());
          if (rootEl) {
            const handleRootBlur = () => navOverlay.setTabbable(true);
            rootEl.addEventListener("blur", handleRootBlur);
            disposables.push(() => rootEl.removeEventListener("blur", handleRootBlur));
          }
        }
        const handleWindowKey = (event: KeyboardEvent) => {
          if (event.key !== "Escape" || tooltipIndex < 0 || overlay?.focused) return;
          suppressedTooltip = tooltipIndex;
          showTooltip(-1);
          // Lets a page-level Escape see that only the tooltip closed.
          event.preventDefault();
        };
        window.addEventListener("keydown", handleWindowKey);
        disposables.push(() => window.removeEventListener("keydown", handleWindowKey));
        api.current.focusNode = (index) => {
          if (!overlay || !navigation) return;
          dispatch({ type: "focusNode", index });
          overlay.focus();
          if (navigation.current >= 0) rig.reveal(navigation.current);
        };
        api.current.back = () => dispatch({ type: "back" }, "controller");
        api.current.canGoBack = () =>
          navigation ? lastVisible(navigation.history, navigationContext) >= 0 : false;
        function refilterKeepingCursor() {
          // Not cursorConnection(): the cursor outlives a Tab out of the graph.
          const edge =
            navigation && navigation.cursor >= 0
              ? navigationContext.connections(navigation.current, navigation.filter)[
                  navigation.cursor
                ]?.edge
              : undefined;
          refilter();
          dispatch(edge === undefined ? { type: "visibility" } : { type: "visibility", edge });
        }

        api.current.params = (physics) => simulation.setParams(physics);
        api.current.refilterInternal = () => {
          refilterKeepingCursor();
          refresh(true);
          kick(0.14);
        };
        api.current.applySelectionInternal = (index) => applySelection(index);
        api.current.reheat = (energy) => {
          simulation.reheat(energy);
          kick(0.3);
        };
        api.current.reseed = () => {
          simulation.reseed();
          positionAttribute.needsUpdate = true;
          dirty = true;
          rig.reseed(reduced);
          kick(0.3);
        };
        api.current.getNodeByIndex = (index) =>
          index >= 0 && index < nodeCount ? describe(index) : null;
        api.current.fit = () => rig.fit();
        api.current.reframe = () => rig.reframe();
        api.current.focus = (index) => {
          if (index >= 0 && index < nodeCount) rig.focus(index);
        };
        applySelection(
          selectedId === null || selectedId === undefined ? -1 : (idToIndex.get(selectedId) ?? -1),
        );
        cameraFollowSelection = true;
        // After the initial selection, so it isn't a step back() can undo.
        navigation = {
          ...initialNavState(selectedIndex >= 0 ? selectedIndex : fallback()),
          selected: selectedIndex,
        };
        refresh(true);

        rig.intro(reduced);

        const DRAG_SLOP_PX = 3;
        let draggedIndex = -1,
          panning = false,
          moved = false,
          pressedIndex = -1,
          pressed = false,
          pressX = 0,
          pressY = 0,
          lastPointer = { x: 0, y: 0 };
        const el = renderer.domElement;
        const handlePointerMove = (event: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          const sx = event.clientX - rect.left,
            sy = event.clientY - rect.top,
            world = toWorld(sx, sy);
          simulation.cursor(world.x, world.y, true);
          if (pressed && draggedIndex < 0 && !panning) {
            if (Math.hypot(sx - pressX, sy - pressY) > DRAG_SLOP_PX) {
              if (pressedIndex >= 0) {
                draggedIndex = pressedIndex;
              } else {
                // Only panning ends the auto-fit; a node drag would freeze the intro's tracking.
                rig.takeOver();
                panning = true;
                lastPointer = { x: pressX, y: pressY };
              }
            }
          }
          if (draggedIndex >= 0) {
            simulation.pin(draggedIndex, world.x, world.y);
            moved = true;
            return;
          }
          if (panning) {
            rig.panBy(-(sx - lastPointer.x) / rig.live.zoom, (sy - lastPointer.y) / rig.live.zoom);
            lastPointer = { x: sx, y: sy };
            moved = true;
            return;
          }
          const index = pickNode(
            world.x,
            world.y,
            nodeCount,
            positions,
            nodeRadii,
            nodeHidden,
            rig.live.zoom,
          );
          if (index !== hoveredIndex) {
            hoveredIndex = index;
            suppressedTooltip = -1;
            refresh();
            el.style.cursor = index >= 0 ? "crosshair" : "grab";
          }
          showTooltip(index);
        };
        const handlePointerDown = (event: PointerEvent) => {
          // A click focuses the root without a blur, so restore the Tab path here.
          overlay?.setTabbable(true);
          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            // The pointer can already be gone.
          }
          const rect = el.getBoundingClientRect();
          const world = toWorld(event.clientX - rect.left, event.clientY - rect.top);
          moved = false;
          pressed = true;
          pressedIndex = pickNode(
            world.x,
            world.y,
            nodeCount,
            positions,
            nodeRadii,
            nodeHidden,
            rig.live.zoom,
          );
          pressX = event.clientX - rect.left;
          pressY = event.clientY - rect.top;
          el.style.cursor = "grabbing";
        };
        const handlePointerUp = () => {
          if (draggedIndex >= 0) simulation.pin(-1, 0, 0);
          draggedIndex = -1;
          panning = false;
          pressed = false;
          el.style.cursor = hoveredIndex >= 0 ? "crosshair" : "grab";
        };
        const handleClick = (event: MouseEvent) => {
          if (moved) return;
          const rect = el.getBoundingClientRect();
          const world = toWorld(event.clientX - rect.left, event.clientY - rect.top);
          const index = pickNode(
            world.x,
            world.y,
            nodeCount,
            positions,
            nodeRadii,
            nodeHidden,
            rig.live.zoom,
          );
          const next = index >= 0 && index !== selectedIndex ? index : -1;
          onSelectRef.current?.(next >= 0 ? describe(next) : null, "pointer");
        };
        const handleWheel = (event: WheelEvent) => {
          event.preventDefault();
          rig.takeOver();
          const targetCamera = rig.target;
          const rect = el.getBoundingClientRect();
          const sx = event.clientX - rect.left,
            sy = event.clientY - rect.top;
          // Anchor on the target camera: the smoothed one lags and compounds fast scrolls.
          viewport.curve = opticsRef.current.curve;
          const before = unproject(
            sx,
            sy,
            targetCamera.zoom,
            targetCamera.x,
            targetCamera.y,
            viewport,
          );
          targetCamera.zoom = Math.min(
            ZOOM_MAX,
            Math.max(ZOOM_MIN, targetCamera.zoom * Math.exp(-event.deltaY * 0.0015)),
          );
          const after = unproject(
            sx,
            sy,
            targetCamera.zoom,
            targetCamera.x,
            targetCamera.y,
            viewport,
          );
          targetCamera.x += before.x - after.x;
          targetCamera.y += before.y - after.y;
        };
        const handlePointerLeave = () => {
          simulation.cursor(0, 0, false);
          hoveredIndex = -1;
          suppressedTooltip = -1;
          refresh();
          showTooltip(-1);
        };
        el.addEventListener("pointermove", handlePointerMove);
        el.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointerup", handlePointerUp);
        el.addEventListener("click", handleClick);
        el.addEventListener("pointerleave", handlePointerLeave);
        el.addEventListener("wheel", handleWheel, { passive: false });
        el.style.cursor = "grab";
        disposables.push(() => {
          el.removeEventListener("pointermove", handlePointerMove);
          el.removeEventListener("pointerdown", handlePointerDown);
          window.removeEventListener("pointerup", handlePointerUp);
          el.removeEventListener("click", handleClick);
          el.removeEventListener("pointerleave", handlePointerLeave);
          el.removeEventListener("wheel", handleWheel);
        });

        let frameRequest = 0,
          last = performance.now(),
          accumulator = 0,
          dirty = true;
        let fpsSum = 0,
          fpsFrames = 0,
          fpsElapsed = 0;

        const screenPositions = new Map<number, PlacedLabel>();
        const frameGeometry: FrameGeometry = {
          ids: denseIds,
          positions,
          hidden: nodeHidden,
          radii: nodeRadii,
          camera: { x: 0, y: 0, zoom: 1 },
          viewport,
        };
        const FOCUS_OUT: [number, number] = [0, 0];

        function frame(now: number) {
          frameRequest = requestAnimationFrame(frame);
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          clock += dt;
          const frameStart = performance.now();
          const optics = opticsRef.current;
          viewport.curve = optics.curve;

          let didStep = false;
          if (runRef.current || draggedIndex >= 0) {
            accumulator += dt;
            let steps = 0;
            while (accumulator >= 1 / 60 && steps < 3) {
              if (simulation.step()) didStep = true;
              accumulator -= 1 / 60;
              steps++;
            }
            if (didStep) {
              positionAttribute.needsUpdate = true;
              dirty = true;
            }
          } else accumulator = 0;

          rig.tick({ dt, stepped: didStep, settled: simulation.isSettled(), reduced });
          camera.position.x = rig.live.x;
          camera.position.y = rig.live.y;
          const zoom = rig.live.zoom;
          if (onFrameRef.current) {
            frameGeometry.camera.x = rig.live.x;
            frameGeometry.camera.y = rig.live.y;
            frameGeometry.camera.zoom = zoom;
            onFrameRef.current(frameGeometry);
          }
          camera.zoom = zoom;
          camera.updateProjectionMatrix();
          pixelSize = 1 / zoom;

          if (dirty) {
            for (let e = 0; e < edgeCount; e++) {
              const a = edgeEndA[e]!,
                b = edgeEndB[e]!;
              edgeAPositions[e * 2] = positions[a * 2]!;
              edgeAPositions[e * 2 + 1] = positions[a * 2 + 1]!;
              edgeBPositions[e * 2] = positions[b * 2]!;
              edgeBPositions[e * 2 + 1] = positions[b * 2 + 1]!;
            }
            edgeAAttribute.needsUpdate = true;
            edgeBAttribute.needsUpdate = true;
            dirty = didStep;
          }

          nodeMaterial.uniforms.uTime!.value = clock;
          nodeMaterial.uniforms.uPx!.value = pixelSize;
          nodeMaterial.uniforms.uGlow!.value = optics.glow;
          const uReduced = reduced ? 1 : 0;
          for (const material of [edgeMaterial, edgeLiveMaterial]) {
            material.uniforms.uTime!.value = clock;
            material.uniforms.uPx!.value = pixelSize;
            material.uniforms.uWidth!.value = optics.edgeWidth;
            material.uniforms.uOpacity!.value = optics.edgeOpacity;
            material.uniforms.uFlowSpeed!.value = optics.flowSpeed;
            material.uniforms.uReduced!.value = uReduced;
          }
          padMaterial.uniforms.uPx!.value = pixelSize;
          padMaterial.uniforms.uWidth!.value = optics.edgeWidth;
          padMaterial.uniforms.uOpacity!.value = optics.edgeOpacity;
          fadeMaterial.uniforms.uAlpha!.value = 1 - optics.trails * 0.94;
          nodeMaterial.uniforms.uReduced!.value = uReduced;
          fadeMaterial.uniforms.uReduced!.value = uReduced;
          compositeMaterial.uniforms.uReduced!.value = uReduced;

          if (
            !reduced &&
            optics.glitch > 0 &&
            clock > glitchUntil &&
            Math.random() < 0.0022 * optics.glitch
          )
            kick(0.1 + Math.random() * 0.22);
          const glitchAmount = !reduced && clock < glitchUntil ? optics.glitch : 0;

          renderer.setRenderTarget(sceneTarget);
          renderer.render(scene, camera);

          blurMaterial.uniforms.uTex!.value = sceneTarget.texture;
          blurMaterial.uniforms.uDir!.value.set(1, 0);
          blurMaterial.uniforms.uThresh!.value = 0.34;
          screenQuad.material = blurMaterial;
          renderer.setRenderTarget(bloomA);
          renderer.clear();
          renderer.render(postScene, postCamera);
          blurMaterial.uniforms.uTex!.value = bloomA.texture;
          blurMaterial.uniforms.uDir!.value.set(0, 1);
          blurMaterial.uniforms.uThresh!.value = 0.0;
          renderer.setRenderTarget(bloomB);
          renderer.clear();
          renderer.render(postScene, postCamera);

          compositeMaterial.uniforms.uScene!.value = sceneTarget.texture;
          compositeMaterial.uniforms.uBloom!.value = bloomB.texture;
          compositeMaterial.uniforms.uTime!.value = clock;
          compositeMaterial.uniforms.uScan!.value = optics.scan;
          compositeMaterial.uniforms.uAberr!.value = optics.aberr;
          compositeMaterial.uniforms.uCurve!.value = optics.curve;
          compositeMaterial.uniforms.uGrain!.value = optics.grain;
          compositeMaterial.uniforms.uBloomAmt!.value = optics.bloom;
          compositeMaterial.uniforms.uGlitch!.value = glitchAmount;
          screenQuad.material = compositeMaterial;
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(postScene, postCamera);

          labelView.zoom = zoom;
          labelView.cx = camera.position.x;
          labelView.cy = camera.position.y;
          labelView.mode = labelModeRef.current;
          labelView.selIdx = selectedIndex;
          const keyboardFocus = focusedNode();
          labelView.hoverIdx = keyboardFocus >= 0 ? keyboardFocus : hoveredIndex;
          labelPlacer.place(labelView, screenPositions);
          if (overlay && navigation && navigation.current >= 0) {
            const current = navigation.current;
            const focusPoint = project(
              positions[current * 2]!,
              positions[current * 2 + 1]!,
              zoom,
              rig.live.x,
              rig.live.y,
              viewport,
              FOCUS_OUT,
            );
            overlay.place(
              focusPoint[0],
              focusPoint[1],
              glyphRadiusPx(nodeRadii[current]!, zoom) * 2,
            );
          }
          for (let k = 0; k < LABEL_POOL_SIZE; k++) {
            if (owner[k]! >= 0 && !screenPositions.has(owner[k]!)) {
              owner[k] = -1;
              labels[k]!.style.opacity = "0";
            }
          }
          const held = new Set<number>();
          for (let k = 0; k < LABEL_POOL_SIZE; k++) if (owner[k]! >= 0) held.add(owner[k]!);
          let free = 0;
          for (const id of screenPositions.keys()) {
            if (held.has(id)) continue;
            while (free < LABEL_POOL_SIZE && owner[free]! >= 0) free++;
            if (free >= LABEL_POOL_SIZE) break;
            owner[free] = id;
            const category = nodeCategories[nodeCategoryIds[id]!]!;
            const poolLabel = labels[free]!;
            poolLabel.textContent = nodes[id]!.label;
            poolLabel.style.color = category.color;
            poolLabel.style.fontSize = category.tier === 0 ? "10.5px" : "9px";
            poolLabel.style.fontWeight = category.tier === 0 ? "700" : "500";
            poolLabel.style.letterSpacing = category.tier === 0 ? ".16em" : ".08em";
            held.add(id);
          }
          for (let k = 0; k < LABEL_POOL_SIZE; k++) {
            const id = owner[k]!;
            if (id < 0) continue;
            const placed = screenPositions.get(id)!;
            labels[k]!.style.transform = `translate3d(${placed[0] | 0}px,${placed[1] | 0}px,0)`;
            labels[k]!.style.opacity = String(placed[2]);
          }

          fpsSum += 1 / Math.max(dt, 1e-4);
          fpsFrames++;
          fpsElapsed += dt;
          if (fpsElapsed > 0.5) {
            const stats: GraphStats = {
              fps: Math.round(fpsSum / fpsFrames),
              nodes: nodeCount,
              edges: edgeCount,
              frameMs: +(performance.now() - frameStart).toFixed(2),
              settled: simulation.isSettled(),
              drawnNodes,
              drawnEdges: drawnLinks,
            };
            onStatsRef.current?.(stats);
            fpsSum = 0;
            fpsFrames = 0;
            fpsElapsed = 0;
          }
        }
        frameRequest = requestAnimationFrame(frame);
        disposables.push(() => cancelAnimationFrame(frameRequest));

        // Not resumed on restore. Registered last so teardown removes it before forceContextLoss() fires it.
        const handleContextLost = () => {
          cancelAnimationFrame(frameRequest);
          const message = "WebGL context lost";
          setFatal(message);
          onFatalRef.current?.(message);
        };
        el.addEventListener("webglcontextlost", handleContextLost);
        disposables.push(() => el.removeEventListener("webglcontextlost", handleContextLost));
      }
      // Rebuilds the whole WebGL scene, so only graph data re-runs it; the rest is read through refs.
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

    // A group, not an image: children of role="img" are hidden from assistive tech.
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
        <div
          ref={labelRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
        {keyboardNavigation && (
          <div
            ref={navigationRef}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          />
        )}
      </div>
    );
  },
) as (<T = unknown>(
  props: GraphCanvasProps<T> & RefAttributes<GraphController<T>>,
) => ReactElement) & { displayName?: string };
