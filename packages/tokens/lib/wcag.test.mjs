import { describe, expect, it } from "vitest";
import { contrastRatio, luminance, parseHex, ratio2 } from "./wcag.mjs";

/* ============================================================================
   The token build now computes every contrast figure in the system from these
   three functions, and fails the build on an AA regression. That makes them
   the load-bearing maths behind the design system's central accessibility
   claim, so they are checked against the values WCAG itself specifies rather
   than against whatever the implementation happens to produce.
   ========================================================================== */

describe("parseHex", () => {
  it("reads six-digit hex", () => {
    expect(parseHex("#FF8A1E")).toEqual([255, 138, 30]);
  });

  it("expands three-digit shorthand", () => {
    expect(parseHex("#FFF")).toEqual([255, 255, 255]);
    expect(parseHex("#0A0")).toEqual([0, 170, 0]);
  });

  it("is case-insensitive and tolerates a missing hash", () => {
    expect(parseHex("ff8a1e")).toEqual(parseHex("#FF8A1E"));
  });

  it("rejects anything it cannot measure rather than guessing", () => {
    // A ratio against a translucent colour is undefined without knowing what
    // is behind it — silently treating rgba() as opaque would produce a
    // confident wrong number, which is worse than no number.
    expect(() => parseHex("rgba(0,0,0,.5)")).toThrow();
    expect(() => parseHex("#12345")).toThrow();
  });
});

describe("luminance", () => {
  // The two anchors defined by the specification itself.
  it("is 1 for white and 0 for black", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(luminance("#000000")).toBeCloseTo(0, 10);
  });

  it("puts the transfer curve's knee where WCAG 2.2 puts it, at 0.04045", () => {
    // 0.03928 (WCAG 2.0's text) and 0.04045 (WCAG 2.2's) only disagree for a
    // channel between 10.0 and 10.3 out of 255, and no 8-bit channel lands
    // there — so #0A is linear and #0B is on the curve under either number.
    // Asserted so that using the current figure stays a deliberate choice
    // rather than something a future copy-paste quietly reverts.
    const linear = (v) => v / 255 / 12.92;
    expect(luminance("#0A0A0A")).toBeCloseTo(linear(10), 12);
    expect(luminance("#0B0B0B")).toBeCloseTo(((11 / 255 + 0.055) / 1.055) ** 2.4, 12);
  });

  it("applies the sRGB transfer curve, not a linear one", () => {
    // Mid grey is ~21.6% luminance, not 50% — getting this wrong is the
    // classic contrast-maths bug and it inflates every dark-theme ratio.
    expect(luminance("#808080")).toBeCloseTo(0.2159, 3);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white — the maximum the scale allows", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 6);
  });

  it("is 1:1 for a colour against itself", () => {
    expect(contrastRatio("#C6F135", "#C6F135")).toBeCloseTo(1, 10);
  });

  it("is symmetric — order of arguments cannot change the answer", () => {
    expect(contrastRatio("#DFF5C7", "#0A0C0B")).toBeCloseTo(
      contrastRatio("#0A0C0B", "#DFF5C7"),
      10,
    );
  });

  it("matches the published ratio for a known pair", () => {
    // #767676 on white is the canonical "exactly passes AA body text" grey.
    expect(ratio2("#767676", "#FFFFFF")).toBe(4.54);
  });
});

describe("the ratios this system ships", () => {
  const SURFACE = "#0A0C0B";

  it("reproduces the figures the design was solved against", () => {
    // These were hand-measured when the ramp was designed. The build now
    // derives them instead; this test is what proves the derivation agrees
    // with the original solve rather than quietly replacing it.
    expect(ratio2("#DFF5C7", SURFACE)).toBe(16.84); // phosphor
    expect(ratio2("#C6F135", SURFACE)).toBe(14.98); // acid
    expect(ratio2("#FF2E63", SURFACE)).toBe(5.44); // alarm
    expect(ratio2("#6B7F61", SURFACE)).toBe(4.52); // grey-300 as first solved
    expect(ratio2("#53624B", SURFACE)).toBe(3.01); // grey-200 as first solved
    expect(ratio2("#8DA084", SURFACE)).toBe(7); // grey-500, solved to exactly AAA
  });

  it("reproduces the figures for the two steps re-solved against the raised surface", () => {
    // grey-300 and grey-200 no longer hold the values above: solved to exactly
    // their floors against the panel, they came in at 4.25:1 and 2.83:1 on
    // --nx-bg-raised (#11150F), which is where Drawer draws them. The two
    // lines above stay as the original hand-measured anchor for the maths;
    // these are what ships.
    const RAISED = "#11150F";
    expect(ratio2("#6F8465", SURFACE)).toBe(4.82); // grey-300, AA text floor
    expect(ratio2("#6F8465", RAISED)).toBe(4.54);
    expect(ratio2("#57664F", SURFACE)).toBe(3.19); // grey-200, 1.4.11 floor
    expect(ratio2("#57664F", RAISED)).toBe(3);
  });
});
