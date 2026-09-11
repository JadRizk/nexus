import { forwardRef } from "react";
import type { CSSProperties } from "react";
import { resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export interface MeterRowProps extends ToneProps {
  label: string;
  value: number;
  total: number;
  labelWidth?: number;
}

/** Proportional bar with a real `role="meter"`, not a decorative div. */
export const MeterRow = forwardRef<HTMLDivElement, MeterRowProps>(
  function MeterRow({ label, value, total, tone, colour, labelWidth }, ref) {
    const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
    return (
      <div
        ref={ref}
        className="nx-meter"
        // Colour and fill are computed; the label column is per-instance so a
        // caller can align several meters against a longer set of labels.
        style={{
          "--nx-meter-fg": resolveColour({ tone, colour }, "var(--nx-fg-info)"),
          ...(labelWidth != null ? { "--nx-meter-label-width": `${labelWidth}px` } : null),
        } as CSSProperties}
      >
        <span className="nx-meter__label">{label}</span>
        <div
          className="nx-meter__track"
          role="meter"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${label}: ${value} of ${total}`}
        >
          <div className="nx-meter__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="nx-meter__value">{value}</span>
      </div>
    );
  },
);

MeterRow.displayName = "MeterRow";
