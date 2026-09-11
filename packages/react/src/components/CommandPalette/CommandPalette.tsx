import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ForwardedRef, ReactNode } from "react";
import { Panel } from "../Panel/index.js";
import { HazardRule } from "../HazardRule/index.js";
import { Glyph } from "../Glyph/index.js";
import { useFocusTrap } from "../../hooks/index.js";
import { rankItems } from "../../search/index.js";
import type { PaletteItem } from "../../search/index.js";
import { mergeRefs } from "../../refs.js";

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

// forwardRef's own type isn't generic, so a component that is generic over
// its item type has to be written as a plain function first and cast back to
// a generic call signature afterward — the cast is compile-time only, the
// runtime value underneath is still the same forwardRef-wrapped component.
function CommandPaletteInner<T extends PaletteItem = PaletteItem>(
  {
    open, onClose, items, onSelect,
    placeholder = "SEARCH", emptyLabel = "NO MATCH",
    hint = [["↑↓", "MOVE"], ["↵", "SELECT"], ["ESC", "CLOSE"]] as const,
    renderMeta, width = 520,
  }: CommandPaletteProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
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

  // Re-clamps whenever the result set itself changes size, not only when the
  // query does. `items` is a plain prop with no contract that it stay stable
  // while the palette is open — a consumer streaming in async results can
  // shrink or grow `hits` for the same query — and without this, a cursor
  // set by an earlier keystroke could point past the new end of the list, so
  // `active` silently goes undefined and Enter stops doing anything.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, hits.length - 1)));
  }, [hits.length]);

  // keep the active option in view without moving focus off the input
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  const active = hits[cursor];

  return (
    <div
      className="nx-palette__scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        // useFocusTrap needs its own handle on this node to find focusable
        // descendants; the forwarded ref gives a consumer a second one. Both
        // point at the same element, so they're merged into one callback ref
        // rather than fighting over the single `ref` prop (see Drawer.tsx,
        // which shares this exact shape).
        ref={mergeRefs(trapRef, ref)}
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        tabIndex={-1}
        className="nx-palette"
        // Per-instance: a palette over a short list wants to be narrower than
        // one over a corpus.
        style={{ "--nx-palette-width": `${width}px` } as CSSProperties}
      >
        <Panel padded={false} raised className="nx-palette__panel">
          <div className="nx-palette__field">
            <span aria-hidden="true" className="nx-palette__prompt">
              &gt;
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="nx-palette__input"
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
                // Clamped to 0, not hits.length - 1, when hits is empty: an
                // unclamped -1 would stick if results later populate for the
                // same query (items updating async doesn't reset cursor, only
                // a query change does), leaving Enter silently inert until an
                // arrow key was pressed to pull cursor back into range.
                else if (e.key === "End") { e.preventDefault(); setCursor(Math.max(0, hits.length - 1)); }
                else if (e.key === "Enter" && active) { e.preventDefault(); onSelect(active); }
              }}
            />
            <span aria-hidden="true" className="nx-palette__count">
              {hits.length}
            </span>
          </div>

          <HazardRule className="nx-palette__rule" />

          <div className="nx-sr" role="status" aria-live="polite">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </div>

          {/* The empty message sits outside the listbox, not inside it as an
              unroled <li>. A `role="listbox"` may only contain `option` (or
              `group`) children, so the old markup produced two violations the
              moment a search missed: aria-required-children on the listbox and
              an orphaned listitem, because `role="listbox"` also stops the
              <ul> being a list. An empty listbox is perfectly valid ARIA; a
              listbox holding a stray list item is not. */}
          {hits.length === 0 && <div className="nx-palette__empty">{emptyLabel}</div>}

          <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="nx-palette__list">
            {hits.map((it, i) => (
              <li
                key={it.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === cursor}
                className="nx-palette__option"
                onMouseEnter={() => setCursor(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(it);
                }}
              >
                {it.shape && <Glyph shape={it.shape} colour={it.colour} size={10} />}
                <span className="nx-palette__label">{it.label}</span>
                {it.code && (
                  <span
                    className="nx-palette__code"
                    // The class code is tinted by the item's own category.
                    style={{ "--nx-palette-code-fg": it.colour } as CSSProperties}
                  >
                    {it.code}
                  </span>
                )}
                {renderMeta?.(it)}
              </li>
            ))}
          </ul>

          <div aria-hidden="true" className="nx-palette__hints">
            {hint.map(([k, v]) => (
              <span key={k}>
                {k} {v}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/**
 * Ranked search over a flat list, generic over the item type.
 *
 * Implements the ARIA combobox pattern: the input never loses focus and owns
 * `aria-activedescendant`, the results are a real `listbox`, and a live region
 * announces the count so the update is not silent.
 *
 * The forwarded ref resolves to the dialog surface (the element carrying
 * `role="dialog"`), matching Drawer.
 */
export const CommandPalette = forwardRef(CommandPaletteInner) as (<T extends PaletteItem = PaletteItem>(
  props: CommandPaletteProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof CommandPaletteInner>) & { displayName?: string };

(CommandPalette as { displayName?: string }).displayName = "CommandPalette";
