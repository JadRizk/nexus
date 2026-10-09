/**
 * The cursor a navigation key asks for, or `undefined` if `key` doesn't move
 * it. `cursor` is the current, clamped cursor; `count` is the number of results.
 *
 * ArrowDown with no results returns -1, and the clamp in `usePaletteSearch`
 * doesn't lift that back to 0 (#91).
 */
export function nextCursor(key: string, cursor: number, count: number): number | undefined {
  switch (key) {
    case "ArrowDown":
      return Math.min(count - 1, cursor + 1);
    case "ArrowUp":
      return Math.max(0, cursor - 1);
    case "Home":
      return 0;
    case "End":
      return Math.max(0, count - 1);
    default:
      return undefined;
  }
}
