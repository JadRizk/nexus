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
export function ToggleRow({ checked, onChange, icon, label, meta, style }: ToggleRowProps) {
  return (
    <label className="nx-row" style={style}>
      <input type="checkbox" className="nx-sr" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {icon}
      <span style={{
        flex: 1,
        color: checked ? "var(--nx-fg-default)" : "var(--nx-fg-disabled)",
        letterSpacing: "var(--nx-track-normal)",
      }}>{label}</span>
      {meta != null && (
        <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{meta}</span>
      )}
    </label>
  );
}
