import { Button, Panel, SectionHeading, Slider } from "@nexus-cyberdeck/react";
import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import { CHAINS } from "../glitch/data/chains.js";
import type { ChainDef } from "../glitch/data/chains.js";
import { EVENTS } from "../glitch/data/events/index.js";
import type { EventDef } from "../glitch/data/events/types.js";

const TRIGGER_GRID = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)" };

interface EventsPanelProps {
  readonly live: readonly RunningEvent[];
  /** Fires event `id` and opens it in the inspector. */
  readonly onFireEvent: (id: string) => void;
  readonly onFireChain: (chain: ChainDef) => void;
  readonly onFireRandom: () => void;
  readonly isAutoFire: boolean;
  readonly onToggleAutoFire: () => void;
  /** 0–1: how often auto-fire fires. */
  readonly rate: number;
  readonly onRate: (rate: number) => void;
}

/** The event and chain triggers, auto-fire, and a readout of the bus. */
export function EventsPanel({
  live,
  onFireEvent,
  onFireChain,
  onFireRandom,
  isAutoFire,
  onToggleAutoFire,
  rate,
  onRate,
}: EventsPanelProps) {
  return (
    <Panel style={{ flexShrink: 0 }}>
      <SectionHeading>/// EVENTS — TRANSIENT</SectionHeading>
      <div style={TRIGGER_GRID}>
        {EVENTS.map((event) => (
          <EventTrigger
            key={event.id}
            event={event}
            running={live.find((running) => running.id === event.id)}
            onFire={() => onFireEvent(event.id)}
          />
        ))}
      </div>

      <SectionHeading style={{ margin: "var(--nx-space-5) 0 var(--nx-space-2)" }}>
        /// CHAINS — CASCADING
      </SectionHeading>
      <div style={TRIGGER_GRID}>
        {CHAINS.map((chain) => (
          <button
            key={chain.id}
            type="button"
            className="nxgl-trigger"
            onMouseDown={() => onFireChain(chain)}
          >
            <span style={{ color: "var(--nx-fg-warning)" }}>{chain.label}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--nx-space-2)",
          marginTop: "var(--nx-space-4)",
          alignItems: "center",
        }}
      >
        <Button active={isAutoFire} style={{ flex: 1 }} onClick={onToggleAutoFire}>
          Auto
        </Button>
        <Button style={{ flex: 1 }} onMouseDown={() => onFireRandom()}>
          Random
        </Button>
      </div>
      {isAutoFire && (
        <div style={{ marginTop: "var(--nx-space-3)" }}>
          <Slider
            label="frequency"
            value={rate}
            min={0}
            max={1}
            step={0.01}
            onChange={onRate}
            format={(value) => value.toFixed(2)}
          />
        </div>
      )}

      <BusReadout live={live} />
    </Panel>
  );
}

interface EventTriggerProps {
  readonly event: EventDef;
  /** The event's run, while it is live; it drains the trigger's fill. */
  readonly running: RunningEvent | undefined;
  readonly onFire: () => void;
}

/** One event's trigger card, with its key and, while live, its progress. */
function EventTrigger({ event, running, onFire }: EventTriggerProps) {
  return (
    <button type="button" className="nxgl-trigger" onMouseDown={onFire}>
      {running && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--nx-bg-active)",
            transform: `scaleX(${1 - running.u})`,
            transformOrigin: "left",
            pointerEvents: "none",
          }}
        />
      )}
      <span
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--nx-space-2)",
        }}
      >
        <span>{event.label}</span>
        <span style={{ color: "var(--nx-fg-disabled)" }}>{event.key}</span>
      </span>
    </button>
  );
}

/** The running events and how far through each is, or the idle hint. */
function BusReadout({ live }: { readonly live: readonly RunningEvent[] }) {
  return (
    <div
      style={{
        marginTop: "var(--nx-space-4)",
        paddingTop: "var(--nx-space-3)",
        borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
        color: "var(--nx-fg-tertiary)",
        fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-normal)",
        minHeight: 26,
      }}
    >
      {live.length === 0 ? (
        <span style={{ color: "var(--nx-fg-disabled)" }}>BUS IDLE · KEYS 1–8 · SPACE RANDOM</span>
      ) : (
        live.map((running) => (
          <div
            key={running.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--nx-fg-accent)",
            }}
          >
            <span>▸ {running.label}</span>
            <span style={{ color: "var(--nx-fg-tertiary)" }}>{Math.round(running.u * 100)}%</span>
          </div>
        ))
      )}
    </div>
  );
}
