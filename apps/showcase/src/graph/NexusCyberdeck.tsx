import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import type {
  GraphController,
  GraphNodeSnapshot,
  GraphStats,
  OpticsConfig,
  PhysicsConfig,
} from "@nexus-cyberdeck/graph";
import {
  CONSOLE_WIDTH,
  DEFAULT_CONFIG,
  DEFAULT_STATS,
  DRAWER_WIDTH,
  PANEL_GAP,
} from "./controls.js";
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

const CONSOLE_INSET = PANEL_GAP + CONSOLE_WIDTH + PANEL_GAP;
const DRAWER_INSET = PANEL_GAP + DRAWER_WIDTH + PANEL_GAP;

const allOn = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, true]));

export default function NexusCyberdeck() {
  const controllerRef = useRef<GraphController>(null);

  const [total, setTotal] = useState(60);
  const [stats, setStats] = useState<GraphStats>(DEFAULT_STATS);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isListView, setIsListView] = useState(false);
  const [selected, setSelected] = useState<GraphNodeSnapshot | null>(null);
  const [isKeyboardSelection, setIsKeyboardSelection] = useState(false);
  // An effect, not derived: the history lives in the controller and is current only after GraphCanvas's effects.
  useEffect(() => {
    setCanGoBack(controllerRef.current?.canGoBack ?? false);
  }, [selected]);
  const [isolate, setIsolate] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>("auto");

  const [nodeOn, setNodeOn] = useState(() => allOn(NODE_CATEGORY_IDS));
  const [linkOn, setLinkOn] = useState(() => allOn(LINK_CATEGORY_IDS));

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const setConfigValue = useCallback<SetDeckConfig>(
    (key, value) => setConfig((previous) => ({ ...previous, [key]: value })),
    [],
  );

  const sampleGraph = useMemo(() => generateSampleGraph(total), [total]);

  const hiddenNodeCategories = useMemo(
    () => NODE_CATEGORY_IDS.filter((categoryId) => !nodeOn[categoryId]),
    [nodeOn],
  );
  const hiddenLinkCategories = useMemo(
    () => LINK_CATEGORY_IDS.filter((categoryId) => !linkOn[categoryId]),
    [linkOn],
  );

  const physics: Partial<PhysicsConfig> = {
    repulsion: config.repulsion,
    linkDistance: config.linkDistance,
    cursorForce: config.cursorForce,
    settle: config.settle,
  };
  const optics: Partial<OpticsConfig> = {
    glow: config.glow,
    trails: config.trails,
    edgeOpacity: config.edgeOpacity,
    edgeWidth: config.edgeWidth,
    flowSpeed: config.flowSpeed,
    scan: config.scan,
    aberr: config.aberr,
    curve: config.curve,
    grain: config.grain,
    bloom: config.bloom,
    glitch: config.glitch,
  };

  const clearSelection = useCallback(() => {
    setSelected(null);
    setIsolate(null);
  }, []);

  const handleGoTo = useCallback((id: number) => {
    const node = controllerRef.current?.getNode(id);
    if (!node) return;
    setSelected(node);
    setIsKeyboardSelection(false);
    controllerRef.current?.focus(id);
    // An isolation follows the walk, or the node just reached couldn't be expanded.
    setIsolate((previous) => (previous !== null ? id : previous));
  }, []);

  useEffect(() => {
    // Skip an Escape the graph already handled: it steps out one stage at a time.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clearSelection();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
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
        fitInset={{ left: CONSOLE_INSET, right: selected ? DRAWER_INSET : 0 }}
        running={isRunning}
        onSelect={(node, source) => {
          setSelected(node);
          setIsKeyboardSelection(source === "keyboard");
        }}
        onNavigate={() => setCanGoBack(controllerRef.current?.canGoBack ?? false)}
        onStats={setStats}
      />

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
          config={config}
          onConfig={setConfigValue}
          total={total}
          onTotal={(nextTotal) => {
            clearSelection();
            setTotal(nextTotal);
          }}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          isRunning={isRunning}
          isListView={isListView}
          canGoBack={canGoBack}
          onFit={() => controllerRef.current?.fit()}
          onReheat={() => controllerRef.current?.reheat()}
          onToggleRunning={() => setIsRunning((isCurrentlyRunning) => !isCurrentlyRunning)}
          onReseed={() => {
            clearSelection();
            controllerRef.current?.reseed();
          }}
          onToggleListView={() => setIsListView((isCurrentlyListView) => !isCurrentlyListView)}
          onBack={() => controllerRef.current?.back()}
        />
        <GraphLegend
          nodeOn={nodeOn}
          linkOn={linkOn}
          onNodeToggle={(categoryId, isOn) =>
            setNodeOn((previous) => ({ ...previous, [categoryId]: isOn }))
          }
          onLinkToggle={(categoryId, isOn) =>
            setLinkOn((previous) => ({ ...previous, [categoryId]: isOn }))
          }
        />
      </div>

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

      <InspectorDrawer
        selected={selected}
        isModal={!isKeyboardSelection}
        onClose={clearSelection}
        isolate={isolate}
        onIsolate={() => {
          if (!selected) return;
          const id = selected.id as number;
          setIsolate((previous) => (previous === id ? null : id));
        }}
        onFocus={() => {
          if (selected) controllerRef.current?.focus(selected.id);
        }}
        onGoTo={handleGoTo}
      />

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
