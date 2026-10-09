import { describe, expect, it } from "vitest";
import { announceResults } from "./announceResults.js";

describe("announceResults", () => {
  it("defaults to a pluralised count", () => {
    expect(announceResults(0)).toBe("0 results");
    expect(announceResults(1)).toBe("1 result");
    expect(announceResults(2)).toBe("2 results");
  });

  it("announces a string label verbatim, whatever the count", () => {
    expect(announceResults(5, "Results updated")).toBe("Results updated");
  });

  it("passes the count to a function label", () => {
    expect(announceResults(3, (count) => `${count} matches`)).toBe("3 matches");
  });
});
