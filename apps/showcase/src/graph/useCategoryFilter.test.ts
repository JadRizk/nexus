import { describe, expect, it } from "vitest";
import { allShown, hiddenCategories, withCategoryShown } from "./useCategoryFilter.js";

const IDS = ["paper", "person", "venue"] as const;

describe("allShown", () => {
  it("shows every category", () => {
    expect(allShown(IDS)).toEqual({ paper: true, person: true, venue: true });
  });
});

describe("hiddenCategories", () => {
  it("is empty when everything is shown", () => {
    expect(hiddenCategories(IDS, allShown(IDS))).toEqual([]);
  });

  it("lists the categories turned off, in taxonomy order", () => {
    expect(hiddenCategories(IDS, { paper: false, person: true, venue: false })).toEqual([
      "paper",
      "venue",
    ]);
  });

  it("treats a category missing from the record as hidden", () => {
    expect(hiddenCategories(IDS, { paper: true, person: true })).toEqual(["venue"]);
  });
});

describe("withCategoryShown", () => {
  it("turns one category off and back on without touching the rest", () => {
    const off = withCategoryShown(allShown(IDS), "person", false);
    expect(off).toEqual({ paper: true, person: false, venue: true });
    expect(withCategoryShown(off, "person", true)).toEqual(allShown(IDS));
  });

  it("returns a new record, so React sees the change", () => {
    const shown = allShown(IDS);
    const next = withCategoryShown(shown, "paper", false);
    expect(next).not.toBe(shown);
    expect(shown["paper"]).toBe(true);
  });
});
