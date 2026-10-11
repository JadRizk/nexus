import { Button, HazardRule, Panel, Wordmark } from "@nexus-cyberdeck/react";
import { PRESETS } from "../glitch/data/presets.js";
import { fpsTone } from "../glitch/lab/format.js";

const SOURCES = ["GRAPH", "BARS", "HUD"];

interface SourcePanelProps {
  readonly fps: number;
  /** The source picture's index in GRAPH, BARS, HUD. */
  readonly source: number;
  readonly onSource: (source: number) => void;
  readonly onPreset: (preset: string) => void;
}

/** The lab's title and frame rate, the source picker and the resting-state presets. */
export function SourcePanel({ fps, source, onSource, onPreset }: SourcePanelProps) {
  return (
    <Panel style={{ flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "var(--nx-space-4)",
        }}
      >
        <Wordmark size="var(--nx-text-lg)">GLITCH LAB</Wordmark>
        <span
          style={{
            fontFamily: "var(--nx-font-stencil)",
            fontSize: "var(--nx-text-xl)",
            lineHeight: 0.8,
            color: fpsTone(fps),
          }}
        >
          {fps}
        </span>
      </div>
      <HazardRule style={{ marginBottom: "var(--nx-space-4)" }} />
      <div style={{ display: "flex", gap: "var(--nx-space-2)" }}>
        {SOURCES.map((name, index) => (
          <Button
            key={name}
            active={source === index}
            style={{ flex: 1 }}
            onClick={() => onSource(index)}
          >
            {name}
          </Button>
        ))}
      </div>
      <div
        style={{
          marginTop: "var(--nx-space-4)",
          color: "var(--nx-fg-tertiary)",
          letterSpacing: "var(--nx-track-wide)",
          fontSize: "var(--nx-text-2xs)",
        }}
      >
        RESTING STATE
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--nx-space-2)",
          marginTop: "var(--nx-space-2)",
        }}
      >
        {Object.keys(PRESETS).map((preset) => (
          <Button
            key={preset}
            style={{ fontSize: "var(--nx-text-2xs)" }}
            onClick={() => onPreset(preset)}
          >
            {preset}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
