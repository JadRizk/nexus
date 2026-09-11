import { forwardRef, useRef } from "react";
import type { CSSProperties, ForwardedRef, ReactNode } from "react";

export interface Tab<V extends string = string> {
  value: V;
  label: ReactNode;
}

export interface TabStripProps<V extends string = string> {
  tabs: ReadonlyArray<Tab<V>>;
  value: V;
  onChange: (v: V) => void;
  label?: string;
  style?: CSSProperties;
}

// forwardRef's own type isn't generic, so a component generic over its value
// type has to be written as a plain function first and cast back to a
// generic call signature afterward — see CommandPalette.tsx, which shares
// this exact shape.
function TabStripInner<V extends string = string>(
  { tabs, value, onChange, label = "View", style }: TabStripProps<V>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const idx = tabs.findIndex((t) => t.value === value);

  const move = (delta: number) => {
    const n = (idx + delta + tabs.length) % tabs.length;
    const next = tabs[n];
    if (!next) return;
    onChange(next.value);
    refs.current[n]?.focus();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className="nx-tabstrip"
      style={style}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
        else if (e.key === "Home") { e.preventDefault(); const t = tabs[0]; if (t) { onChange(t.value); refs.current[0]?.focus(); } }
        else if (e.key === "End") { e.preventDefault(); const n = tabs.length - 1; const t = tabs[n]; if (t) { onChange(t.value); refs.current[n]?.focus(); } }
      }}
    >
      {tabs.map((t, k) => (
        <button
          key={t.value}
          ref={(el) => { refs.current[k] = el; }}
          role="tab"
          type="button"
          aria-selected={t.value === value}
          tabIndex={t.value === value ? 0 : -1}
          className="nx-tab"
          data-active={t.value === value ? "1" : "0"}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** WAI-ARIA tabs pattern: roving tabindex, arrow/Home/End navigation. */
export const TabStrip = forwardRef(TabStripInner) as (<V extends string = string>(
  props: TabStripProps<V> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof TabStripInner>) & { displayName?: string };

(TabStrip as { displayName?: string }).displayName = "TabStrip";
