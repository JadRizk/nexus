/* ============================================================================
   Nexus Cyberdeck — single-file preview of the design system.

   The library code below is the REAL @nexus/react source, bundled by esbuild
   straight from packages/react/src with types stripped. The CSS is the real
   tokens.css + crt.css + styles.css concatenated. Nothing here is a
   re-implementation, so this preview cannot drift from the packages.

   In a real install you would instead:
     import "@nexus/tokens/tokens.css";
     import { Panel, Drawer } from "@nexus/react";
   ========================================================================== */

import React, { createContext, useCallback, useContext, useEffect, useEffect as useEffect2, useEffect as useEffect3, useId, useId as useId2, useMemo, useRef, useRef as useRef2, useRef as useRef3, useState, useState as useState2 } from "react";
// packages/react/src/primitives.tsx
// packages/tokens/src/index.ts
var tone = (t) => `var(--nx-fg-${t})`;

// packages/react/src/primitives.tsx
var Ctx = createContext({
  theme: "hud-aa",
  crt: true,
  setTheme: () => {
  },
  setCrt: () => {
  }
});
var useNexus = () => useContext(Ctx);
function NexusProvider({
  theme = "hud-aa",
  crt = true,
  children,
  className = "",
  ...rest
}) {
  const [t, setTheme] = useState(theme);
  const [c, setCrt] = useState(crt);
  useEffect(() => setTheme(theme), [theme]);
  useEffect(() => setCrt(crt), [crt]);
  return /* @__PURE__ */ React.createElement(Ctx.Provider, { value: { theme: t, crt: c, setTheme, setCrt } }, /* @__PURE__ */ React.createElement("div", { className: `nx-root ${className}`, "data-nx-theme": t, "data-nx-crt": c ? "on" : "off", ...rest }, children));
}
function Panel({
  corners = ["tl", "br"],
  padded = true,
  raised = false,
  style,
  children,
  ...rest
}) {
  const attr = corners === "none" ? "none" : corners.join(" ");
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "nx-panel",
      "data-nx-corners": attr,
      style: {
        position: "relative",
        background: "var(--nx-bg-surface)",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        borderRadius: "var(--nx-radius)",
        boxShadow: raised ? "var(--nx-glow-raised), var(--nx-glow-inset)" : "var(--nx-glow-inset)",
        padding: padded ? "var(--nx-space-5)" : 0,
        color: "var(--nx-fg-subtle)",
        fontFamily: "var(--nx-font-mono)",
        fontSize: "var(--nx-text-xs)",
        ...style
      },
      ...rest
    },
    children
  );
}
function HazardRule({ height = 5, opacity = 0.32, style }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      "aria-hidden": "true",
      style: {
        height,
        opacity,
        background: "repeating-linear-gradient(-45deg, var(--nx-fg-accent) 0 4px, transparent 4px 9px)",
        ...style
      }
    }
  );
}
function SectionHeading({ children, style, ...rest }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      style: {
        color: "var(--nx-fg-accent)",
        fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wider)",
        textTransform: "uppercase",
        marginBottom: "var(--nx-space-2)",
        opacity: 0.85,
        ...style
      },
      ...rest
    },
    children
  );
}
function Wordmark({ children, size = "var(--nx-text-xl)", skew = -9, style, ...rest }) {
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      style: {
        fontFamily: "var(--nx-font-stencil)",
        fontSize: size,
        lineHeight: 0.8,
        color: "var(--nx-fg-default)",
        letterSpacing: "-0.02em",
        transform: `skewX(${skew}deg)`,
        display: "inline-block",
        textShadow: "2px 0 rgba(255,46,99,.33), -2px 0 rgba(23,226,229,.33)",
        ...style
      },
      ...rest
    },
    children
  );
}
function BlinkCursor({ char = "\u2588", style }) {
  return /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", className: "nx-blink", style: { color: "var(--nx-fg-accent)", ...style } }, char);
}
function KeyValue({ label, value, style }) {
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", gap: "var(--nx-space-4)", ...style } }, /* @__PURE__ */ React.createElement("span", { style: { color: "var(--nx-fg-tertiary)", letterSpacing: "var(--nx-track-wide)" } }, label), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--nx-fg-default)", fontVariantNumeric: "tabular-nums" } }, value));
}
function Stat({ label, value, tone: tone2 = "default", style }) {
  return /* @__PURE__ */ React.createElement("div", { style }, /* @__PURE__ */ React.createElement("div", { style: {
    color: "var(--nx-fg-tertiary)",
    fontSize: "var(--nx-text-2xs)",
    letterSpacing: "var(--nx-track-wide)",
    marginBottom: "var(--nx-space-1)",
    textTransform: "uppercase"
  } }, label), /* @__PURE__ */ React.createElement("div", { style: { color: tone(tone2), fontSize: "var(--nx-text-xs)", letterSpacing: "var(--nx-track-normal)" } }, value));
}
function Button({ active = false, children, ...rest }) {
  return /* @__PURE__ */ React.createElement("button", { type: "button", className: "nx-btn", "data-active": active ? "1" : "0", ...rest }, children);
}
function TabStrip({
  tabs,
  value,
  onChange,
  label = "View",
  style
}) {
  const refs = useRef([]);
  const idx = tabs.findIndex((t) => t.value === value);
  const move = (delta) => {
    const n = (idx + delta + tabs.length) % tabs.length;
    const next = tabs[n];
    if (!next) return;
    onChange(next.value);
    refs.current[n]?.focus();
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "tablist",
      "aria-label": label,
      style: { display: "flex", border: "var(--nx-hairline) solid var(--nx-border-default)", ...style },
      onKeyDown: (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "Home") {
          e.preventDefault();
          const t = tabs[0];
          if (t) {
            onChange(t.value);
            refs.current[0]?.focus();
          }
        } else if (e.key === "End") {
          e.preventDefault();
          const n = tabs.length - 1;
          const t = tabs[n];
          if (t) {
            onChange(t.value);
            refs.current[n]?.focus();
          }
        }
      }
    },
    tabs.map((t, k) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.value,
        ref: (el) => {
          refs.current[k] = el;
        },
        role: "tab",
        type: "button",
        "aria-selected": t.value === value,
        tabIndex: t.value === value ? 0 : -1,
        className: "nx-tab",
        "data-active": t.value === value ? "1" : "0",
        onClick: () => onChange(t.value)
      },
      t.label
    ))
  );
}
function Slider({ label, value, min, max, step = 1, onChange, format, style }) {
  const id = useId();
  const shown = format ? format(value) : String(value);
  return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "var(--nx-space-4)", ...style } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "var(--nx-space-1)" } }, /* @__PURE__ */ React.createElement("label", { htmlFor: id, style: {
    color: "var(--nx-fg-tertiary)",
    fontSize: "var(--nx-text-2xs)",
    letterSpacing: "var(--nx-track-wide)",
    textTransform: "uppercase"
  } }, label), /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
    color: "var(--nx-fg-default)",
    fontSize: "var(--nx-text-2xs)",
    fontVariantNumeric: "tabular-nums"
  } }, shown)), /* @__PURE__ */ React.createElement(
    "input",
    {
      id,
      className: "nx-slider",
      type: "range",
      min,
      max,
      step,
      value,
      "aria-valuetext": shown,
      onChange: (e) => onChange(parseFloat(e.target.value))
    }
  ));
}
function ToggleRow({ checked, onChange, icon, label, meta, style }) {
  return /* @__PURE__ */ React.createElement("label", { className: "nx-row", style }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", className: "nx-sr", checked, onChange: (e) => onChange(e.target.checked) }), icon, /* @__PURE__ */ React.createElement("span", { style: {
    flex: 1,
    color: checked ? "var(--nx-fg-default)" : "var(--nx-fg-disabled)",
    letterSpacing: "var(--nx-track-normal)"
  } }, label), meta != null && /* @__PURE__ */ React.createElement("span", { style: { color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" } }, meta));
}
var GLYPH_SHAPES = ["circle", "hexagon", "diamond", "ring", "square", "triangle"];
var PATHS = {
  circle: /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "4.3" }),
  hexagon: /* @__PURE__ */ React.createElement("polygon", { points: "7,2.4 11,4.8 11,9.2 7,11.6 3,9.2 3,4.8" }),
  diamond: /* @__PURE__ */ React.createElement("polygon", { points: "7,2.2 11.4,7 7,11.8 2.6,7" }),
  square: /* @__PURE__ */ React.createElement("rect", { x: "3.2", y: "3.2", width: "7.6", height: "7.6" }),
  triangle: /* @__PURE__ */ React.createElement("polygon", { points: "7,2.3 11.6,10.6 2.4,10.6" })
};
function Glyph({ shape = "circle", colour = "var(--nx-fg-info)", muted = false, size = 13, title }) {
  const c = muted ? "var(--nx-fg-disabled)" : colour;
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 14 14",
      role: title ? "img" : void 0,
      "aria-label": title,
      "aria-hidden": title ? void 0 : true,
      style: { flexShrink: 0, filter: muted ? "none" : `drop-shadow(0 0 4px ${c})` }
    },
    shape === "ring" ? /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "4.1", fill: "none", strokeWidth: "2.1", stroke: c }) : /* @__PURE__ */ React.createElement("g", { fill: c }, PATHS[shape])
  );
}
function LinkGlyph({
  colour = "var(--nx-fg-info)",
  dashed = false,
  arrow = false,
  width = 1.2,
  muted = false,
  size = 13,
  title
}) {
  const c = muted ? "var(--nx-fg-disabled)" : colour;
  return /* @__PURE__ */ React.createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 14 14",
      role: title ? "img" : void 0,
      "aria-label": title,
      "aria-hidden": title ? void 0 : true,
      style: { flexShrink: 0 }
    },
    /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M1 9.5 Q7 2 13 9.5",
        fill: "none",
        stroke: c,
        strokeWidth: width,
        strokeDasharray: dashed ? "2.2 1.9" : void 0,
        strokeLinecap: "round"
      }
    ),
    arrow && /* @__PURE__ */ React.createElement("polygon", { points: "13,9.5 10,7.8 10.7,10.9", fill: c })
  );
}
function Tooltip({ x, y, accent = "var(--nx-fg-info)", children, style }) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "tooltip",
      style: {
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        zIndex: 30,
        maxWidth: 270,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        background: "var(--nx-bg-surface)",
        border: "var(--nx-hairline) solid var(--nx-border-default)",
        borderLeft: `2px solid ${accent}`,
        padding: "var(--nx-space-2) var(--nx-space-3)",
        fontFamily: "var(--nx-font-mono)",
        fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-normal)",
        textTransform: "uppercase",
        ...style
      }
    },
    children
  );
}

// packages/react/src/overlays.tsx
// packages/react/src/types.ts
function useFocusTrap(active, onDismiss) {
  const ref = useRef2(null);
  const restoreTo = useRef2(null);
  useEffect2(() => {
    if (!active) return void 0;
    restoreTo.current = document.activeElement;
    const node = ref.current;
    const SEL = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(node?.querySelectorAll(SEL) ?? []).filter((el) => el.offsetParent !== null);
    (focusables()[0] ?? node)?.focus?.();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const i = list.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        list[list.length - 1]?.focus();
      } else if (!e.shiftKey && i === list.length - 1) {
        e.preventDefault();
        list[0]?.focus();
      }
    };
    node?.addEventListener("keydown", onKey);
    return () => {
      node?.removeEventListener("keydown", onKey);
      const el = restoreTo.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [active, onDismiss]);
  return ref;
}
function useHotkey(combo, handler) {
  const cb = useCallback(handler, [handler]);
  useEffect2(() => {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1] ?? "";
    const wantMod = parts.includes("mod");
    const wantShift = parts.includes("shift");
    const on = (e) => {
      const t = e.target;
      const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (wantMod !== mod) return;
      if (wantShift !== e.shiftKey) return;
      if (!wantMod && typing) return;
      if (e.key.toLowerCase() !== key) return;
      e.preventDefault();
      cb(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [combo, cb]);
}
function rankItems(items, query, limit = 40) {
  const needle = query.trim().toLowerCase();
  const scored = [];
  for (const it of items) {
    const name = String(it.label).toLowerCase();
    let score;
    if (!needle) score = 40;
    else if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(`_${needle}`) || name.includes(`#${needle}`) || name.includes(` ${needle}`)) score = 65;
    else if (name.includes(needle)) score = 50;
    else if (String(it.code ?? "").toLowerCase().startsWith(needle)) score = 45;
    else continue;
    scored.push([score * 1e3 + (it.weight ?? 0), it]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, it]) => it);
}

// packages/react/src/overlays.tsx
function Drawer({
  open,
  onClose,
  title,
  subtitle,
  accent = "var(--nx-fg-info)",
  icon,
  footer,
  width = 296,
  children
}) {
  const trapRef = useFocusTrap(open, onClose);
  const titleId = useId2();
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: trapRef,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      "aria-hidden": open ? void 0 : true,
      tabIndex: -1,
      style: {
        position: "absolute",
        top: "var(--nx-space-5)",
        right: "var(--nx-space-5)",
        bottom: "var(--nx-space-5)",
        width,
        display: "flex",
        flexDirection: "column",
        transform: open ? "translateX(0)" : `translateX(${width + 28}px)`,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "transform var(--nx-dur-panel) var(--nx-ease), opacity var(--nx-dur-fade) linear"
      }
    },
    /* @__PURE__ */ React.createElement(Panel, { padded: false, raised: true, style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } }, /* @__PURE__ */ React.createElement("header", { style: {
      padding: "var(--nx-space-5)",
      borderBottom: "var(--nx-hairline) solid var(--nx-border-default)",
      flexShrink: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: "var(--nx-space-3)" } }, icon && /* @__PURE__ */ React.createElement("div", { style: { paddingTop: 2 } }, icon), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("h2", { id: titleId, style: {
      margin: 0,
      color: accent,
      fontFamily: "var(--nx-font-mono)",
      fontSize: "var(--nx-text-md)",
      fontWeight: 700,
      lineHeight: 1.25,
      letterSpacing: "var(--nx-track-normal)",
      textTransform: "uppercase",
      wordBreak: "break-all"
    } }, title), subtitle != null && /* @__PURE__ */ React.createElement("div", { style: {
      color: "var(--nx-fg-tertiary)",
      marginTop: "var(--nx-space-1)",
      letterSpacing: "var(--nx-track-wide)"
    } }, subtitle)), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "nx-btn",
        onClick: onClose,
        "aria-label": "Close details",
        style: { padding: "3px 6px", lineHeight: 1 }
      },
      "\u2715"
    ))), /* @__PURE__ */ React.createElement(HazardRule, { style: { flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--nx-space-5)" } }, children), footer && /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      gap: "var(--nx-space-2)",
      padding: "var(--nx-space-4) var(--nx-space-5)",
      borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
      flexShrink: 0
    } }, footer))
  );
}
function MeterRow({ label, value, total, colour, labelWidth = 66 }) {
  const pct = total > 0 ? Math.min(100, value / total * 100) : 0;
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--nx-space-3)", marginBottom: "var(--nx-space-1)" } }, /* @__PURE__ */ React.createElement("span", { style: { color: colour, letterSpacing: "var(--nx-track-wide)", width: labelWidth, flexShrink: 0 } }, label), /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "meter",
      "aria-valuenow": value,
      "aria-valuemin": 0,
      "aria-valuemax": total,
      "aria-label": `${label}: ${value} of ${total}`,
      style: { flex: 1, height: 4, background: "rgba(255,255,255,.045)" }
    },
    /* @__PURE__ */ React.createElement("div", { style: { height: "100%", width: `${pct}%`, background: colour, boxShadow: `0 0 6px ${colour}` } })
  ), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--nx-fg-default)", width: 18, textAlign: "right", fontVariantNumeric: "tabular-nums" } }, value));
}
function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
  placeholder = "SEARCH",
  emptyLabel = "NO MATCH",
  hint = [["\u2191\u2193", "MOVE"], ["\u21B5", "SELECT"], ["ESC", "CLOSE"]],
  renderMeta,
  width = 520
}) {
  const [query, setQuery] = useState2("");
  const [cursor, setCursor] = useState2(0);
  const inputRef = useRef3(null);
  const listRef = useRef3(null);
  const trapRef = useFocusTrap(open, onClose);
  const listId = useId2();
  useEffect3(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);
  useEffect3(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  useEffect3(() => {
    setCursor(0);
  }, [query]);
  const hits = useMemo(() => rankItems(items, query), [items, query]);
  useEffect3(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);
  if (!open) return null;
  const active = hits[cursor];
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      onMouseDown: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: "var(--nx-scrim)",
        backdropFilter: "blur(2px)",
        display: "flex",
        justifyContent: "center",
        paddingTop: "13vh"
      }
    },
    /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: trapRef,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": placeholder,
        tabIndex: -1,
        style: { width, maxWidth: "92vw", height: "fit-content", maxHeight: "62vh" }
      },
      /* @__PURE__ */ React.createElement(Panel, { padded: false, raised: true, style: { display: "flex", flexDirection: "column", maxHeight: "62vh" } }, /* @__PURE__ */ React.createElement("div", { style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--nx-space-4)",
        padding: "var(--nx-space-5)",
        borderBottom: "var(--nx-hairline) solid var(--nx-border-default)"
      } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: {
        color: "var(--nx-fg-accent)",
        fontWeight: 700,
        fontSize: "var(--nx-text-md)"
      } }, ">"), /* @__PURE__ */ React.createElement(
        "input",
        {
          ref: inputRef,
          value: query,
          onChange: (e) => setQuery(e.target.value),
          placeholder,
          role: "combobox",
          "aria-expanded": true,
          "aria-controls": listId,
          "aria-autocomplete": "list",
          "aria-activedescendant": active ? `${listId}-${cursor}` : void 0,
          "aria-label": placeholder,
          onKeyDown: (e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(hits.length - 1, c + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              setCursor(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setCursor(hits.length - 1);
            } else if (e.key === "Enter" && active) {
              e.preventDefault();
              onSelect(active);
            }
          },
          style: {
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--nx-fg-default)",
            fontFamily: "var(--nx-font-mono)",
            fontSize: "var(--nx-text-md)",
            fontWeight: 500,
            letterSpacing: "var(--nx-track-wide)",
            textTransform: "uppercase"
          }
        }
      ), /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" } }, hits.length)), /* @__PURE__ */ React.createElement(HazardRule, { style: { flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", { className: "nx-sr", role: "status", "aria-live": "polite" }, hits.length, " result", hits.length === 1 ? "" : "s"), /* @__PURE__ */ React.createElement(
        "ul",
        {
          ref: listRef,
          id: listId,
          role: "listbox",
          "aria-label": "Results",
          style: { listStyle: "none", margin: 0, padding: "var(--nx-space-2) 0", overflowY: "auto", minHeight: 0 }
        },
        hits.length === 0 && /* @__PURE__ */ React.createElement("li", { style: {
          padding: "var(--nx-space-6) var(--nx-space-5)",
          color: "var(--nx-fg-tertiary)",
          letterSpacing: "var(--nx-track-wide)"
        } }, emptyLabel),
        hits.map((it, i) => /* @__PURE__ */ React.createElement(
          "li",
          {
            key: it.id,
            id: `${listId}-${i}`,
            role: "option",
            "aria-selected": i === cursor,
            onMouseEnter: () => setCursor(i),
            onMouseDown: (e) => {
              e.preventDefault();
              onSelect(it);
            },
            style: {
              display: "flex",
              alignItems: "center",
              gap: "var(--nx-space-4)",
              padding: "var(--nx-space-2) var(--nx-space-5)",
              cursor: "pointer",
              background: i === cursor ? "var(--nx-bg-hover)" : "transparent",
              borderLeft: `2px solid ${i === cursor ? "var(--nx-fg-accent)" : "transparent"}`
            }
          },
          it.shape && /* @__PURE__ */ React.createElement(Glyph, { shape: it.shape, colour: it.colour, size: 10 }),
          /* @__PURE__ */ React.createElement("span", { style: {
            flex: 1,
            color: i === cursor ? "var(--nx-fg-default)" : "var(--nx-fg-subtle)",
            letterSpacing: "var(--nx-track-normal)",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          } }, it.label),
          it.code && /* @__PURE__ */ React.createElement("span", { style: {
            color: it.colour,
            fontSize: "var(--nx-text-2xs)",
            letterSpacing: "var(--nx-track-wide)",
            opacity: 0.8
          } }, it.code),
          renderMeta?.(it)
        ))
      ), /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true", style: {
        display: "flex",
        gap: "var(--nx-space-6)",
        padding: "var(--nx-space-3) var(--nx-space-5)",
        borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
        color: "var(--nx-fg-tertiary)",
        fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wider)",
        flexShrink: 0
      } }, hint.map(([k, v]) => /* @__PURE__ */ React.createElement("span", { key: k }, k, " ", v))))
    )
  );
}
function Legend({ groups, style }) {
  return /* @__PURE__ */ React.createElement("div", { style }, groups.map((g, gi) => /* @__PURE__ */ React.createElement("fieldset", { key: g.title, style: { border: 0, margin: 0, padding: 0, marginTop: gi ? "var(--nx-space-4)" : 0 } }, /* @__PURE__ */ React.createElement("legend", { style: { padding: 0 } }, /* @__PURE__ */ React.createElement(SectionHeading, null, "/// ", g.title)), g.rows)));
}

const NX_CSS = `/* ============================================================================
   @nexus/tokens — tokens.css
   Zero dependencies. Works with React, Vue, Svelte, plain HTML, or a Tailwind
   preset generated from tokens.json.

   Usage:
     <html data-nx-theme="hud-aa">     default, WCAG AA
     <html data-nx-theme="hud">        the original PoC aesthetic

   Every semantic name exists in both themes, so swapping never touches
   component code.
   ========================================================================== */

:root {
  /* ---------------------------------------------------------- primitives --
     Never reference these directly from a component. Use the semantic layer.
     Contrast figures are measured against --nx-bg-surface (#0A0C0B).        */
  --nx-void:      #08090A;
  --nx-panel:     #0A0C0B;
  --nx-raised:    #11150F;

  --nx-acid:      #C6F135;   /* 14.98:1 */
  --nx-data:      #17E2E5;   /* 12.19:1 */
  --nx-lime:      #7CFF4F;   /* 15.20:1 */
  --nx-sodium:    #FF8A1E;   /*  8.32:1 */
  --nx-violet:    #9D7BFF;   /*  6.27:1 */
  --nx-phosphor:  #DFF5C7;   /* 16.84:1 */

  /* RESTRICTED. Reachable only through --nx-fg-critical. Spending this on a
     button is what collapses the whole language — the magenta reads as a
     warning precisely because nothing else uses it. */
  --nx-alarm:     #FF2E63;   /*  5.44:1 */

  /* -------------------------------------------------------- typography -- */
  --nx-font-mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --nx-font-stencil: Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Narrow", sans-serif;

  --nx-font-scale: 1.15;                       /* theme overrides this */
  --nx-text-2xs: calc(0.5625rem * var(--nx-font-scale));
  --nx-text-xs:  calc(0.625rem  * var(--nx-font-scale));
  --nx-text-sm:  calc(0.6875rem * var(--nx-font-scale));
  --nx-text-md:  calc(0.8125rem * var(--nx-font-scale));
  --nx-text-lg:  calc(1rem      * var(--nx-font-scale));
  --nx-text-xl:  calc(1.3125rem * var(--nx-font-scale));

  --nx-track-tight:  0.06em;
  --nx-track-normal: 0.09em;
  --nx-track-wide:   0.14em;
  --nx-track-wider:  0.2em;

  --nx-weight-regular: 400;
  --nx-weight-medium:  500;
  --nx-weight-bold:    700;

  --nx-leading-tight: 1;
  --nx-leading-body:  1.5;

  /* ------------------------------------------------------------ layout -- */
  --nx-space-0: 0;    --nx-space-1: 2px;  --nx-space-2: 4px;  --nx-space-3: 6px;
  --nx-space-4: 8px;  --nx-space-5: 12px; --nx-space-6: 16px; --nx-space-7: 24px;
  --nx-space-8: 32px;

  --nx-hairline: 1px;
  --nx-radius:   0;              /* zero everywhere, by design */
  --nx-tick:     9px;            /* corner frame arm length */

  /* ------------------------------------------------------------ motion -- */
  --nx-dur-micro: 100ms;
  --nx-dur-fade:  180ms;
  --nx-dur-panel: 220ms;
  --nx-ease:      cubic-bezier(0.2, 0.9, 0.3, 1);
  --nx-blink:     1.06s;

  /* --------------------------------------------------------- elevation -- */
  --nx-glow-inset:  inset 0 0 40px rgba(198, 241, 53, 0.035);
  --nx-glow-raised: 0 0 60px rgba(198, 241, 53, 0.10);

  /* ------------------------------------------------------------- scrim -- */
  --nx-scrim: rgba(4, 5, 4, 0.62);

  /* ----------------------------------------------------- CRT primitives -- */
  --nx-crt-r: rgba(255, 46, 99, 0.4);
  --nx-crt-b: rgba(23, 226, 229, 0.4);
  --nx-crt-scan-opacity: 0.5;
  --nx-crt-scan-size: 3px;
}

/* ============================================================================
   THEME: hud-aa (default) — WCAG AA. Signature colours untouched; only the
   muted ramp lifts. Solved against exact contrast targets, hue 100deg sat 13%.
   ========================================================================== */
:root,
[data-nx-theme="hud-aa"] {
  --nx-font-scale: 1.15;

  --nx-grey-100: #2F382B;   /*  1.61:1  decorative hairline only */
  --nx-grey-200: #53624B;   /*  3.01:1  UI boundary — meets 1.4.11 */
  --nx-grey-300: #6B7F61;   /*  4.52:1  disabled text — meets 1.4.3 */
  --nx-grey-400: #788E6D;   /*  5.50:1 */
  --nx-grey-500: #8DA084;   /*  7.00:1 */
  --nx-grey-600: #B0BDA9;   /* 10.00:1 */
}

/* ============================================================================
   THEME: hud — the PoC verbatim. Muted text fails AA (1.21–4.98:1). Ship this
   only where the operator opts into an immersive surface.
   ========================================================================== */
[data-nx-theme="hud"] {
  --nx-font-scale: 1;

  --nx-grey-100: #1B2318;   /* 1.21:1 */
  --nx-grey-200: #2C3729;   /* 1.57:1 */
  --nx-grey-300: #3D4C39;   /* 2.14:1 */
  --nx-grey-400: #4A5C46;   /* 2.72:1 */
  --nx-grey-500: #5E7359;   /* 3.80:1 */
  --nx-grey-600: #6E8768;   /* 4.98:1 */
}

/* ============================================================================
   SEMANTIC LAYER — the only names components may use.
   ========================================================================== */
:root {
  --nx-bg-canvas:  var(--nx-void);
  --nx-bg-surface: var(--nx-panel);
  --nx-bg-raised:  var(--nx-raised);
  --nx-bg-hover:   rgba(198, 241, 53, 0.10);
  --nx-bg-active:  rgba(198, 241, 53, 0.16);

  --nx-fg-default:  var(--nx-phosphor);
  --nx-fg-muted:    var(--nx-grey-600);
  --nx-fg-subtle:   var(--nx-grey-500);
  --nx-fg-tertiary: var(--nx-grey-400);
  --nx-fg-disabled: var(--nx-grey-300);

  --nx-fg-accent:   var(--nx-acid);
  --nx-fg-info:     var(--nx-data);
  --nx-fg-warning:  var(--nx-sodium);
  --nx-fg-critical: var(--nx-alarm);       /* the only route to alarm */

  --nx-border-default: var(--nx-grey-100);
  --nx-border-strong:  var(--nx-grey-200);
  --nx-border-accent:  var(--nx-fg-accent);

  --nx-focus-ring:   var(--nx-fg-accent);
  --nx-focus-width:  2px;
  --nx-focus-offset: 2px;
}

/* ============================================================================
   BASE + UNIVERSAL FOCUS
   Focus was defined on a single button class in the PoC. Here it is global and
   non-removable — WCAG 2.4.7.
   ========================================================================== */
.nx-root {
  background: var(--nx-bg-canvas);
  color: var(--nx-fg-default);
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-xs);
  line-height: var(--nx-leading-body);
  letter-spacing: var(--nx-track-tight);
  -webkit-font-smoothing: antialiased;
}

.nx-root :focus-visible {
  outline: var(--nx-focus-width) solid var(--nx-focus-ring);
  outline-offset: var(--nx-focus-offset);
}

.nx-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nx-root *, .nx-root *::before, .nx-root *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/* ============================================================================
   @nexus/tokens — crt.css
   A CSS-only approximation of the PoC's four-pass shader pipeline.

   The real thing renders to a texture, bright-passes, blurs twice, then
   composites with barrel distortion, chromatic aberration, an aperture grille,
   a rolling refresh bar, grain and glitch slicing. You cannot run that behind
   every panel in an application — it is a full-screen GPU pipeline.

   This gets ~80% of the read for one extra composited pseudo-element and no
   JavaScript. Reserve the shader version for a hero canvas.

   Usage:
     <div class="nx-crt">…</div>                 scanlines + vignette
     <div class="nx-crt nx-crt--grain">…</div>   + static grain
     <div class="nx-crt" data-nx-crt="off">      disabled, zero cost
     <span class="nx-crt-split">TEXT</span>      chromatic fringing on text
   ========================================================================== */

.nx-crt { position: relative; isolation: isolate; }

/* Scanlines + aperture grille + vignette, all in one painted layer.
   pointer-events:none so it never intercepts interaction. */
.nx-crt::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    /* vignette */
    radial-gradient(
      ellipse at center,
      transparent 40%,
      rgba(0, 0, 0, 0.35) 100%
    ),
    /* horizontal scanlines */
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, calc(0.26 * var(--nx-crt-scan-opacity))) 0,
      rgba(0, 0, 0, calc(0.26 * var(--nx-crt-scan-opacity))) 1px,
      transparent 1px,
      transparent var(--nx-crt-scan-size)
    ),
    /* vertical RGB aperture grille */
    repeating-linear-gradient(
      to right,
      rgba(255, 0, 0, calc(0.05 * var(--nx-crt-scan-opacity))) 0px 1px,
      rgba(0, 255, 0, calc(0.05 * var(--nx-crt-scan-opacity))) 1px 2px,
      rgba(0, 0, 255, calc(0.05 * var(--nx-crt-scan-opacity))) 2px 3px
    );
}

/* Rolling refresh bar. Separate element so it can be disabled independently —
   a slow-moving luminance sweep is the part most likely to bother someone. */
.nx-crt--roll::before {
  content: "";
  position: absolute;
  left: 0; right: 0;
  height: 22%;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(198, 241, 53, 0.035) 45%,
    rgba(198, 241, 53, 0.055) 50%,
    rgba(198, 241, 53, 0.035) 55%,
    transparent
  );
  animation: nx-crt-roll 7s linear infinite;
}

@keyframes nx-crt-roll {
  from { transform: translateY(-120%); }
  to   { transform: translateY(560%); }
}

/* Static grain via inline SVG turbulence — no image request, no canvas. */
.nx-crt--grain::after {
  background-image:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.045'/></svg>"),
    radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.35) 100%),
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, calc(0.26 * var(--nx-crt-scan-opacity))) 0,
      rgba(0, 0, 0, calc(0.26 * var(--nx-crt-scan-opacity))) 1px,
      transparent 1px,
      transparent var(--nx-crt-scan-size)
    );
}

/* Chromatic fringing for text. This is what keeps DOM overlays from reading as
   pasted on top of a CRT surface — the PoC uses it on the graph labels. */
.nx-crt-split {
  text-shadow:
     1px 0 var(--nx-crt-r),
    -1px 0 var(--nx-crt-b),
     0 0 7px rgba(0, 0, 0, 0.98);
}

.nx-crt-glow {
  text-shadow: 0 0 8px currentColor, 0 0 2px rgba(0, 0, 0, 0.9);
}

/* ------------------------------------------------------------- opt out --
   Two independent escape hatches. \`data-nx-crt="off"\` is an author decision;
   prefers-reduced-motion is the user's, and it wins unconditionally.        */
[data-nx-crt="off"]::after,
[data-nx-crt="off"]::before { display: none !important; }

[data-nx-crt="off"] .nx-crt-split { text-shadow: none; }

@media (prefers-reduced-motion: reduce) {
  .nx-crt--roll::before { animation: none; display: none; }
}

/* Users who ask for more contrast should not be fighting a scanline overlay. */
@media (prefers-contrast: more) {
  .nx-crt::after, .nx-crt::before { display: none; }
  .nx-crt-split { text-shadow: none; }
}

/* ============================================================================
   @nexus/react — components.css
   Only the rules that inline styles cannot express: pseudo-elements (corner
   ticks, slider thumbs) and pseudo-classes (hover, focus-visible, checked).
   Everything else lives in the component's style prop, driven by tokens.
   ========================================================================== */

/* ------------------------------------------------------------------ Panel --
   Corner ticks. The PoC hardcoded top-left + bottom-right; here the arms are
   selectable, because a full box reads as a container and two arms read as a
   bracket — a meaningfully different signal.                                */
.nx-panel::before,
.nx-panel::after {
  content: "";
  position: absolute;
  width: var(--nx-tick);
  height: var(--nx-tick);
  pointer-events: none;
}
.nx-panel[data-nx-corners~="tl"]::before {
  top: -1px; left: -1px;
  border-top: var(--nx-hairline) solid var(--nx-border-accent);
  border-left: var(--nx-hairline) solid var(--nx-border-accent);
}
.nx-panel[data-nx-corners~="br"]::after {
  bottom: -1px; right: -1px;
  border-bottom: var(--nx-hairline) solid var(--nx-border-accent);
  border-right: var(--nx-hairline) solid var(--nx-border-accent);
}
.nx-panel[data-nx-corners~="tr"]::after {
  top: -1px; right: -1px; bottom: auto; left: auto;
  border-top: var(--nx-hairline) solid var(--nx-border-accent);
  border-right: var(--nx-hairline) solid var(--nx-border-accent);
  border-bottom: 0; border-left: 0;
}
.nx-panel[data-nx-corners~="bl"]::before {
  bottom: -1px; left: -1px; top: auto;
  border-bottom: var(--nx-hairline) solid var(--nx-border-accent);
  border-left: var(--nx-hairline) solid var(--nx-border-accent);
  border-top: 0;
}
.nx-panel[data-nx-corners="none"]::before,
.nx-panel[data-nx-corners="none"]::after { display: none; }

/* ----------------------------------------------------------------- Button */
.nx-btn {
  border: var(--nx-hairline) solid var(--nx-border-default);
  background: transparent;
  color: var(--nx-fg-muted);
  cursor: pointer;
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-2xs);
  font-weight: var(--nx-weight-medium);
  letter-spacing: var(--nx-track-wide);
  text-transform: uppercase;
  padding: var(--nx-space-3) var(--nx-space-3);
  border-radius: var(--nx-radius);
  transition: color var(--nx-dur-micro), border-color var(--nx-dur-micro), background var(--nx-dur-micro);
}
.nx-btn:hover {
  border-color: var(--nx-border-accent);
  color: var(--nx-fg-accent);
  background: var(--nx-bg-hover);
}
.nx-btn[data-active="1"] {
  border-color: var(--nx-border-accent);
  background: var(--nx-fg-accent);
  color: var(--nx-bg-canvas);
}
.nx-btn:disabled { color: var(--nx-fg-disabled); cursor: not-allowed; }
.nx-btn:disabled:hover { border-color: var(--nx-border-default); background: transparent; }

/* -------------------------------------------------------------- TabStrip */
.nx-tab {
  flex: 1;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: var(--nx-space-3) 0;
  font-family: var(--nx-font-mono);
  font-size: var(--nx-text-2xs);
  font-weight: var(--nx-weight-medium);
  letter-spacing: var(--nx-track-wider);
  text-transform: uppercase;
  color: var(--nx-fg-subtle);
  transition: color var(--nx-dur-micro), background var(--nx-dur-micro);
}
.nx-tab:hover { color: var(--nx-fg-accent); }
.nx-tab[data-active="1"] { background: var(--nx-fg-accent); color: var(--nx-bg-canvas); }

/* ---------------------------------------------------------------- Slider --
   The track uses --nx-border-strong, not --nx-border-default: a slider track
   is a UI component boundary and needs 3:1 under WCAG 1.4.11. The decorative
   hairline does not.                                                        */
.nx-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 2px;
  background: var(--nx-border-strong);
  outline: none;
  border-radius: var(--nx-radius);
  cursor: pointer;
}
.nx-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 8px; height: 14px;
  border-radius: var(--nx-radius);
  background: var(--nx-fg-accent);
  box-shadow: 0 0 8px var(--nx-fg-accent);
  cursor: pointer;
}
.nx-slider::-moz-range-thumb {
  width: 8px; height: 14px;
  border: 0;
  border-radius: var(--nx-radius);
  background: var(--nx-fg-accent);
  box-shadow: 0 0 8px var(--nx-fg-accent);
  cursor: pointer;
}
/* Native range inputs do not receive :focus-visible reliably across engines,
   so the ring is drawn on the thumb instead. */
.nx-slider:focus-visible::-webkit-slider-thumb {
  outline: var(--nx-focus-width) solid var(--nx-focus-ring);
  outline-offset: var(--nx-focus-offset);
}
.nx-slider:focus-visible::-moz-range-thumb {
  outline: var(--nx-focus-width) solid var(--nx-focus-ring);
  outline-offset: var(--nx-focus-offset);
}

/* -------------------------------------------------------------- ToggleRow */
.nx-row {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-1) var(--nx-space-2);
  cursor: pointer;
  user-select: none;
  transition: background var(--nx-dur-micro);
  min-height: 24px;
}
.nx-row:hover { background: var(--nx-bg-hover); }
/* The checkbox is visually hidden but still focusable, so the ring has to be
   drawn on the label it belongs to. */
.nx-row:focus-within {
  outline: var(--nx-focus-width) solid var(--nx-focus-ring);
  outline-offset: calc(var(--nx-focus-offset) * -1);
}

/* ------------------------------------------------------------ BlinkCursor --
   Capped at ~0.94Hz. The PoC flickered orphan nodes at 9Hz, above the 3Hz
   threshold in WCAG 2.3.1 (Level A) — a seizure risk, not a taste question. */
@keyframes nx-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.nx-blink { animation: nx-blink var(--nx-blink) steps(1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .nx-blink { animation: none; opacity: 1; }
}

/* ------------------------------------------------------------- scrollbars */
.nx-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.nx-root ::-webkit-scrollbar-track { background: transparent; }
.nx-root ::-webkit-scrollbar-thumb { background: var(--nx-border-strong); border-radius: var(--nx-radius); }
.nx-root ::-webkit-scrollbar-thumb:hover { background: var(--nx-fg-tertiary); }
.nx-root * { scrollbar-width: thin; scrollbar-color: var(--nx-border-strong) transparent; }

.nx-skip{position:absolute;left:-9999px;top:0;z-index:100;background:var(--nx-fg-accent);color:var(--nx-bg-canvas);padding:var(--nx-space-3) var(--nx-space-5);font:500 var(--nx-text-xs)/1 var(--nx-font-mono);letter-spacing:var(--nx-track-wide);text-transform:uppercase;text-decoration:none}.nx-skip:focus{left:var(--nx-space-4);top:var(--nx-space-4)}`;


/* ============================================================================
   PAGES — mirrors apps/showcase/src/pages/*.tsx
   ========================================================================== */
const CLASSES = [
  { key: "atlas",  label: "ATLAS",  code: "ATL", shape: "hexagon",  colour: "var(--nx-fg-accent)" },
  { key: "node",   label: "NODE",   code: "NDE", shape: "circle",   colour: "var(--nx-fg-info)" },
  { key: "unrslv", label: "UNRSLV", code: "UNR", shape: "triangle", colour: "var(--nx-fg-critical)" },
  { key: "source", label: "SOURCE", code: "SRC", shape: "square",   colour: "var(--nx-fg-warning)" },
  { key: "agent",  label: "AGENT",  code: "AGT", shape: "ring",     colour: "var(--nx-violet)" },
  { key: "tag",    label: "TAG",    code: "TAG", shape: "diamond",  colour: "var(--nx-lime)" },
];
const RELATIONS = [
  { key: "link",     label: "LINK",     colour: "#3AC6D4", arrow: true },
  { key: "cite",     label: "CITE",     colour: "var(--nx-fg-warning)", arrow: true, width: 1.5 },
  { key: "tagged",   label: "TAGGED",   colour: "var(--nx-fg-accent)", dashed: true, width: 0.9 },
  { key: "mention",  label: "MENTION",  colour: "var(--nx-violet)", dashed: true, arrow: true },
  { key: "conflict", label: "CONFLICT", colour: "var(--nx-fg-critical)", width: 1.6 },
];
const ITEMS = [
  ["VECTOR//ATLAS","ATL","hexagon","var(--nx-fg-accent)",36],
  ["RESIDUE//ATLAS","ATL","hexagon","var(--nx-fg-accent)",24],
  ["CACHE//ATLAS","ATL","hexagon","var(--nx-fg-accent)",24],
  ["tidal_aperture","NDE","circle","var(--nx-fg-info)",7],
  ["liminal_corpus","NDE","circle","var(--nx-fg-info)",9],
  ["narrow_relay","NDE","circle","var(--nx-fg-info)",5],
  ["opaque_corpus","NDE","circle","var(--nx-fg-info)",8],
  ["tidal_margin","NDE","circle","var(--nx-fg-info)",6],
  ["#brittle","TAG","diamond","var(--nx-lime)",17],
  ["#recursive","TAG","diamond","var(--nx-lime)",16],
  ["#folded","TAG","diamond","var(--nx-lime)",15],
  ["FIELDLOG-294","SRC","square","var(--nx-fg-warning)",4],
  ["INTERCEPT-868","SRC","square","var(--nx-fg-warning)",3],
  ["ALDOURI","AGT","ring","var(--nx-violet)",6],
  ["OKONKWO","AGT","ring","var(--nx-violet)",4],
  ["?opaque_ledger","UNR","triangle","var(--nx-fg-critical)",3],
].map(([label, code, shape, colour, weight], id) => ({ id, label, code, shape, colour, weight }));

const PALETTE_SWATCHES = [
  ["acid","#C6F135",14.98],["data","#17E2E5",12.19],["lime","#7CFF4F",15.20],
  ["sodium","#FF8A1E",8.32],["violet","#9D7BFF",6.27],["alarm","#FF2E63",5.44],
  ["phosphor","#DFF5C7",16.84],
];
const RAMPS = {
  "hud-aa": [["grey-100","#2F382B",1.61],["grey-200","#53624B",3.01],["grey-300","#6B7F61",4.52],
             ["grey-400","#788E6D",5.50],["grey-500","#8DA084",7.00],["grey-600","#B0BDA9",10.00]],
  "hud":    [["grey-100","#1B2318",1.21],["grey-200","#2C3729",1.57],["grey-300","#3D4C39",2.14],
             ["grey-400","#4A5C46",2.72],["grey-500","#5E7359",3.80],["grey-600","#6E8768",4.98]],
};

function PageHeader({ title, lede }) {
  return (
    <header style={{ marginBottom: "var(--nx-space-7)", maxWidth: 660 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--nx-font-stencil)", fontSize: "2rem", lineHeight: .9,
        color: "var(--nx-fg-default)", letterSpacing: "-.02em", transform: "skewX(-9deg)",
        display: "inline-block", textTransform: "uppercase",
        textShadow: "2px 0 rgba(255,46,99,.28),-2px 0 rgba(23,226,229,.28)" }}>{title}</h1>
      <p style={{ margin: "var(--nx-space-5) 0 0", color: "var(--nx-fg-subtle)",
        fontSize: "var(--nx-text-sm)", lineHeight: 1.7 }}>{lede}</p>
    </header>
  );
}
function Spec({ name, note, a11y, children, code }) {
  return (
    <section style={{ marginBottom: "var(--nx-space-7)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-4)", marginBottom: "var(--nx-space-3)" }}>
        <h2 style={{ margin: 0, color: "var(--nx-fg-default)", fontFamily: "var(--nx-font-mono)",
          fontSize: "var(--nx-text-md)", fontWeight: 700, letterSpacing: "var(--nx-track-wide)",
          textTransform: "uppercase" }}>{name}</h2>
        <div style={{ flex: 1, height: 1, background: "var(--nx-border-default)" }} />
      </div>
      {note && <p style={{ margin: "0 0 var(--nx-space-4)", color: "var(--nx-fg-subtle)",
        fontSize: "var(--nx-text-xs)", lineHeight: 1.7, maxWidth: 620 }}>{note}</p>}
      <Panel corners={["tl","br"]} style={{ marginBottom: (a11y || code) ? "var(--nx-space-3)" : 0 }}>{children}</Panel>
      {a11y && (
        <div style={{ display: "flex", gap: "var(--nx-space-3)", padding: "var(--nx-space-3) var(--nx-space-4)",
          borderLeft: "2px solid var(--nx-fg-accent)", background: "rgba(198,241,53,.05)",
          marginBottom: code ? "var(--nx-space-3)" : 0 }}>
          <span aria-hidden="true" style={{ color: "var(--nx-fg-accent)", fontSize: "var(--nx-text-2xs)",
            letterSpacing: "var(--nx-track-wider)", flexShrink: 0, paddingTop: 1 }}>A11Y</span>
          <span style={{ color: "var(--nx-fg-muted)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.7 }}>{a11y}</span>
        </div>
      )}
      {code && <pre style={{ margin: 0, padding: "var(--nx-space-4) var(--nx-space-5)",
        background: "rgba(0,0,0,.35)", border: "var(--nx-hairline) solid var(--nx-border-default)",
        color: "var(--nx-fg-muted)", fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-2xs)",
        lineHeight: 1.7, overflowX: "auto" }}><code>{code}</code></pre>}
    </section>
  );
}
const Row = ({ children, gap = "var(--nx-space-5)", align = "center" }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: align }}>{children}</div>
);
function Swatch({ name, value, ratio }) {
  const fails = ratio != null && ratio < 4.5;
  return (
    <div style={{ width: 132 }}>
      <div style={{ height: 42, background: value, border: "var(--nx-hairline) solid var(--nx-border-default)",
        boxShadow: `0 0 14px ${value}33` }} />
      <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-default)",
        fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>{name}</div>
      {ratio != null && <div style={{ color: fails ? "var(--nx-fg-critical)" : "var(--nx-fg-tertiary)",
        fontSize: "var(--nx-text-2xs)" }}>{ratio.toFixed(2)}:1{fails ? " · fails AA" : ""}</div>}
    </div>
  );
}

function PrimitivesPage() {
  const [tab, setTab] = useState("optics");
  const [scan, setScan] = useState(0.55);
  const [on, setOn] = useState(Object.fromEntries(CLASSES.map((c) => [c.key, true])));
  return (
    <>
      <PageHeader title="Primitives" lede="Every primitive is styled entirely from CSS custom properties, so none of them know which theme is active. Switching between HUD and AA in the header changes the muted ramp and the type scale without touching a single component." />
      <Spec name="Panel" note="Hairline border, zero radius, inset acid glow, corner ticks as pseudo-elements. Two arms read as a bracket; four read as a box — a meaningfully different signal, so the corners are configurable." code={'<Panel corners={["tl", "br"]} raised>…</Panel>'}>
        <Row align="stretch">
          <Panel corners={["tl","br"]} style={{ width: 150 }}>tl · br</Panel>
          <Panel corners={["tl","tr","bl","br"]} style={{ width: 150 }}>all four</Panel>
          <Panel corners="none" style={{ width: 150 }}>none</Panel>
          <Panel corners={["tl","br"]} raised style={{ width: 150 }}>raised</Panel>
        </Row>
      </Spec>
      <Spec name="Typography" note="Six sizes and four tracking values, down from eleven and thirteen in the prototype. Sizes are in rem so browser zoom and user font-size preferences work — WCAG 1.4.4.">
        <Row gap="var(--nx-space-7)" align="flex-end">
          <Wordmark>NEXUS</Wordmark>
          <div><SectionHeading>/// section heading</SectionHeading>
            <div style={{ color: "var(--nx-fg-default)" }}>default body text <BlinkCursor /></div></div>
        </Row>
        <div style={{ marginTop: "var(--nx-space-5)" }}>
          {["default","muted","subtle","tertiary","disabled"].map((t) => (
            <div key={t} style={{ color: `var(--nx-fg-${t})`, letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase", padding: "1px 0" }}>{t} — the quick brown fox jumps over the lazy dog</div>
          ))}
        </div>
      </Spec>
      <Spec name="Button" note="The active state inverts to the accent colour rather than adding a border, so it reads at a glance in a dense control panel." code={'<Button active onClick={…}>Isolate</Button>'}>
        <Row><Button>Default</Button><Button active>Active</Button><Button disabled>Disabled</Button></Row>
      </Spec>
      <Spec name="TabStrip" a11y="WAI-ARIA tabs pattern: roving tabindex, arrow keys to move, Home and End to jump. The prototype used plain buttons with no keyboard model at all." code={'<TabStrip value={tab} onChange={setTab} tabs={[…]} />'}>
        <div style={{ maxWidth: 240 }}>
          <TabStrip value={tab} onChange={setTab} tabs={[{ value: "optics", label: "Optics" }, { value: "solver", label: "Solver" }]} />
        </div>
      </Spec>
      <Spec name="Slider" note="A restyled native input, not a custom div. Keyboard support, touch targets and screen-reader announcement come free." a11y="aria-valuetext carries the formatted value. The track uses --nx-border-strong because a slider track is a UI component boundary needing 3:1 under WCAG 1.4.11." code={'<Slider label="scanlines" value={scan} min={0} max={1} step={0.02}\n  onChange={setScan} format={(v) => v.toFixed(2)} />'}>
        <div style={{ maxWidth: 260 }}>
          <Slider label="scanlines" value={scan} min={0} max={1} step={0.02} onChange={setScan} format={(v) => v.toFixed(2)} />
        </div>
      </Spec>
      <Spec name="ToggleRow" a11y="Backed by a real checkbox, visually hidden but focusable and announced. The prototype used a div with onClick — invisible to keyboards and screen readers alike." code={'<ToggleRow checked={on} onChange={setOn} icon={<Glyph shape="hexagon" />} label="ATLAS" meta="ATL" />'}>
        <div style={{ maxWidth: 220 }}>
          {CLASSES.map((c) => (
            <ToggleRow key={c.key} checked={!!on[c.key]} onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
              icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />} label={c.label} meta={c.code} />
          ))}
        </div>
      </Spec>
      <Spec name="Glyph" note="Six distinct silhouettes. This is what satisfies WCAG 1.4.1 — category is never communicated by colour alone, which is the criterion most dark-neon systems fail." code={'<Glyph shape="hexagon" colour={tone("accent")} title="Atlas" />'}>
        <Row gap="var(--nx-space-6)">
          {GLYPH_SHAPES.map((s, i) => (
            <div key={s} style={{ textAlign: "center", width: 62 }}>
              <Glyph shape={s} size={22} colour={CLASSES[i] && CLASSES[i].colour} />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{s}</div>
            </div>
          ))}
        </Row>
      </Spec>
      <Spec name="LinkGlyph" note="Relation glyphs pair colour with a dash pattern and an optional arrowhead, so relation type survives greyscale printing and colour-vision differences.">
        <Row gap="var(--nx-space-6)">
          {RELATIONS.map((r) => (
            <div key={r.key} style={{ textAlign: "center", width: 78 }}>
              <LinkGlyph colour={r.colour} dashed={r.dashed} arrow={r.arrow} width={r.width} size={22} />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{r.label}</div>
            </div>
          ))}
        </Row>
      </Spec>
      <Spec name="KeyValue · Stat · HazardRule" code={'<KeyValue label="NODES" value={200} />'}>
        <Row gap="var(--nx-space-7)" align="flex-start">
          <div style={{ width: 170 }}>
            <KeyValue label="NODES" value={200} />
            <KeyValue label="LINKS" value={616} />
            <KeyValue label="SOLVER" value={<span style={{ color: "var(--nx-fg-accent)" }}>LOCKED</span>} />
          </div>
          <Row gap="var(--nx-space-6)">
            <Stat label="Class" value="NODE" tone="info" />
            <Stat label="State" value="DORMANT" tone="warning" />
            <Stat label="Conflict" value="2" tone="critical" />
          </Row>
        </Row>
        <HazardRule style={{ marginTop: "var(--nx-space-5)" }} />
      </Spec>
      <Spec name="Tooltip" note="Absolutely positioned, pointer-events none, accent bar keyed to the subject's class.">
        <div style={{ position: "relative", height: 54 }}>
          <Tooltip x={0} y={8} accent="var(--nx-fg-info)">
            <span style={{ color: "var(--nx-fg-info)" }}>tidal_aperture</span>
            <span style={{ color: "var(--nx-fg-tertiary)" }}> · NDE · 7</span>
          </Tooltip>
        </div>
      </Spec>
    </>
  );
}

function OverlaysPage() {
  const [drawer, setDrawer] = useState(true);
  const [pal, setPal] = useState(false);
  const [picked, setPicked] = useState(ITEMS[3]);
  useHotkey("mod+k", () => setPal((v) => !v));
  useHotkey("/", () => setPal(true));
  const hex = (((Number(picked.id) * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");
  return (
    <>
      <PageHeader title="Overlays" lede="Drawer and CommandPalette are where design systems fail accessibility audits — focus trapping, restoration, escape dismissal, roving focus and live announcements all have to be right at once. Both share one focus-trap implementation rather than each growing its own." />
      <Spec name="Drawer" note="Slides rather than mounting and unmounting, so the motion reads as one object moving instead of two objects swapping. 220ms on a spring curve." a11y="role=dialog with aria-modal. Focus is trapped while open and restored to whatever opened it on close. Escape dismisses. When closed the subtree is aria-hidden, so a screen reader never wanders into offscreen content." code={'<Drawer open={open} onClose={close} title="tidal_aperture"\n  subtitle="0x493B · NDE" footer={<Button active>Isolate</Button>}>…</Drawer>'}>
        <Row>
          <Button active={drawer} onClick={() => setDrawer((d) => !d)}>{drawer ? "Close drawer" : "Open drawer"}</Button>
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>
            Tab into it, then press Escape — focus returns to this button.
          </span>
        </Row>
      </Spec>
      <Spec name="CommandPalette" note="Ranking is deliberately not fuzzy: exact, prefix, word-start, contains, then class code. An empty query returns the highest-weight items, so it doubles as a table of contents." a11y="The ARIA combobox pattern. The input never loses focus and owns aria-activedescendant; results are a real listbox with role=option; a visually hidden live region announces the result count." code={'<CommandPalette open={open} onClose={close} items={ITEMS}\n  onSelect={(item) => { select(item); close(); }} />'}>
        <Row>
          <Button onClick={() => setPal(true)}>Open palette</Button>
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>
            ⌘K / Ctrl+K anywhere · try “tid”, “#”, “atl”, or leave it empty
          </span>
        </Row>
        <div style={{ marginTop: "var(--nx-space-4)", color: "var(--nx-fg-subtle)", fontSize: "var(--nx-text-2xs)" }}>
          selected → <span style={{ color: picked.colour }}>{picked.label}</span> · 0x{hex}
        </div>
      </Spec>
      <Spec name="MeterRow" note="A proportional bar with a real role=meter, not a decorative div." a11y="aria-valuenow / valuemin / valuemax with a composed label, so the value is announced as '5 of 7' rather than read as an unlabelled graphic." code={'<MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />'}>
        <div style={{ maxWidth: 320 }}>
          <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
          <MeterRow label="CITE" value={2} total={7} colour="var(--nx-fg-warning)" />
          <MeterRow label="CONFLICT" value={1} total={7} colour="var(--nx-fg-critical)" />
        </div>
      </Spec>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={picked.label}
        subtitle={`0x${hex} · ${picked.code}`} accent={picked.colour}
        icon={<Glyph shape={picked.shape} colour={picked.colour} />}
        footer={<><Button style={{ flex: 1 }}>Focus</Button><Button style={{ flex: 1 }} active>Isolate</Button></>}>
        <SectionHeading>/// relation profile</SectionHeading>
        <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
        <MeterRow label="CITE" value={2} total={7} colour="var(--nx-fg-warning)" />
        <div style={{ height: "var(--nx-space-5)" }} />
        <SectionHeading>/// adjacency [7]</SectionHeading>
        {ITEMS.slice(3, 10).map((it) => (
          <button key={it.id} type="button" className="nx-row" onClick={() => setPicked(it)}
            style={{ width: "100%", background: "none", border: 0, textAlign: "left", paddingLeft: 0 }}>
            <span aria-hidden="true" style={{ color: it.colour, width: 8 }}>▸</span>
            <Glyph shape={it.shape} colour={it.colour} size={10} />
            <span style={{ flex: 1, color: it.colour, textTransform: "uppercase",
              letterSpacing: "var(--nx-track-normal)", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{it.code}</span>
          </button>
        ))}
      </Drawer>
      <CommandPalette open={pal} onClose={() => setPal(false)} items={ITEMS}
        onSelect={(it) => { setPicked(it); setDrawer(true); setPal(false); }}
        renderMeta={(it) => <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", width: 22, textAlign: "right" }}>{it.weight}</span>} />
    </>
  );
}

function TokensPage() {
  const { theme } = useNexus();
  const ramp = RAMPS[theme];
  const aa = theme === "hud-aa";
  return (
    <>
      <PageHeader title="Tokens" lede="Three layers. Components may reference only the semantic layer, never primitives — enforced by review, and by the fact that the alarm colour has no semantic alias other than fg-critical." />
      <Spec name="Signature palette" note="Unchanged between themes. Every one already clears AA body contrast, which is why the accessible theme required no redesign — only the muted ramp had to move.">
        <Row>{PALETTE_SWATCHES.map(([n, v, r]) => <Swatch key={n} name={n} value={v} ratio={r} />)}</Row>
      </Spec>
      <Spec name={`Muted ramp — ${theme}`} note="Solved against exact contrast targets rather than picked by eye: hue 100°, saturation 13%, binary-searched per step. Switch the theme in the header to see what the prototype's ramp actually looked like."
        a11y={aa ? "This ramp meets AA: disabled text clears 4.5:1 and UI boundaries clear 3:1 (WCAG 1.4.11)."
                 : "This ramp fails AA. Eight of nine muted tokens sit below 4.5:1, and the border token used for slider tracks sits at 1.21:1 against a required 3:1."}>
        <Row>{ramp.map(([n, v, r]) => <Swatch key={n} name={n} value={v} ratio={r} />)}</Row>
      </Spec>
      <Spec name="Restricted colour" note="Magenta is reserved for alarm states — unresolved items and conflicts, nothing else. In the token graph it is reachable only through --nx-fg-critical; there is no general accent alias, so it cannot quietly become a button colour."
        code={'--nx-alarm: #FF2E63;               /* primitive, do not use */\n--nx-fg-critical: var(--nx-alarm);  /* the only route */'}>
        <div style={{ color: "var(--nx-fg-critical)", letterSpacing: "var(--nx-track-wide)" }}>
          CONFLICT · UNRESOLVED · 5.44:1
        </div>
      </Spec>
      <Spec name="Scales" note="Rationalised from the prototype: 11 font sizes to 6, 13 tracking values to 4, 12 spacing values to 8. Sizes are in rem so browser zoom works.">
        {["2xs","xs","sm","md","lg","xl"].map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-5)", padding: "2px 0" }}>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", width: 34 }}>{s}</span>
            <span style={{ color: "var(--nx-fg-default)", fontSize: `var(--nx-text-${s})`, letterSpacing: "var(--nx-track-normal)" }}>NEXUS CYBERDECK</span>
          </div>
        ))}
        <div style={{ marginTop: "var(--nx-space-5)" }}>
          {["tight","normal","wide","wider"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-5)", padding: "2px 0" }}>
              <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", width: 34 }}>{t}</span>
              <span style={{ color: "var(--nx-fg-muted)", letterSpacing: `var(--nx-track-${t})`, textTransform: "uppercase" }}>tracking specimen</span>
            </div>
          ))}
        </div>
      </Spec>
    </>
  );
}

/* ============================================================================
   SHELL — mirrors apps/showcase/src/App.tsx
   ========================================================================== */
const ROUTES = [
  { id: "primitives", label: "Primitives" },
  { id: "overlays", label: "Overlays" },
  { id: "tokens", label: "Tokens" },
];

function Shell() {
  const [route, setRoute] = useState("primitives");
  const { theme, setTheme, crt, setCrt } = useNexus();
  return (
    <div className={crt ? "nx-crt nx-crt--roll" : ""} style={{ minHeight: "100vh" }}>
      <a href="#main" className="nx-skip">Skip to content</a>
      <Panel corners="none" padded={false} style={{ position: "sticky", top: 0, zIndex: 20,
        borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--nx-space-6)",
          padding: "var(--nx-space-4) var(--nx-space-6)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-3)" }}>
            <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wider)" }}>DS v1.0 <BlinkCursor /></span>
          </div>
          <nav aria-label="Sections" style={{ display: "flex", gap: "var(--nx-space-2)", flex: 1 }}>
            {ROUTES.map((r) => (
              <Button key={r.id} active={route === r.id} aria-current={route === r.id ? "page" : undefined}
                onClick={() => setRoute(r.id)}>{r.label}</Button>
            ))}
          </nav>
          <div style={{ display: "flex", gap: "var(--nx-space-2)", alignItems: "center" }}>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wide)" }}>THEME</span>
            {["hud-aa", "hud"].map((t) => (
              <Button key={t} active={theme === t} aria-pressed={theme === t}
                onClick={() => setTheme(t)}>{t === "hud-aa" ? "AA" : "HUD"}</Button>
            ))}
            <Button active={crt} aria-pressed={crt} onClick={() => setCrt(!crt)}>CRT</Button>
          </div>
        </div>
        <HazardRule />
      </Panel>
      <main id="main" style={{ padding: "var(--nx-space-7) var(--nx-space-6)", maxWidth: 980 }}>
        {route === "primitives" && <PrimitivesPage />}
        {route === "overlays" && <OverlaysPage />}
        {route === "tokens" && <TokensPage />}
      </main>
      <footer style={{ padding: "var(--nx-space-6)", color: "var(--nx-fg-tertiary)",
        fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)", textTransform: "uppercase",
        borderTop: "var(--nx-hairline) solid var(--nx-border-default)" }}>
        Zero runtime dependencies · 78 tokens · 16 components · ⌘K opens the palette anywhere
      </footer>
    </div>
  );
}

export default function Preview() {
  return (
    <>
      <style>{NX_CSS}</style>
      <NexusProvider theme="hud-aa" crt>
        <Shell />
      </NexusProvider>
    </>
  );
}
