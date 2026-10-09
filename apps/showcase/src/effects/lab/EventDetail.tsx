import { Button, SectionHeading } from "@nexus-cyberdeck/react";
import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import type { EventDef } from "../glitch/data/events/types.js";
import { integrationSnippet } from "../glitch/lab/format.js";
import { trackColor } from "../glitch/lab/trackPath.js";
import { TrackViz } from "./TrackViz.js";

interface EventDetailProps {
  readonly event: EventDef;
  /** The event's run, while it is live. */
  readonly running: RunningEvent | undefined;
  readonly onFire: () => void;
}

/** The inspector's event tab: its cause, its envelopes, its tracks and how to fire it. */
export function EventDetail({ event, running, onFire }: EventDetailProps) {
  return (
    <div style={{ padding: "var(--nx-space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            color: "var(--nx-fg-accent)",
            fontWeight: 700,
            letterSpacing: "var(--nx-track-wide)",
            fontSize: "var(--nx-text-sm)",
          }}
        >
          {event.label}
        </span>
        <Button onMouseDown={onFire}>Fire</Button>
      </div>
      <div
        style={{
          color: "var(--nx-fg-tertiary)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
          margin: "var(--nx-space-3) 0 var(--nx-space-4)",
        }}
      >
        {(event.dur * 1000) | 0}MS · CHAOS {event.chaos.toFixed(2)} · {event.tracks.length} TRACKS
      </div>
      <p
        style={{
          margin: "0 0 var(--nx-space-5)",
          color: "var(--nx-fg-subtle)",
          lineHeight: 1.75,
          fontSize: "var(--nx-text-sm)",
        }}
      >
        {event.cause}
      </p>

      <SectionHeading>/// ENVELOPES</SectionHeading>
      <TrackViz event={event} running={running} />

      <div style={{ marginTop: "var(--nx-space-4)" }}>
        {event.tracks.map((track, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--nx-fg-subtle)",
              fontSize: "var(--nx-text-2xs)",
              padding: "1px 0",
            }}
          >
            <span style={{ color: trackColor(index) }}>
              {track.fx}.{track.param}
            </span>
            <span style={{ color: "var(--nx-fg-disabled)" }}>
              {track.mode}
              {track.keys.some((key) => key[2] === "step") ? " · step" : ""}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--nx-space-5)",
          paddingTop: "var(--nx-space-4)",
          borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
        }}
      >
        <SectionHeading>/// INTEGRATION</SectionHeading>
        <pre
          style={{
            margin: 0,
            padding: "var(--nx-space-4) var(--nx-space-5)",
            background: "rgba(0,0,0,.35)",
            border: "var(--nx-hairline) solid var(--nx-border-default)",
            color: "var(--nx-fg-muted)",
            fontFamily: "var(--nx-font-mono)",
            fontSize: "var(--nx-text-2xs)",
            lineHeight: 1.7,
            overflowX: "auto",
          }}
        >
          <code>{integrationSnippet(event.id)}</code>
        </pre>
      </div>
    </div>
  );
}
