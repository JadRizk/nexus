import { useState } from "react";
import type { GraphStats } from "@nexus-cyberdeck/graph";
import {
  BlinkCursor,
  Button,
  HazardRule,
  KeyValue,
  Panel,
  Slider,
  TabStrip,
  Wordmark,
} from "@nexus-cyberdeck/react";
import { OPTICS_SLIDERS, SOLVER_SLIDERS } from "./controls.js";
import type { DeckConfig, SetDeckConfig, SliderSpec } from "./controls.js";

export type LabelMode = "auto" | "key" | "all" | "off";

export interface GraphConsoleProps {
  stats: GraphStats;
  cfg: DeckConfig;
  onConfig: SetDeckConfig;
  total: number;
  onTotal: (total: number) => void;
  labelMode: LabelMode;
  onLabelMode: (mode: LabelMode) => void;
  isRunning: boolean;
  isListView: boolean;
  canGoBack: boolean;
  onFit: () => void;
  onReheat: () => void;
  onToggleRunning: () => void;
  onReseed: () => void;
  onToggleListView: () => void;
  onBack: () => void;
}

const KV_GAP = { gap: "var(--nx-space-2)" };

function fpsColour(fps: number): string {
  if (fps > 50) return "var(--nx-fg-accent)";
  if (fps > 28) return "var(--nx-fg-warning)";
  return "var(--nx-fg-critical)";
}

function StatsReadout({ stats }: { stats: GraphStats }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
        <span
          style={{
            fontFamily: "var(--nx-font-stencil)",
            fontSize: "var(--nx-text-xl)",
            lineHeight: 0.8,
            color: fpsColour(stats.fps),
          }}
        >
          {stats.fps}
        </span>
      </div>
      <div
        style={{
          marginTop: "var(--nx-space-2)",
          color: "var(--nx-fg-tertiary)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
        }}
      >
        CYBERDECK v2.6 <BlinkCursor />
      </div>
      <HazardRule style={{ margin: "var(--nx-space-3) 0" }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1px var(--nx-space-2)",
        }}
      >
        <KeyValue
          style={KV_GAP}
          label="NODES"
          // "drawn/total" while a filter or an isolate hides some.
          value={
            stats.drawnNodes < stats.nodes ? `${stats.drawnNodes}/${stats.nodes}` : stats.nodes
          }
        />
        <KeyValue style={KV_GAP} label="LINKS" value={stats.edges} />
        <KeyValue style={KV_GAP} label="DRAWN" value={stats.drawnEdges} />
        <KeyValue style={KV_GAP} label="FRAME" value={stats.frameMs} />
        <KeyValue
          style={KV_GAP}
          label="SOLVER"
          value={
            <span style={{ color: stats.settled ? "var(--nx-fg-accent)" : "var(--nx-fg-warning)" }}>
              {stats.settled ? "LOCKED" : "COOLING"}
            </span>
          }
        />
      </div>
    </>
  );
}

function ConfigSliders({
  sliders,
  cfg,
  onConfig,
}: {
  sliders: readonly SliderSpec[];
  cfg: DeckConfig;
  onConfig: SetDeckConfig;
}) {
  return (
    <>
      {sliders.map(({ key, ...slider }) => (
        <Slider key={key} {...slider} value={cfg[key]} onChange={(v) => onConfig(key, v)} />
      ))}
    </>
  );
}

/** The left-hand console: frame stats, the optics and solver sliders, label mode and actions. */
export function GraphConsole(props: GraphConsoleProps) {
  const { cfg, onConfig } = props;
  const [tab, setTab] = useState<"crt" | "sim">("crt");
  return (
    <Panel style={{ flexShrink: 0 }}>
      <StatsReadout stats={props.stats} />

      <div style={{ margin: "var(--nx-space-4) 0 var(--nx-space-3)" }}>
        <TabStrip
          value={tab}
          onChange={setTab}
          label="Optics or solver controls"
          tabs={[
            { value: "crt", label: "Optics" },
            { value: "sim", label: "Solver" },
          ]}
        />
      </div>

      {tab === "crt" ? (
        <ConfigSliders sliders={OPTICS_SLIDERS} cfg={cfg} onConfig={onConfig} />
      ) : (
        <>
          <ConfigSliders sliders={SOLVER_SLIDERS} cfg={cfg} onConfig={onConfig} />
          <Slider
            label="corpus size"
            value={props.total}
            min={60}
            max={600}
            step={20}
            onChange={props.onTotal}
          />
        </>
      )}

      <div
        style={{
          color: "var(--nx-fg-tertiary)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wide)",
          textTransform: "uppercase",
          marginBottom: "var(--nx-space-1)",
        }}
      >
        names
      </div>
      <TabStrip
        value={props.labelMode}
        onChange={props.onLabelMode}
        label="Label mode"
        tabs={[
          { value: "auto", label: "Auto" },
          { value: "key", label: "Key" },
          { value: "all", label: "All" },
          { value: "off", label: "Off" },
        ]}
      />

      <ConsoleActions {...props} />
    </Panel>
  );
}

function ConsoleActions({
  isRunning,
  isListView,
  canGoBack,
  onFit,
  onReheat,
  onToggleRunning,
  onReseed,
  onToggleListView,
  onBack,
}: GraphConsoleProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: "var(--nx-space-2)",
        marginTop: "var(--nx-space-3)",
      }}
    >
      <Button style={{ minWidth: 0 }} onClick={onFit}>
        Fit
      </Button>
      <Button style={{ minWidth: 0 }} onClick={onReheat}>
        Reheat
      </Button>
      <Button style={{ minWidth: 0 }} onClick={onToggleRunning}>
        {isRunning ? "Halt" : "Run"}
      </Button>
      <Button style={{ minWidth: 0 }} onClick={onReseed}>
        Reseed
      </Button>
      {/* An action that names where it goes, not a toggle: a pressed
        button whose name flips reads as "View as graph, pressed" while
        the list is showing. */}
      <Button style={{ minWidth: 0, gridColumn: "1 / -1" }} onClick={onToggleListView}>
        {isListView ? "View as graph" : "View as list"}
      </Button>
      {/* Back is the same step Backspace takes inside the graph: the
        previous node and the selection that went with it. aria-disabled,
        not disabled: pressing Back down to the start would otherwise
        disable the very button holding focus and drop it on <body>. */}
      <Button
        style={{ minWidth: 0, gridColumn: "1 / -1" }}
        aria-disabled={!canGoBack || undefined}
        onClick={() => {
          if (canGoBack) onBack();
        }}
      >
        Back
      </Button>
    </div>
  );
}
