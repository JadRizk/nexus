import { describe, expect, it } from "vitest";
import { rankItems } from "./rankItems.js";
import type { PaletteItem } from "./rankItems.js";

const ITEMS: PaletteItem[] = [
  { id: 1, label: "tidal_aperture", code: "NDE" },
  { id: 2, label: "atlas_prime", code: "ATL" },
  { id: 3, label: "tide", code: "NDE" },
  { id: 4, label: "vector_null", code: "VEC", weight: 5 },
  { id: 5, label: "vector_atlas", code: "VEC", weight: 1 },
];

describe("rankItems", () => {
  it("returns everything, highest weight first, on an empty query", () => {
    const hits = rankItems(ITEMS, "");
    expect(hits).toHaveLength(ITEMS.length);
    expect(hits[0]!.id).toBe(4); // weight 5 beats weight 1 among equal (zero) text scores
  });

  it("ranks an exact match above a prefix match above a contains match", () => {
    const order: PaletteItem[] = [
      { id: 1, label: "riptide" },   // contains "tide", not at the start
      { id: 2, label: "tidewater" }, // starts with "tide"
      { id: 3, label: "tide" },      // exact
    ];
    expect(rankItems(order, "tide").map((h) => h.id)).toEqual([3, 2, 1]);
  });

  it("is not fuzzy — a scrambled substring does not match", () => {
    expect(rankItems(ITEMS, "edit")).toHaveLength(0); // no item contains "edit"
  });

  it("falls back to the class code when no label matches at all", () => {
    // "nde" appears in no label above, only in the NDE code
    const hits = rankItems(ITEMS, "nde");
    expect(hits.map((h) => h.id).sort()).toEqual([1, 3]);
  });

  it("respects the limit parameter", () => {
    expect(rankItems(ITEMS, "", 2)).toHaveLength(2);
  });
});
