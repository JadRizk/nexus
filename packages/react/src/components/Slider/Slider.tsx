import { useId } from "react";
import type { CSSProperties } from "react";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Formats the displayed value and the `aria-valuetext` announcement. */
  format?: (v: number) => string;
  style?: CSSProperties;
}

/**
 * A restyled native `<input type="range">`. Keeping the native element means
 * keyboard support, touch targets and value announcement come free — a custom
 * div slider would have to rebuild all three and usually gets one wrong.
 */
export function Slider({ label, value, min, max, step = 1, onChange, format, style }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(value);
  return (
    <div style={{ marginBottom: "var(--nx-space-4)", ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--nx-space-1)" }}>
        <label htmlFor={id} style={{
          color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
          letterSpacing: "var(--nx-track-wide)", textTransform: "uppercase",
        }}>{label}</label>
        <span aria-hidden="true" style={{
          color: "var(--nx-fg-default)", fontSize: "var(--nx-text-2xs)", fontVariantNumeric: "tabular-nums",
        }}>{shown}</span>
      </div>
      <input
        id={id} className="nx-slider" type="range"
        min={min} max={max} step={step} value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
