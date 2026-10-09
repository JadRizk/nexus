import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARC_BOW,
  EDGE_ATTRS,
  EDGE_FS,
  EDGE_VS,
  MAX_ARC_BOW,
  PAD_FS,
  PAD_VS,
  ROUTE_ETCHED,
  encodeGain,
  encodeRouting,
} from "./shaders.js";

/**
 * `iP0.y` carries two things at once: which route an edge takes, and — for an
 * arc — which side it bows to. The shader dispatches on it, so these tests
 * mirror that dispatch exactly. Any change to one has to be made in both.
 */
const dispatch = (v: number): "etched" | "arc" | "straight" =>
  v < -900 ? "etched" : Math.abs(v) > 0.001 ? "arc" : "straight";

describe("routing is encoded into a single float without the modes colliding", () => {
  it("round-trips each routing back to itself", () => {
    expect(dispatch(encodeRouting("etched", 0))).toBe("etched");
    expect(dispatch(encodeRouting("arc", DEFAULT_ARC_BOW))).toBe("arc");
    expect(dispatch(encodeRouting("straight", 0))).toBe("straight");
  });

  it("an arc bowed to either side is still an arc", () => {
    // The regression this exists for: GraphCanvas alternates the bow's sign so
    // adjacent arcs don't overlap, and an earlier encoding marked `etched`
    // with a plain -1. Every odd-indexed arc got a negative bow and was
    // silently drawn as an etched trace — half of every semantic edge.
    for (const side of [1, -1]) {
      expect(dispatch(encodeRouting("arc", DEFAULT_ARC_BOW * side))).toBe("arc");
    }
  });

  it("no bow an arc can request can reach the etched sentinel", () => {
    for (const bow of [MAX_ARC_BOW, -MAX_ARC_BOW, 10, -10, -999, -1e9]) {
      expect(dispatch(encodeRouting("arc", bow))).toBe("arc");
    }
    expect(Math.abs(ROUTE_ETCHED)).toBeGreaterThan(MAX_ARC_BOW * 100);
  });

  it("an absent routing falls back to straight, ignoring any bow", () => {
    expect(dispatch(encodeRouting(undefined, 0.9))).toBe("straight");
  });
});

describe("gain and direction share one float", () => {
  // The shaders read abs() for the weight and step(0, x) for direction.
  const decode = (v: number) => ({ gain: Math.abs(v), directed: v >= 0 });

  it("round-trips gain and direction together", () => {
    for (const gain of [0.45, 1, 1.2, 3]) {
      for (const directed of [true, false]) {
        expect(decode(encodeGain(gain, directed))).toEqual({ gain, directed });
      }
    }
  });

  it("treats a negative gain as its magnitude rather than flipping direction", () => {
    expect(decode(encodeGain(-0.8, true))).toEqual({ gain: 0.8, directed: true });
  });

  it("keeps a zero-gain directed edge directed", () => {
    expect(decode(encodeGain(0, true)).directed).toBe(true);
  });
});

describe("program budgets", () => {
  // WebGL1 guarantees 8 vertex attributes and 8 varying vectors. A program
  // over either fails to LINK and draws nothing, with no error on screen.
  const count = (src: string, kind: "attribute" | "varying") =>
    src
      .split("\n")
      .filter((l) => l.trim().startsWith(kind))
      .flatMap((l) =>
        l
          .replace(/^\s*\w+\s+\w+\s+/, "")
          .replace(/;.*$/, "")
          .split(","),
      )
      .map((n) => n.trim())
      .filter(Boolean).length;

  it.each([
    ["EDGE_VS", EDGE_VS],
    ["PAD_VS", PAD_VS],
  ])("%s stays within the WebGL1 attribute and varying minimums", (_name, src) => {
    expect(count(src, "attribute")).toBeLessThanOrEqual(8);
    expect(count(src, "varying")).toBeLessThanOrEqual(8);
  });

  it("every per-edge attribute fits one vec4 slot", () => {
    for (const size of Object.values(EDGE_ATTRS)) {
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(4);
    }
  });

  it("declares the per-edge attributes with the sizes EDGE_ATTRS states", () => {
    for (const src of [EDGE_VS, PAD_VS]) expect(src).toMatch(/attribute vec4 iP0, iP1, iP2;/);
  });
});

describe("direction cue", () => {
  it("PAD_VS reads direction from the gain's sign and the weight from its magnitude", () => {
    expect(PAD_VS).toContain("abs(iP0.w)");
    expect(PAD_VS).toContain("step(0.0, iP0.w)");
  });

  it("PAD_FS cuts the bracket's interior, and only for a bracket", () => {
    expect(PAD_FS).toMatch(/if \(vPad\.z > 0\.0 &&[^)]*\)[^;]*discard;/);
  });

  it("EDGE_VS reads the weight with abs(), so an undirected edge isn't drawn negative", () => {
    expect(EDGE_VS).toContain("iGain = abs(iP0.w)");
  });

  it("EDGE_FS freezes the signal layer's clock under reduced motion", () => {
    expect(EDGE_FS).toContain("tSig = uTime * (1.0 - uReduced)");
    // Packets and sync marks both run on it, not on the raw clock.
    expect(EDGE_FS).not.toMatch(/fract\(uTime\*uFlowSpeed/);
    expect(EDGE_FS).not.toMatch(/vLenPx - uTime\*/);
  });
});
