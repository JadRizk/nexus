import { COMMON } from "../../shaders/common.js";
import type { EffectOf } from "../types.js";

export const DIGITAL_EFFECTS = [
  {
    id: "blocks",
    group: "DIGITAL",
    label: "DATAMOSH",
    note: "Corrupted motion vectors: macroblocks get told to copy from the wrong place. Snap displacement to the block grid — smooth offsets look like a warp, and codecs do not warp.",
    params: [
      ["size", 4, 96, 26],
      ["rate", 0, 1, 0.18],
      ["push", 0, 0.4, 0.09],
    ],
    frag: `${COMMON}
uniform float u_size, u_rate, u_push;
void main(){
  vec2 grid = floor(vUv * uRes / u_size);
  float t = floor(uTime * 8.0);
  float hit = h2(grid + t * 1.7);
  vec2 uv = vUv;
  float amt = uAmt * (1.0 + uBurst * 3.0);
  if (hit > 1.0 - u_rate * amt) {
    vec2 dir = vec2(h2(grid + 5.0) - 0.5, h2(grid + 11.0) - 0.5);
    // snap to the block grid: codecs displace in whole blocks
    uv += floor(dir * u_push * uRes / u_size) * u_size / uRes;
  }
  vec3 c = texture2D(uTex, uv).rgb;
  if (hit > 1.0 - u_rate * amt * 0.35) {
    c.rb = c.br;                                  // channel swap on the worst
  }
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "crush",
    group: "DIGITAL",
    label: "BITCRUSH",
    note: "Posterise with a 4×4 Bayer matrix rather than rounding. Ordered dithering is what makes low bit depth read as a limited display instead of as a broken gradient — the same reason it looked right on a Game Boy.",
    params: [
      ["bits", 1, 8, 3],
      ["dither", 0, 1, 0.8],
    ],
    frag: `${COMMON}
uniform float u_bits, u_dither;
float bayer(vec2 p){
  vec2 f = floor(mod(p, 4.0));
  float i = f.y * 4.0 + f.x;
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  float v = 0.0;
  for (int k = 0; k < 16; k++) if (float(k) == i) v = m[k];
  return v / 16.0 - 0.5;
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float levels = pow(2.0, floor(u_bits));
  vec3 d = c + bayer(gl_FragCoord.xy) * u_dither / levels;
  vec3 q = floor(d * levels + 0.5) / levels;
  gl_FragColor = vec4(mix(c, clamp(q, 0.0, 1.0), uAmt), 1.0);
}`,
  },
  {
    id: "streak",
    group: "DIGITAL",
    label: "LUMA STREAK",
    note: "Bright pixels drag horizontally until something brighter interrupts them. A cheap cousin of pixel sorting — a true sort needs a full row in registers, which a fragment shader does not have, but the read is close and it costs one march.",
    params: [
      ["thresh", 0, 1, 0.55],
      ["reach", 4, 160, 60],
    ],
    frag: `${COMMON}
uniform float u_thresh, u_reach;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  vec3 best = c;
  float bl = luma(c);
  for (int i = 1; i <= 40; i++){
    float o = float(i) * u_reach / 40.0 / uRes.x;
    if (vUv.x - o < 0.0) break;
    vec3 s = texture2D(uTex, vUv - vec2(o, 0.0)).rgb;
    float sl = luma(s);
    if (sl < u_thresh) break;            // the run ends at the first dark pixel
    if (sl > bl) { bl = sl; best = s; }
  }
  gl_FragColor = vec4(mix(c, best, uAmt), 1.0);
}`,
  },
] as const satisfies readonly EffectOf<"DIGITAL">[];
