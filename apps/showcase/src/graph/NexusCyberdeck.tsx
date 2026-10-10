import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import type {
  GraphController,
  GraphNodeSnapshot,
  GraphStats,
  OpticsConfig,
  PhysicsConfig,
} from "@nexus-cyberdeck/graph";
import { CONSOLE_WIDTH, DEFAULT_CFG, DEFAULT_STATS, DRAWER_WIDTH, PANEL_GAP } from "./controls.js";
import type { SetDeckConfig } from "./controls.js";
import { GraphConsole } from "./GraphConsole.js";
import type { LabelMode } from "./GraphConsole.js";
import { GraphLegend } from "./GraphLegend.js";
import { InspectorDrawer } from "./InspectorDrawer.js";
import { OutlinePanel } from "./OutlinePanel.js";
import { generateSampleGraph } from "./sampleData.js";
import {
  LINK_CATEGORIES,
  LINK_CATEGORY_IDS,
  NODE_CATEGORIES,
  NODE_CATEGORY_IDS,
} from "./taxonomy.js";

/* ============================================================================
   NEXUS // CYBERDECK  —  typed knowledge graph on a CRT

   The physics, shaders and render loop live in @nexus-cyberdeck/graph's
   <GraphCanvas>, generic over any node/edge taxonomy. This page owns exactly
   what a consumer of that package is expected to own: the sample data
   (taxonomy.ts, sampleData.ts), the slider state (controls.ts) and the chrome
   around the canvas (GraphConsole, GraphLegend, InspectorDrawer, OutlinePanel).
   ========================================================================== */

/** Space the console leaves on the left, and the drawer on the right, in px. */
const CONSOLE_INSET = PANEL_GAP + CONSOLE_WIDTH + PANEL_GAP;
const DRAWER_INSET = PANEL_GAP + DRAWER_WIDTH + PANEL_GAP;

const allOn = (ids: readonly string[]) => Object.fromEntries(ids.map((k) => [k, true]));

export default function NexusCyberdeck() {
  const controllerRef = useRef<GraphController>(null);

  const [total, setTotal] = useState(200);
  const [stats, setStats] = useState<GraphStats>(DEFAULT_STATS);
  // controller.canGoBack is read after each selection change, when GraphCanvas's
  // own effects (a child's) have run and its history is current, and after
  // every keyboard step, which can add history without selecting anything.
  const [canGoBack, setCanGoBack] = useState(false);
  // The same graph as a list (GraphOutline), over the canvas. The canvas stays
  // mounted underneath, so closing the list returns to exactly the same view.
  const [isListView, setIsListView] = useState(false);
  const [selected, setSelected] = useState<GraphNodeSnapshot | null>(null);
  // Whether the current selection came from a key inside the graph (onSelect's
  // source). The drawer stays non-modal for those, so the reader keeps their
  // place in the graph; every other way of selecting opens it as a dialog.
  const [isKeyboardSelection, setIsKeyboardSelection] = useState(false);
  useEffect(() => {
    setCanGoBack(controllerRef.current?.canGoBack ?? false);
  }, [selected]);
  const [isolate, setIsolate] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>("auto");

  const [nodeOn, setNodeOn] = useState(() => allOn(NODE_CATEGORY_IDS));
  const [linkOn, setLinkOn] = useState(() => allOn(LINK_CATEGORY_IDS));

  const [cfg, setCfg] = useState(DEFAULT_CFG);
  const set = useCallback<SetDeckConfig>((k, v) => setCfg((p) => ({ ...p, [k]: v })), []);

  const sampleGraph = useMemo(() => generateSampleGraph(total), [total]);

  const hiddenNodeCategories = useMemo(() => NODE_CATEGORY_IDS.filter((k) => !nodeOn[k]), [nodeOn]);
  const hiddenLinkCategories = useMemo(() => LINK_CATEGORY_IDS.filter((k) => !linkOn[k]), [linkOn]);

  const physics: Partial<PhysicsConfig> = {
    repulsion: cfg.repulsion,
    linkDistance: cfg.linkDistance,
    cursorForce: cfg.cursorForce,
    settle: cfg.settle,
  };
  const optics: Partial<OpticsConfig> = {
    glow: cfg.glow,
    trails: cfg.trails,
    edgeOpacity: cfg.edgeOpacity,
    edgeWidth: cfg.edgeWidth,
    flowSpeed: cfg.flowSpeed,
    scan: cfg.scan,
    aberr: cfg.aberr,
    curve: cfg.curve,
    grain: cfg.grain,
    bloom: cfg.bloom,
    glitch: cfg.glitch,
  };

  const clearSelection = useCallback(() => {
    setSelected(null);
    setIsolate(null);
  }, []);

  const goTo = useCallback((id: number) => {
    const d = controllerRef.current?.getNode(id);
    if (!d) return;
    setSelected(d);
    setIsKeyboardSelection(false);
    controllerRef.current?.focus(id);
    // walking the graph while isolated should move the isolation with you,
    // otherwise the node you just jumped to is the only thing you can't expand
    setIsolate((v) => (v !== null ? id : v));
  }, []);

  useEffect(() => {
    // A page-wide "Escape resets the view". Not for an Escape something has
    // already handled: the graph's own Escape steps out one stage at a time
    // (selection, tooltip, then the graph), and clearing the isolation on top
    // of "leave the graph" would throw away the reader's context.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  return (
    <div
      data-nx-theme="hud"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "var(--nx-bg-canvas)",
        overflow: "hidden",
      }}
    >
      <GraphCanvas
        ref={controllerRef}
        ariaLabel="Knowledge graph of Nexus Cyberdeck sample data"
        nodes={sampleGraph.nodes}
        edges={sampleGraph.edges}
        nodeCategories={NODE_CATEGORIES}
        linkCategories={LINK_CATEGORIES}
        physics={physics}
        optics={optics}
        labelMode={labelMode}
        hiddenNodeCategories={hiddenNodeCategories}
        hiddenLinkCategories={hiddenLinkCategories}
        isolateId={isolate}
        selectedId={selected?.id ?? null}
        // The console (left) and the details drawer (right, only while
        // something is selected) float over the canvas. Framing lands the
        // graph in what they leave.
        fitInset={{ left: CONSOLE_INSET, right: selected ? DRAWER_INSET : 0 }}
        running={isRunning}
        onSelect={(node, source) => {
          setSelected(node);
          setIsKeyboardSelection(source === "keyboard");
        }}
        onNavigate={() => setCanGoBack(controllerRef.current?.canGoBack ?? false)}
        onStats={setStats}
      />

      {/* -------------------------------------------------- left: console+legend */}
      <div
        style={{
          position: "absolute",
          top: "var(--nx-space-5)",
          left: "var(--nx-space-5)",
          width: CONSOLE_WIDTH,
          display: "flex",
          flexDirection: "column",
          gap: "var(--nx-space-3)",
          maxHeight: "calc(100% - var(--nx-space-6))",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        <GraphConsole
          stats={stats}
          cfg={cfg}
          onConfig={set}
          total={total}
          onTotal={(v) => {
            clearSelection();
            setTotal(v);
          }}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          isRunning={isRunning}
          isListView={isListView}
          canGoBack={canGoBack}
          onFit={() => controllerRef.current?.fit()}
          onReheat={() => controllerRef.current?.reheat()}
          onToggleRunning={() => setIsRunning((r) => !r)}
          onReseed={() => {
            clearSelection();
            controllerRef.current?.reseed();
          }}
          onToggleListView={() => setIsListView((v) => !v)}
          onBack={() => controllerRef.current?.back()}
        />
        <GraphLegend
          nodeOn={nodeOn}
          linkOn={linkOn}
          onNodeToggle={(k, v) => setNodeOn((p) => ({ ...p, [k]: v }))}
          onLinkToggle={(k, v) => setLinkOn((p) => ({ ...p, [k]: v }))}
        />
      </div>

      {/* ------------------------------------------------------------ list view */}
      {isListView && (
        <OutlinePanel
          nodes={sampleGraph.nodes}
          edges={sampleGraph.edges}
          hiddenNodeCategories={hiddenNodeCategories}
          hiddenLinkCategories={hiddenLinkCategories}
          isolateId={isolate}
          selectedId={selected?.id ?? null}
          rightInset={selected ? DRAWER_INSET : PANEL_GAP}
          onSelect={(id) => {
            setSelected(controllerRef.current?.getNode(id) ?? null);
            setIsKeyboardSelection(false);
          }}
        />
      )}

      {/* ------------------------------------------------------------- drawer */}
      <InspectorDrawer
        selected={selected}
        isModal={!isKeyboardSelection}
        onClose={clearSelection}
        isolate={isolate}
        onIsolate={() => {
          if (!selected) return;
          const id = selected.id as number;
          setIsolate((v) => (v === id ? null : id));
        }}
        onFocus={() => {
          if (selected) controllerRef.current?.focus(selected.id);
        }}
        onGoTo={goTo}
      />

      {/* ------------------------------------------------------------ hint bar */}
      <div
        style={{
          position: "absolute",
          bottom: "var(--nx-space-4)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--nx-font-mono)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
          color: "var(--nx-fg-disabled)",
          textTransform: "uppercase",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        click lock · drag pan · scroll zoom · esc clear
      </div>
    </div>
  );
}
