import type { RunningEvent } from "../glitch/core/resolveEvents.js";
import type { EventDef } from "../glitch/data/events/types.js";
import { trackColor, trackPath } from "../glitch/lab/trackPath.js";

const VIEW = { width: 254, height: 72, samples: 90 };

interface TrackVizProps {
  readonly event: EventDef;
  /** The event's run, while it is live; draws the playhead. */
  readonly running: RunningEvent | undefined;
}

/** Draws each track's keyframe curve, with a playhead when the event is live. */
export function TrackViz({ event, running }: TrackVizProps) {
  const { width, height } = VIEW;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        background: "rgba(0,0,0,.35)",
      }}
    >
      {[0.25, 0.5, 0.75].map((quarter) => (
        <line
          key={quarter}
          x1={quarter * width}
          y1={0}
          x2={quarter * width}
          y2={height}
          stroke="var(--nx-border-default)"
          strokeWidth="1"
        />
      ))}
      {event.tracks.map((track, index) => (
        <path
          key={index}
          d={trackPath(track.keys, VIEW)}
          fill="none"
          stroke={trackColor(index)}
          strokeWidth="1.2"
          opacity="0.85"
        />
      ))}
      {running && (
        <>
          <line
            x1={running.u * width}
            y1={0}
            x2={running.u * width}
            y2={height}
            stroke="var(--nx-fg-default)"
            strokeWidth="1.4"
          />
          <rect
            x={0}
            y={0}
            width={running.u * width}
            height={height}
            fill="var(--nx-fg-accent)"
            opacity="0.07"
          />
        </>
      )}
    </svg>
  );
}
