import {
  createContext, useContext, useEffect, useId, useRef, useState,
} from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { NexusTheme, Tone } from "@nexus/tokens";
import { tone as toneVar } from "@nexus/tokens";
import type { Corner, GlyphShape } from "./types.js";

/* ============================================================================
   @nexus/react — primitives
   Every component is styled entirely from CSS custom properties, so none of
   them know which theme is active.
   ========================================================================== */

/* --------------------------------------------------------------- Provider */
export interface NexusContextValue {
  theme: NexusTheme;
  crt: boolean;
  setTheme: (t: NexusTheme) => void;
  setCrt: (c: boolean) => void;
}

const Ctx = createContext<NexusContextValue>({
  theme: "hud-aa", crt: true, setTheme: () => {}, setCrt: () => {},
});

export const useNexus = (): NexusContextValue => useContext(Ctx);

export interface NexusProviderProps extends HTMLAttributes<HTMLDivElement> {
  theme?: NexusTheme;
  crt?: boolean;
  children: ReactNode;
}

/** Root. Owns theme + CRT state and projects them as data attributes. */
export function NexusProvider({
  theme = "hud-aa", crt = true, children, className = "", ...rest
}: NexusProviderProps) {
  const [t, setTheme] = useState<NexusTheme>(theme);
  const [c, setCrt] = useState<boolean>(crt);
  useEffect(() => setTheme(theme), [theme]);
  useEffect(() => setCrt(crt), [crt]);

  return (
    <Ctx.Provider value={{ theme: t, crt: c, setTheme, setCrt }}>
      <div className={`nx-root ${className}`} data-nx-theme={t} data-nx-crt={c ? "on" : "off"} {...rest}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ Panel */
export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Which corner ticks render. Two arms read as a bracket; four as a box. */
  corners?: Corner[] | "none";
  padded?: boolean;
  raised?: boolean;
}

export function Panel({
  corners = ["tl", "br"], padded = true, raised = false, style, children, ...rest
}: PanelProps) {
  const attr = corners === "none" ? "none" : corners.join(" ");
  return (
    <div
      className="nx-panel"
      data-nx-corners={attr}
      style={{
        position: "relative",
        background: "var(--nx-bg-surface)",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        borderRadius: "var(--nx-radius)",
        boxShadow: raised ? "var(--nx-glow-raised), var(--nx-glow-inset)" : "var(--nx-glow-inset)",
        padding: padded ? "var(--nx-space-5)" : 0,
        color: "var(--nx-fg-subtle)",
        fontFamily: "var(--nx-font-mono)",
        fontSize: "var(--nx-text-xs)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ HazardRule */
export interface HazardRuleProps {
  height?: number;
  opacity?: number;
  style?: CSSProperties;
}

/** Diagonal warning stripe. Decorative — hidden from assistive tech. */
export function HazardRule({ height = 5, opacity = 0.32, style }: HazardRuleProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        height, opacity,
        background: "repeating-linear-gradient(-45deg, var(--nx-fg-accent) 0 4px, transparent 4px 9px)",
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------ typography */
export interface SectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function SectionHeading({ children, style, ...rest }: SectionHeadingProps) {
  return (
    <div
      style={{
        color: "var(--nx-fg-accent)", fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wider)", textTransform: "uppercase",
        marginBottom: "var(--nx-space-2)", opacity: 0.85, ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface WordmarkProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  size?: string;
  /** Degrees of shear. 0 disables the skew. */
  skew?: number;
}

/** Condensed stencil wordmark with an RGB split. Display use only. */
export function Wordmark({ children, size = "var(--nx-text-xl)", skew = -9, style, ...rest }: WordmarkProps) {
  return (
    <span
      style={{
        fontFamily: "var(--nx-font-stencil)", fontSize: size, lineHeight: 0.8,
        color: "var(--nx-fg-default)", letterSpacing: "-0.02em",
        transform: `skewX(${skew}deg)`, display: "inline-block",
        textShadow: "2px 0 rgba(255,46,99,.33), -2px 0 rgba(23,226,229,.33)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * Blinking block cursor at ~0.94Hz. The frequency is capped by the token, not
 * by this component: WCAG 2.3.1 (Level A) prohibits flashing above 3Hz.
 */
export function BlinkCursor({ char = "█", style }: { char?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className="nx-blink" style={{ color: "var(--nx-fg-accent)", ...style }}>
      {char}
    </span>
  );
}

export interface KeyValueProps {
  label: ReactNode;
  value: ReactNode;
  style?: CSSProperties;
}

export function KeyValue({ label, value, style }: KeyValueProps) {
  // minWidth: 0 lets the row itself shrink inside a grid/flex column that's
  // narrower than "label + value" at full width (a bare `1fr` track won't
  // do this on its own — it sizes to content unless told otherwise); the
  // ellipsis on each span is what actually degrades gracefully once shrunk,
  // instead of the value clipping mid-character with no indication.
  const truncate: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--nx-space-4)", minWidth: 0, ...style }}>
      <span style={{ color: "var(--nx-fg-tertiary)", letterSpacing: "var(--nx-track-wide)", ...truncate }}>{label}</span>
      <span style={{ color: "var(--nx-fg-default)", fontVariantNumeric: "tabular-nums", ...truncate }}>{value}</span>
    </div>
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}

export function Stat({ label, value, tone = "default", style }: StatProps) {
  return (
    <div style={style}>
      <div style={{
        color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wide)", marginBottom: "var(--nx-space-1)",
        textTransform: "uppercase",
      }}>{label}</div>
      <div style={{ color: toneVar(tone), fontSize: "var(--nx-text-xs)", letterSpacing: "var(--nx-track-normal)" }}>
        {value}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Button */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function Button({ active = false, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className="nx-btn" data-active={active ? "1" : "0"} {...rest}>
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- TabStrip */
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

/** WAI-ARIA tabs pattern: roving tabindex, arrow/Home/End navigation. */
export function TabStrip<V extends string = string>({
  tabs, value, onChange, label = "View", style,
}: TabStripProps<V>) {
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
      role="tablist"
      aria-label={label}
      style={{ display: "flex", border: "var(--nx-hairline) solid var(--nx-border-default)", ...style }}
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

/* ----------------------------------------------------------------- Slider */
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

/* -------------------------------------------------------------- ToggleRow */
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

/* ------------------------------------------------------------------ Glyph */
export const GLYPH_SHAPES: readonly GlyphShape[] =
  ["circle", "hexagon", "diamond", "ring", "square", "triangle"] as const;

const PATHS: Record<Exclude<GlyphShape, "ring">, ReactNode> = {
  circle: <circle cx="7" cy="7" r="4.3" />,
  hexagon: <polygon points="7,2.4 11,4.8 11,9.2 7,11.6 3,9.2 3,4.8" />,
  diamond: <polygon points="7,2.2 11.4,7 7,11.8 2.6,7" />,
  square: <rect x="3.2" y="3.2" width="7.6" height="7.6" />,
  triangle: <polygon points="7,2.3 11.6,10.6 2.4,10.6" />,
};

export interface GlyphProps {
  shape?: GlyphShape;
  colour?: string;
  muted?: boolean;
  size?: number;
  /** Supply when the glyph carries meaning; omit when it is decorative. */
  title?: string;
}

/**
 * Six distinct silhouettes. This is what satisfies WCAG 1.4.1 — category is
 * never communicated by colour alone.
 */
export function Glyph({ shape = "circle", colour = "var(--nx-fg-info)", muted = false, size = 13, title }: GlyphProps) {
  const c = muted ? "var(--nx-fg-disabled)" : colour;
  return (
    <svg
      width={size} height={size} viewBox="0 0 14 14"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, filter: muted ? "none" : `drop-shadow(0 0 4px ${c})` }}
    >
      {shape === "ring"
        ? <circle cx="7" cy="7" r="4.1" fill="none" strokeWidth="2.1" stroke={c} />
        : <g fill={c}>{PATHS[shape]}</g>}
    </svg>
  );
}

export interface LinkGlyphProps {
  colour?: string;
  dashed?: boolean;
  arrow?: boolean;
  width?: number;
  muted?: boolean;
  size?: number;
  title?: string;
}

/** Relation glyph: curve, optional dash pattern, optional arrowhead. */
export function LinkGlyph({
  colour = "var(--nx-fg-info)", dashed = false, arrow = false,
  width = 1.2, muted = false, size = 13, title,
}: LinkGlyphProps) {
  const c = muted ? "var(--nx-fg-disabled)" : colour;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14"
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0 }}>
      <path d="M1 9.5 Q7 2 13 9.5" fill="none" stroke={c} strokeWidth={width}
        strokeDasharray={dashed ? "2.2 1.9" : undefined} strokeLinecap="round" />
      {arrow && <polygon points="13,9.5 10,7.8 10.7,10.9" fill={c} />}
    </svg>
  );
}

/* ---------------------------------------------------------------- Tooltip */
export interface TooltipProps {
  x: number;
  y: number;
  accent?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Tooltip({ x, y, accent = "var(--nx-fg-info)", children, style }: TooltipProps) {
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 30,
        maxWidth: 270, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        background: "var(--nx-bg-surface)",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        borderLeft: `2px solid ${accent}`,
        padding: "var(--nx-space-2) var(--nx-space-3)",
        fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-normal)", textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
