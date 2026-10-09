import { useMemo, useState } from "react";
import { rankItems } from "../../search/index.js";
import type { PaletteItem } from "../../search/index.js";

/**
 * The query, its ranked results and the active result's index. Every opening
 * starts from an empty query and the first result.
 */
export function usePaletteSearch<T extends PaletteItem>(isOpen: boolean, items: readonly T[]) {
  const [query, setQueryState] = useState("");
  // Read only through the clamp below: `items` may resize the results while open.
  const [requestedCursor, requestCursor] = useState(0);
  const [didRenderOpen, setDidRenderOpen] = useState(isOpen);

  // Reset during render, not in an effect, so a reopened palette never paints
  // a frame of the previous search.
  if (isOpen !== didRenderOpen) {
    setDidRenderOpen(isOpen);
    if (isOpen) {
      setQueryState("");
      requestCursor(0);
    }
  }

  const hits = useMemo(() => rankItems(items, query), [items, query]);
  const cursor = Math.min(requestedCursor, Math.max(0, hits.length - 1));

  const setQuery = (next: string) => {
    setQueryState(next);
    requestCursor(0);
  };

  return { query, setQuery, hits, cursor, requestCursor };
}
