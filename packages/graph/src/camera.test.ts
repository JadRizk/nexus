import { describe, expect, it } from "vitest";
import { crtFwd, crtInv, glyphRadiusPx, project, unproject } from "./camera.js";

describe("crtFwd / crtInv", () => {
  it("is the identity when curve is 0", () => {
    expect(crtFwd(0.4, -0.3, 0)).toEqual([0.4, -0.3]);
    expect(crtInv(0.4, -0.3, 0)).toEqual([0.4, -0.3]);
  });

  it("crtInv approximately inverts crtFwd for interior points", () => {
    const c = 0.6;
    for (const [nx, ny] of [[0.3, 0.2], [-0.5, 0.4], [0.1, -0.7], [0, 0]] as const) {
      const [wx, wy] = crtFwd(nx, ny, c);
      const [rx, ry] = crtInv(wx, wy, c);
      expect(Math.abs(rx - nx)).toBeLessThan(0.01);
      expect(Math.abs(ry - ny)).toBeLessThan(0.01);
    }
  });
});

describe("project / unproject", () => {
  const viewport = { width: 800, height: 600, curve: 0.5 };

  it("round-trips world -> screen -> world", () => {
    const zoom = 1.4, cx = 12, cy = -8;
    for (const [wx, wy] of [[0, 0], [50, -30], [-120, 90]] as const) {
      const [sx, sy] = project(wx, wy, zoom, cx, cy, viewport);
      const back = unproject(sx, sy, zoom, cx, cy, viewport);
      expect(Math.abs(back.x - wx)).toBeLessThan(0.5);
      expect(Math.abs(back.y - wy)).toBeLessThan(0.5);
    }
  });

  it("maps the camera centre to the screen centre regardless of curve", () => {
    const [sx, sy] = project(10, 20, 2, 10, 20, viewport);
    expect(sx).toBeCloseTo(viewport.width / 2);
    expect(sy).toBeCloseTo(viewport.height / 2);
  });

  it("skips the barrel warp entirely when curve is 0", () => {
    const flat = { ...viewport, curve: 0 };
    const [sx, sy] = project(100, 0, 1, 0, 0, flat);
    expect(sx).toBeCloseTo(flat.width / 2 + 100);
    expect(sy).toBeCloseTo(flat.height / 2);
  });

  it("reuses the provided output tuple instead of allocating", () => {
    const out: [number, number] = [0, 0];
    const result = project(10, 10, 1, 0, 0, { ...viewport, curve: 0 }, out);
    expect(result).toBe(out);
  });
});

describe("glyphRadiusPx", () => {
  it("scales with zoom", () => {
    expect(glyphRadiusPx(10, 1)).toBeCloseTo(10 * 0.912);
    expect(glyphRadiusPx(10, 2)).toBeCloseTo(20 * 0.912);
  });

  it("clamps to a minimum on-screen size when zoomed far out", () => {
    expect(glyphRadiusPx(10, 0.01)).toBeCloseTo(2.2 * 0.912);
  });
});
