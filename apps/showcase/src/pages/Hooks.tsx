import { useId, useState } from "react";
import { rankItems, useHotkey } from "@nexus-cyberdeck/react";
import { Spec } from "../components/Spec.js";
import { ITEMS } from "../data.js";
import { href } from "../router.js";

const link = { color: "var(--nx-fg-accent)" } as const;

export function UseHotkeyPage() {
  const [count, setCount] = useState(0);
  useHotkey("g", () => setCount((c) => c + 1));

  return (
    <Spec
      name="useHotkey"
      note="A global shortcut. mod+k is Cmd+K on Apple platforms and Ctrl+K elsewhere, and only
            that: every modifier is matched exactly, so shift+k does not fire for Shift+Alt+K.
            Combining mod with ctrl or meta is contradictory and throws."
      a11y="Unmodified keys are ignored while the user is typing in a field, so a single-key
            shortcut never hijacks text input. Modified combos are not, because nobody types
            Cmd+K."
      code={`useHotkey("mod+k", () => setOpen((v) => !v));\nuseHotkey("/", () => setOpen(true));`}
    >
      <div style={{ color: "var(--nx-fg-default)" }}>
        Press G anywhere on this page: <span>{count}</span>
      </div>
    </Spec>
  );
}

export function UseFocusTrapPage() {
  return (
    <Spec
      name="useFocusTrap"
      note="Focus trap, focus restoration and Escape dismissal for a modal surface. Tab and
            Shift+Tab wrap inside the container; focus that leaves it any other way is pulled
            back. Returns a ref to put on the container."
      code={`const ref = useFocusTrap<HTMLDivElement>(open, onClose);\nreturn <div ref={ref} role="dialog" aria-modal="true">…</div>;`}
    >
      <div style={{ color: "var(--nx-fg-subtle)" }}>
        Drawer and CommandPalette share this one implementation. Try it on the{" "}
        <a href={href("components", "drawer")} style={link}>
          Drawer
        </a>{" "}
        and{" "}
        <a href={href("components", "command-palette")} style={link}>
          CommandPalette
        </a>{" "}
        pages.
      </div>
    </Spec>
  );
}

export function RankItemsPage() {
  const [query, setQuery] = useState("atl");
  const id = useId();
  const results = rankItems(ITEMS, query, 8);

  return (
    <Spec
      name="rankItems"
      note="The ranker behind CommandPalette, exported on its own. Deliberately not fuzzy: exact,
            then prefix, then word-start, then contains, then class code, with weight breaking
            ties. An empty query returns the highest-weight items."
      code={`import { rankItems } from "@nexus-cyberdeck/react";\nrankItems(items, "atl", 8);`}
    >
      <label
        htmlFor={id}
        style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}
      >
        QUERY
      </label>
      <input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          display: "block",
          width: 240,
          margin: "var(--nx-space-2) 0 var(--nx-space-5)",
          padding: "var(--nx-space-3) 0",
          background: "transparent",
          border: 0,
          borderBottom: "var(--nx-hairline) solid var(--nx-border-strong)",
          color: "var(--nx-fg-default)",
          font: "inherit",
        }}
      />
      <ol aria-label="Ranked results" style={{ margin: 0, paddingLeft: "var(--nx-space-6)" }}>
        {results.map((it) => (
          <li key={it.id} style={{ color: it.colour }}>
            {it.label}{" "}
            <span style={{ color: "var(--nx-fg-tertiary)" }}>
              · {it.code} · weight {it.weight}
            </span>
          </li>
        ))}
      </ol>
      {results.length === 0 && <div style={{ color: "var(--nx-fg-subtle)" }}>No matches.</div>}
    </Spec>
  );
}
