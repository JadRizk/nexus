import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import type { GraphController, GraphStats } from "@nexus-cyberdeck/graph";
import { CONSOLE_WIDTH, DEFAULT_STATS, DRAWER_WIDTH, PANEL_GAP } from "./controls.js";
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
import { useCategoryFilter } from "./useCategoryFilter.js";
import { useDeckConfig } from "./useDeckConfig.js";
import { useEscapeToClear } from "./useEscapeToClear.js";
import { useGraphSelection } from "./useGraphSelection.js";

const CONSOLE_INSET = PANEL_GAP + CONSOLE_WIDTH + PANEL_GAP;
const DRAWER_INSET = PANEL_GAP + DRAWER_WIDTH + PANEL_GAP;

export default function NexusCyberdeck() {
  const controllerRef = useRef<GraphController>(null);

  const [total, setTotal] = useState(60);
  const [stats, setStats] = useState<GraphStats>(DEFAULT_STATS);
  const [isListView, setIsListView] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [labelMode, setLabelMode] = useState<LabelMode>("auto");

  const selection = useGraphSelection(controllerRef);
  const { selected, isolate, clearSelection } = selection;
  useEscapeToClear(clearSelection);
  const nodeFilter = useCategoryFilter(NODE_CATEGORY_IDS);
  const linkFilter = useCategoryFilter(LINK_CATEGORY_IDS);
  const { config, setConfigValue, physics, optics } = useDeckConfig();

  const sampleGraph = useMemo(() => generateSampleGraph(total), [total]);

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
        hiddenNodeCategories={nodeFilter.hidden}
        hiddenLinkCategories={linkFilter.hidden}
        isolateId={isolate}
        selectedId={selected?.id ?? null}
        fitInset={{ left: CONSOLE_INSET, right: selected ? DRAWER_INSET : 0 }}
        running={isRunning}
        onSelect={selection.select}
        onNavigate={selection.syncCanGoBack}
        onStats={setStats}
      />

      <ConsoleColumn>
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
          canGoBack={selection.canGoBack}
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
          nodeOn={nodeFilter.shown}
          linkOn={linkFilter.shown}
          onNodeToggle={nodeFilter.setCategoryShown}
          onLinkToggle={linkFilter.setCategoryShown}
        />
      </ConsoleColumn>

      {isListView && (
        <OutlinePanel
          nodes={sampleGraph.nodes}
          edges={sampleGraph.edges}
          hiddenNodeCategories={nodeFilter.hidden}
          hiddenLinkCategories={linkFilter.hidden}
          isolateId={isolate}
          selectedId={selected?.id ?? null}
          rightInset={selected ? DRAWER_INSET : PANEL_GAP}
          onSelect={selection.selectById}
        />
      )}

      <InspectorDrawer
        selected={selected}
        isModal={!selection.isKeyboardSelection}
        onClose={clearSelection}
        isolate={isolate}
        onIsolate={selection.toggleIsolate}
        onFocus={() => {
          if (selected) controllerRef.current?.focus(selected.id);
        }}
        onGoTo={selection.goTo}
      />

      <KeyHints />
    </div>
  );
}

function ConsoleColumn({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function KeyHints() {
  return (
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
  );
}
