import { forwardRef, useId } from "react";
import type { CSSProperties, ForwardedRef, ReactNode } from "react";
import { Panel } from "../Panel/index.js";
import { HazardRule } from "../HazardRule/index.js";
import { Glyph } from "../Glyph/index.js";
import { useFocusTrap } from "../../hooks/index.js";
import type { PaletteItem } from "../../search/index.js";
import { mergeRefs } from "../../refs.js";
import { announceResults } from "./announceResults.js";
import { nextCursor } from "./cursor.js";
import { useFocusOnOpen } from "./useFocusOnOpen.js";
import { usePaletteSearch } from "./usePaletteSearch.js";
import { useScrollActiveIntoView } from "./useScrollActiveIntoView.js";

export interface CommandPaletteProps<T extends PaletteItem = PaletteItem> {
  open: boolean;
  onClose: () => void;
  items: readonly T[];
  onSelect: (item: T) => void;
  placeholder?: string;
  /**
   * Accessible name for the dialog itself, separate from the input's
   * placeholder. Defaults to `placeholder`, so the dialog's name is
   * unchanged unless this is set explicitly.
   */
  label?: string;
  /**
   * The live-region announcement made as results change. A string is
   * announced verbatim; a function receives the result count and formats
   * its own text. Default: `` `${count} result${count === 1 ? "" : "s"}` ``.
   */
  resultsLabel?: string | ((count: number) => string);
  emptyLabel?: string;
  hint?: readonly (readonly [string, string])[];
  /** Extra content on the right of a result row, e.g. a degree count. */
  renderMeta?: (item: T) => ReactNode;
  width?: number;
}

interface PaletteOptionProps<T extends PaletteItem> {
  item: T;
  id: string;
  isActive: boolean;
  onHover: () => void;
  onChoose: (item: T) => void;
  renderMeta: ((item: T) => ReactNode) | undefined;
}

function PaletteOption<T extends PaletteItem>({
  item,
  id,
  isActive,
  onHover,
  onChoose,
  renderMeta,
}: PaletteOptionProps<T>) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={isActive}
      className="nx-palette__option"
      onMouseEnter={onHover}
      onMouseDown={(e) => {
        e.preventDefault();
        onChoose(item);
      }}
    >
      {item.shape && <Glyph shape={item.shape} colour={item.colour} size={10} />}
      <span className="nx-palette__label">{item.label}</span>
      {item.code && (
        <span
          className="nx-palette__code"
          // The class code is tinted by the item's own category.
          style={{ "--nx-palette-code-fg": item.colour } as CSSProperties}
        >
          {item.code}
        </span>
      )}
      {renderMeta?.(item)}
    </li>
  );
}

function PaletteHints({ hint }: { hint: NonNullable<CommandPaletteProps["hint"]> }) {
  return (
    <div aria-hidden="true" className="nx-palette__hints">
      {hint.map(([key, action]) => (
        <span key={key}>
          {key} {action}
        </span>
      ))}
    </div>
  );
}

// forwardRef's type isn't generic, so the component is written as a plain
// generic function and cast back to a generic signature below (compile-time only).
function CommandPaletteInner<T extends PaletteItem = PaletteItem>(
  {
    open,
    onClose,
    items,
    onSelect,
    placeholder = "SEARCH",
    label,
    resultsLabel,
    emptyLabel = "NO MATCH",
    hint = [
      ["↑↓", "MOVE"],
      ["↵", "SELECT"],
      ["ESC", "CLOSE"],
    ] as const,
    renderMeta,
    width = 520,
  }: CommandPaletteProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { query, setQuery, hits, cursor, setCursor } = usePaletteSearch(open, items);
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const inputRef = useFocusOnOpen<HTMLInputElement>(open);
  const listRef = useScrollActiveIntoView(cursor);
  const listId = useId();

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
        // The focus trap and the consumer each need a handle on this node.
        ref={mergeRefs(trapRef, ref)}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? placeholder}
        tabIndex={-1}
        className="nx-palette"
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
                const requested = nextCursor(e.key, cursor, hits.length);
                if (requested !== undefined) {
                  e.preventDefault();
                  setCursor(requested);
                } else if (e.key === "Enter" && active) {
                  e.preventDefault();
                  onSelect(active);
                }
              }}
            />
            <span aria-hidden="true" className="nx-palette__count">
              {hits.length}
            </span>
          </div>

          <HazardRule className="nx-palette__rule" />

          <div className="nx-sr" role="status" aria-live="polite">
            {announceResults(hits.length, resultsLabel)}
          </div>

          {/* Outside the listbox: a listbox may only contain options or groups. */}
          {hits.length === 0 && <div className="nx-palette__empty">{emptyLabel}</div>}

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="nx-palette__list"
          >
            {hits.map((item, i) => (
              <PaletteOption
                key={item.id}
                item={item}
                id={`${listId}-${i}`}
                isActive={i === cursor}
                onHover={() => setCursor(i)}
                onChoose={onSelect}
                renderMeta={renderMeta}
              />
            ))}
          </ul>

          <PaletteHints hint={hint} />
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
export const CommandPalette = forwardRef(CommandPaletteInner) as (<
  T extends PaletteItem = PaletteItem,
>(
  props: CommandPaletteProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof CommandPaletteInner>) & { displayName?: string };

(CommandPalette as { displayName?: string }).displayName = "CommandPalette";
