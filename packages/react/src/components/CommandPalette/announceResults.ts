import type { CommandPaletteProps } from "./CommandPalette.js";

/** The live-region text for `count` results, per `CommandPaletteProps.resultsLabel`. */
export function announceResults(
  count: number,
  resultsLabel?: CommandPaletteProps["resultsLabel"],
): string {
  if (typeof resultsLabel === "function") return resultsLabel(count);
  if (typeof resultsLabel === "string") return resultsLabel;
  return `${count} result${count === 1 ? "" : "s"}`;
}
