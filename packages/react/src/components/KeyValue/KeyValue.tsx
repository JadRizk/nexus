import type { CSSProperties, ReactNode } from "react";

export interface KeyValueProps {
  label: ReactNode;
  value: ReactNode;
  style?: CSSProperties;
}

/**
 * A label/value row that degrades by truncating rather than clipping.
 *
 * `min-width: 0` on the row is what lets it shrink inside a grid or flex
 * column narrower than "label + value" at full width — a bare `1fr` track
 * sizes to content unless told otherwise — and the ellipsis on each span is
 * what makes the shrunken state readable instead of cut mid-character.
 */
export function KeyValue({ label, value, style }: KeyValueProps) {
  return (
    <div className="nx-kv" style={style}>
      <span className="nx-kv__label">{label}</span>
      <span className="nx-kv__value">{value}</span>
    </div>
  );
}
