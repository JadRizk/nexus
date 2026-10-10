import { describe, expect, it } from "vitest";
import { formatKnob, fpsTone, integrationSnippet } from "./format.js";

describe("formatKnob", () => {
  it("shows three decimals below 10", () => {
    expect(formatKnob(0.5)).toBe("0.500");
    expect(formatKnob(9.9994)).toBe("9.999");
    expect(formatKnob(-0.25)).toBe("-0.250");
  });

  it("shows a whole number from 10 up, either sign", () => {
    expect(formatKnob(10)).toBe("10");
    expect(formatKnob(190.6)).toBe("191");
    expect(formatKnob(-12.4)).toBe("-12");
  });
});

describe("fpsTone", () => {
  it.each([
    [60, "var(--nx-fg-accent)"],
    [51, "var(--nx-fg-accent)"],
    [50, "var(--nx-fg-warning)"],
    [29, "var(--nx-fg-warning)"],
    [28, "var(--nx-fg-critical)"],
    [0, "var(--nx-fg-critical)"],
  ])("%s fps reads as %s", (fps, tone) => {
    expect(fpsTone(fps)).toBe(tone);
  });
});

describe("integrationSnippet", () => {
  it("fires the given event on a failed request, between the fixed examples", () => {
    expect(integrationSnippet("crash")).toBe(
      [
        "// on route change",
        'glitch.fire("boot");',
        "",
        "// on failed request",
        'glitch.fire("crash");',
        "",
        "// on cascading failure",
        'glitch.chain([[0,"dropout"],',
        '  [0.12,"corrupt"],[0.34,"signal"]]);',
      ].join("\n"),
    );
  });
});
