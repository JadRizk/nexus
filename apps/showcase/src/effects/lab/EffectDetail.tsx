import { Button, Slider } from "@nexus-cyberdeck/react";
import type { EffectDef } from "../glitch/data/types.js";
import { formatKnob } from "../glitch/lab/format.js";

interface EffectDetailProps {
  readonly effect: EffectDef;
  /** The effect's resting knobs: its params, plus `on` and `amt`. */
  readonly knobs: Readonly<Record<string, number>>;
  readonly onKnob: (knob: string, value: number) => void;
}

/** The inspector's effect tab: its switch, its stage, its note and a slider per knob. */
export function EffectDetail({ effect, knobs, onKnob }: EffectDetailProps) {
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
          {effect.label}
        </span>
        <Button active={!!knobs.on} onClick={() => onKnob("on", knobs.on ? 0 : 1)}>
          {knobs.on ? "ON" : "OFF"}
        </Button>
      </div>
      <div
        style={{
          color: "var(--nx-fg-tertiary)",
          fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wider)",
          margin: "var(--nx-space-3) 0 var(--nx-space-4)",
        }}
      >
        {effect.group} STAGE
      </div>
      <p
        style={{
          margin: "0 0 var(--nx-space-5)",
          color: "var(--nx-fg-subtle)",
          lineHeight: 1.75,
          fontSize: "var(--nx-text-sm)",
        }}
      >
        {effect.note}
      </p>
      <div
        style={{
          height: "var(--nx-hairline)",
          background: "var(--nx-border-default)",
          marginBottom: "var(--nx-space-4)",
        }}
      />
      <Slider
        label="mix"
        value={knobs.amt}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) => onKnob("amt", value)}
        format={formatKnob}
      />
      {effect.params.map(([knob, min, max]) => (
        <Slider
          key={knob}
          label={knob}
          value={knobs[knob]}
          min={min}
          max={max}
          step={(max - min) / 200}
          onChange={(value) => onKnob(knob, value)}
          format={formatKnob}
        />
      ))}
      <div
        style={{
          marginTop: "var(--nx-space-3)",
          color: "var(--nx-fg-disabled)",
          fontSize: "var(--nx-text-2xs)",
          lineHeight: 1.6,
        }}
      >
        Events override these while running, then hand control back.
      </div>
    </div>
  );
}
