import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface ToggleRowProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  style?: CSSProperties;
}

/**
 * A filter row backed by a real checkbox. The visually-hidden input keeps it
 * reachable by keyboard and announced by screen readers; `:focus-within` on
 * the label draws the ring.
 */
export const ToggleRow = forwardRef<HTMLLabelElement, ToggleRowProps>(
  function ToggleRow({ checked, onChange, icon, label, meta, style }, ref) {
    return (
      <label ref={ref} className="nx-row" data-checked={checked ? "1" : "0"} style={style}>
        <input type="checkbox" className="nx-sr" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {icon}
        <span className="nx-row__label">{label}</span>
        {meta != null && <span className="nx-row__meta">{meta}</span>}
      </label>
    );
  },
);

ToggleRow.displayName = "ToggleRow";
