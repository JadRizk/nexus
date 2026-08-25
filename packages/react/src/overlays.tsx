import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Glyph, HazardRule, Panel, SectionHeading } from "./primitives.js";
import { rankItems, useFocusTrap } from "./types.js";
import type { LegendGroup, PaletteItem } from "./types.js";

// `inert` is a standard DOM boolean attribute, but React 18's runtime doesn't
// recognize the name as boolean-valued (that's React 19) and warns if given a
// JS boolean — so it's typed and passed as a plain string, the same "" idiom
// HTML itself uses for boolean attributes, which React 18 renders as-is.
declare module "react" {
  interface HTMLAttributes<T> {
    inert?: string;
  }
}

/* ============================================================================
   @nexus/react — overlays
   Drawer and CommandPalette are where design systems fail accessibility
   audits, so they share one focus-trap implementation and carry full ARIA.
   ========================================================================== */

/* ----------------------------------------------------------------- Drawer */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children?: ReactNode;
}

/**
 * Right-hand detail panel. It slides rather than mounting and unmounting, so
 * the motion reads as one object moving instead of two objects swapping.
 *
 * Focus is trapped while open and restored to whatever opened it on close.
 * When closed the subtree is `aria-hidden` and inert, so a screen reader never
 * wanders into offscreen content.
 */
export function Drawer({
  open, onClose, title, subtitle, accent = "var(--nx-fg-info)",
  icon, footer, width = 296, children,
}: DrawerProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const titleId = useId();

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : ""}
      tabIndex={-1}
      style={{
        position: "fixed",
        top: "var(--nx-space-5)", right: "var(--nx-space-5)", bottom: "var(--nx-space-5)",
        width, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : `translateX(${width + 28}px)`,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "transform var(--nx-dur-panel) var(--nx-ease), opacity var(--nx-dur-fade) linear",
      }}
    >
      <Panel padded={false} raised style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <header style={{
          padding: "var(--nx-space-5)",
          borderBottom: "var(--nx-hairline) solid var(--nx-border-default)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--nx-space-3)" }}>
            {icon && <div style={{ paddingTop: 2 }}>{icon}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id={titleId} style={{
                margin: 0, color: accent, fontFamily: "var(--nx-font-mono)",
                fontSize: "var(--nx-text-md)", fontWeight: 700, lineHeight: 1.25,
                letterSpacing: "var(--nx-track-normal)", textTransform: "uppercase",
                wordBreak: "break-all",
              }}>{title}</h2>
              {subtitle != null && (
                <div style={{
                  color: "var(--nx-fg-tertiary)", marginTop: "var(--nx-space-1)",
                  letterSpacing: "var(--nx-track-wide)",
                }}>{subtitle}</div>
              )}
            </div>
            <button type="button" className="nx-btn" onClick={onClose}
              aria-label="Close details" style={{ padding: "3px 6px", lineHeight: 1 }}>✕</button>
          </div>
        </header>

        <HazardRule style={{ flexShrink: 0 }} />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--nx-space-5)" }}>
          {children}
        </div>

        {footer && (
          <div style={{
            display: "flex", gap: "var(--nx-space-2)",
            padding: "var(--nx-space-4) var(--nx-space-5)",
            borderTop: "var(--nx-hairline) solid var(--nx-border-default)", flexShrink: 0,
          }}>{footer}</div>
        )}
      </Panel>
    </div>
  );
}

/* --------------------------------------------------------------- MeterRow */
export interface MeterRowProps {
  label: string;
  value: number;
  total: number;
  colour: string;
  labelWidth?: number;
}

/** Proportional bar with a real `role="meter"`, not a decorative div. */
export function MeterRow({ label, value, total, colour, labelWidth = 66 }: MeterRowProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--nx-space-3)", marginBottom: "var(--nx-space-1)" }}>
      <span style={{ color: colour, letterSpacing: "var(--nx-track-wide)", width: labelWidth, flexShrink: 0 }}>
        {label}
      </span>
      <div
        role="meter"
        aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}
        aria-label={`${label}: ${value} of ${total}`}
        style={{ flex: 1, height: 4, background: "rgba(255,255,255,.045)" }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: colour, boxShadow: `0 0 6px ${colour}` }} />
      </div>
      <span style={{ color: "var(--nx-fg-default)", width: 18, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- CommandPalette */
export interface CommandPaletteProps<T extends PaletteItem = PaletteItem> {
  open: boolean;
  onClose: () => void;
  items: readonly T[];
  onSelect: (item: T) => void;
  placeholder?: string;
  emptyLabel?: string;
  hint?: ReadonlyArray<readonly [string, string]>;
  /** Extra content on the right of a result row, e.g. a degree count. */
  renderMeta?: (item: T) => ReactNode;
  width?: number;
}

/**
 * Ranked search over a flat list, generic over the item type.
 *
 * Implements the ARIA combobox pattern: the input never loses focus and owns
 * `aria-activedescendant`, the results are a real `listbox`, and a live region
 * announces the count so the update is not silent.
 */
export function CommandPalette<T extends PaletteItem = PaletteItem>({
  open, onClose, items, onSelect,
  placeholder = "SEARCH", emptyLabel = "NO MATCH",
  hint = [["↑↓", "MOVE"], ["↵", "SELECT"], ["ESC", "CLOSE"]] as const,
  renderMeta, width = 520,
}: CommandPaletteProps<T>) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const listId = useId();

  useEffect(() => { if (open) { setQuery(""); setCursor(0); } }, [open]);
  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);
  useEffect(() => { setCursor(0); }, [query]);

  const hits = useMemo(() => rankItems(items, query), [items, query]);

  // keep the active option in view without moving focus off the input
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const active = hits[cursor];

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 40, background: "var(--nx-scrim)",
        backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", paddingTop: "13vh",
      }}
    >
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={placeholder} tabIndex={-1}
        style={{ width, maxWidth: "92vw", height: "fit-content", maxHeight: "62vh" }}>
        <Panel padded={false} raised style={{ display: "flex", flexDirection: "column", maxHeight: "62vh" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--nx-space-4)",
            padding: "var(--nx-space-5)", borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
          }}>
            <span aria-hidden="true" style={{
              color: "var(--nx-fg-accent)", fontWeight: 700, fontSize: "var(--nx-text-md)",
            }}>&gt;</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active ? `${listId}-${cursor}` : undefined}
              aria-label={placeholder}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
                else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
                else if (e.key === "End") { e.preventDefault(); setCursor(hits.length - 1); }
                else if (e.key === "Enter" && active) { e.preventDefault(); onSelect(active); }
              }}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--nx-fg-default)", fontFamily: "var(--nx-font-mono)",
                fontSize: "var(--nx-text-md)", fontWeight: 500,
                letterSpacing: "var(--nx-track-wide)", textTransform: "uppercase",
              }}
            />
            <span aria-hidden="true" style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>
              {hits.length}
            </span>
          </div>

          <HazardRule style={{ flexShrink: 0 }} />

          <div className="nx-sr" role="status" aria-live="polite">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </div>

          <ul ref={listRef} id={listId} role="listbox" aria-label="Results"
            style={{ listStyle: "none", margin: 0, padding: "var(--nx-space-2) 0", overflowY: "auto", minHeight: 0 }}>
            {hits.length === 0 && (
              <li style={{
                padding: "var(--nx-space-6) var(--nx-space-5)",
                color: "var(--nx-fg-tertiary)", letterSpacing: "var(--nx-track-wide)",
              }}>{emptyLabel}</li>
            )}
            {hits.map((it, i) => (
              <li
                key={it.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => { e.preventDefault(); onSelect(it); }}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--nx-space-4)",
                  padding: "var(--nx-space-2) var(--nx-space-5)", cursor: "pointer",
                  background: i === cursor ? "var(--nx-bg-hover)" : "transparent",
                  borderLeft: `2px solid ${i === cursor ? "var(--nx-fg-accent)" : "transparent"}`,
                }}
              >
                {it.shape && <Glyph shape={it.shape} colour={it.colour} size={10} />}
                <span style={{
                  flex: 1, color: i === cursor ? "var(--nx-fg-default)" : "var(--nx-fg-subtle)",
                  letterSpacing: "var(--nx-track-normal)", textTransform: "uppercase",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{it.label}</span>
                {it.code && (
                  <span style={{
                    color: it.colour, fontSize: "var(--nx-text-2xs)",
                    letterSpacing: "var(--nx-track-wide)", opacity: 0.8,
                  }}>{it.code}</span>
                )}
                {renderMeta?.(it)}
              </li>
            ))}
          </ul>

          <div aria-hidden="true" style={{
            display: "flex", gap: "var(--nx-space-6)",
            padding: "var(--nx-space-3) var(--nx-space-5)",
            borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
            color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
            letterSpacing: "var(--nx-track-wider)", flexShrink: 0,
          }}>
            {hint.map(([k, v]) => <span key={k}>{k} {v}</span>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Legend */
export interface LegendProps {
  groups: readonly LegendGroup[];
  style?: CSSProperties;
}

/** Grouped filter legend. Each group is a fieldset so the heading is bound. */
export function Legend({ groups, style }: LegendProps) {
  return (
    <div style={style}>
      {groups.map((g, gi) => (
        <fieldset key={g.title} style={{ border: 0, margin: 0, padding: 0, marginTop: gi ? "var(--nx-space-4)" : 0 }}>
          <legend style={{ padding: 0 }}>
            <SectionHeading>/// {g.title}</SectionHeading>
          </legend>
          {g.rows}
        </fieldset>
      ))}
    </div>
  );
}
