import { COMMON } from "../../shaders/common.js";
import type { EffectOf } from "../types.js";

export const GLASS_EFFECTS = [
  {
    id: "crt",
    group: "GLASS",
    label: "CRT COMPOSITE",
    note: "The tube itself: barrel curvature with a hard black beyond the edge (overscan scales the bent picture out to fill the frame instead), chromatic aberration scaling toward the corners, scanlines, an RGB aperture grille on a 3px cycle, a rolling refresh bar, grain and vignette.",
    params: [
      ["curve", 0, 1.6, 0.5],
      ["scan", 0, 1, 0.5],
      ["aberr", 0, 4, 1.0],
      ["grain", 0, 1.5, 0.4],
      ["overscan", 0, 1, 0],
    ],
    frag: `${COMMON}
uniform float u_curve, u_scan, u_aberr, u_grain, u_overscan;
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
  uv += uv * off * off * u_curve;
  // Overscan: scale the bent raster back out until its corners reach the
  // frame — the furthest each axis bends is 1 + curve/36 (x) and 1 + curve/25
  // (y), at the corners. Lines still bow; nothing beyond the edge shows.
  uv /= mix(vec2(1.0), 1.0 + u_curve / vec2(36.0, 25.0), u_overscan);
  uv = uv * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;
  }
  float ab = u_aberr * (0.0012 + 0.0055 * length(uv - 0.5));
  vec3 c;
  c.r = texture2D(uTex, uv + vec2(ab, 0.0)).r;
  c.g = texture2D(uTex, uv).g;
  c.b = texture2D(uTex, uv - vec2(ab, 0.0)).b;

  float sl = sin(uv.y * uRes.y * 1.6) * 0.5 + 0.5;
  c *= 1.0 - u_scan * 0.24 * sl;
  float ag = mod(gl_FragCoord.x, 3.0);
  vec3 grille = vec3(ag < 1.0 ? 1.10 : 0.91,
                     (ag >= 1.0 && ag < 2.0) ? 1.10 : 0.91,
                     ag >= 2.0 ? 1.10 : 0.91);
  c *= mix(vec3(1.0), grille, u_scan * 0.5);

  float roll = fract(uv.y - uTime * 0.08);
  c += vec3(0.09, 0.12, 0.06) * pow(max(0.0, 1.0 - abs(roll - 0.5) * 2.0), 24.0) * u_scan;
  c += (h2(uv * uRes + floor(uTime * 24.0)) - 0.5) * u_grain * 0.11;
  vec2 d = uv - 0.5;
  c *= 1.0 - dot(d, d) * 0.78;
  gl_FragColor = vec4(mix(texture2D(uTex, vUv).rgb, c, uAmt), 1.0);
}`,
  },
] as const satisfies readonly EffectOf<"GLASS">[];
