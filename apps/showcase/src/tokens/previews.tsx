import { useState } from "react";
import type { CSSProperties } from "react";
import { BlinkCursor, Button } from "@nexus-cyberdeck/react";
import type { Token } from "./model.js";

/* ============================================================================
   showcase — token previews
   Each preview is drawn with the custom property itself, never with the
   value the model resolved, so what it shows is what the cascade actually
   produces under the current theme.
   ========================================================================== */

const v = (t: Token) => `var(${t.name})`;

/** A checkerboard behind a swatch, so a translucent colour reads as one. */
const checker: CSSProperties = {
  backgroundColor: "var(--nx-bg-canvas)",
  backgroundImage:
    "linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%)," +
    "linear-gradient(45deg, #222 25%, transparent 25%, transparent 75%, #222 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 4px 4px",
};

const box: CSSProperties = { width: 48, height: 26 };

export const None = () => (
  <span aria-hidden="true" style={{ color: "var(--nx-fg-disabled)" }}>
    —
  </span>
);

export const Swatch = (t: Token) => (
  <div style={{ ...box, ...checker, border: "var(--nx-hairline) solid var(--nx-border-strong)" }}>
    <div style={{ width: "100%", height: "100%", background: v(t) }} />
  </div>
);

export const TextSample = (t: Token) => (
  <span style={{ color: v(t), fontSize: "var(--nx-text-md)" }}>Aa</span>
);

export const BorderSample = (t: Token) => (
  <div style={{ ...box, border: `var(--nx-hairline) solid ${v(t)}` }} />
);

export const FocusSample = () => (
  <div
    style={{
      ...box,
      width: 36,
      height: 18,
      marginTop: 4,
      outline: "var(--nx-focus-width) solid var(--nx-focus-ring)",
      outlineOffset: "var(--nx-focus-offset)",
      background: "var(--nx-bg-raised)",
    }}
  />
);

export const FontSample = (t: Token) => (
  <span style={{ fontFamily: v(t), fontSize: "var(--nx-text-lg)", color: "var(--nx-fg-default)" }}>
    Aa0x
  </span>
);

export const SizeSample = (t: Token) => (
  <span style={{ fontSize: v(t), color: "var(--nx-fg-default)", lineHeight: 1 }}>Aa</span>
);

export const TrackSample = (t: Token) => (
  <span style={{ letterSpacing: v(t), textTransform: "uppercase", color: "var(--nx-fg-default)" }}>
    sig
  </span>
);

export const WeightSample = (t: Token) => (
  <span style={{ fontWeight: v(t), color: "var(--nx-fg-default)" }}>Sig</span>
);

export const LeadingSample = (t: Token) => (
  <div
    style={{
      width: 52,
      lineHeight: v(t),
      fontSize: "var(--nx-text-2xs)",
      color: "var(--nx-fg-default)",
      borderTop: "var(--nx-hairline) dashed var(--nx-border-strong)",
      borderBottom: "var(--nx-hairline) dashed var(--nx-border-strong)",
    }}
  >
    two
    <br />
    lines
  </div>
);

export const SpaceSample = (t: Token) => (
  <div
    style={{
      width: v(t),
      height: 10,
      background: "var(--nx-fg-accent)",
      outline: "var(--nx-hairline) solid var(--nx-border-strong)",
    }}
  />
);

export function ShapeSample(t: Token) {
  const leaf = t.name.replace("--nx-", "");
  if (leaf === "hairline") {
    return <div style={{ width: 48, height: v(t), background: "var(--nx-fg-default)" }} />;
  }
  if (leaf === "radius") {
    return (
      <div
        style={{
          ...box,
          borderRadius: v(t),
          border: "var(--nx-hairline) solid var(--nx-fg-default)",
        }}
      />
    );
  }
  // tick: the arm length of a panel's corner frame
  return (
    <div style={{ position: "relative", width: 28, height: 28 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: v(t),
          height: 1,
          background: "var(--nx-fg-accent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: v(t),
          background: "var(--nx-fg-accent)",
        }}
      />
    </div>
  );
}

/** Moves a marker across a track over the token's duration, on demand. */
export function DurationSample(t: Token) {
  return <DurationDemo name={t.name} />;
}

function DurationDemo({ name }: { name: string }) {
  const [end, setEnd] = useState(false);
  return (
    <div>
      <div
        style={{
          position: "relative",
          width: 52,
          height: 6,
          background: "var(--nx-bg-track)",
          marginBottom: "var(--nx-space-2)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 6,
            height: 6,
            background: "var(--nx-fg-accent)",
            transform: `translateX(${end ? 46 : 0}px)`,
            transition: `transform var(${name}) var(--nx-ease)`,
          }}
        />
      </div>
      <Button
        aria-label={`Play ${name}`}
        onClick={() => setEnd((e) => !e)}
        style={{ "--nx-btn-padding": "0 var(--nx-space-2)" } as CSSProperties}
      >
        Play
      </Button>
    </div>
  );
}

/** Plots a cubic-bezier() value. */
export function EaseSample(t: Token) {
  const nums = (t.values["hud-aa"].match(/-?[\d.]+/g) ?? []).map(Number);
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = nums;
  const s = 40;
  const p = (x: number, y: number) => `${2 + x * s} ${2 + (1 - y) * s}`;
  return (
    <svg width={s + 4} height={s + 4} aria-hidden="true">
      <rect x={2} y={2} width={s} height={s} fill="none" stroke="var(--nx-border-default)" />
      <path
        d={`M ${p(0, 0)} C ${p(x1, y1)}, ${p(x2, y2)}, ${p(1, 1)}`}
        fill="none"
        stroke="var(--nx-fg-accent)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

export const BlinkSample = () => (
  <span style={{ color: "var(--nx-fg-default)" }}>
    <BlinkCursor />
  </span>
);

export const GlowSample = (t: Token) => (
  <div
    style={{
      ...box,
      background: "var(--nx-bg-surface)",
      border: "var(--nx-hairline) solid var(--nx-border-default)",
      boxShadow: v(t),
    }}
  />
);

export const SplitSample = (t: Token) => (
  <span
    style={{
      fontFamily: "var(--nx-font-stencil)",
      fontSize: "var(--nx-text-xl)",
      color: "var(--nx-fg-default)",
      textShadow: `3px 0 ${v(t)}`,
    }}
  >
    NX
  </span>
);
