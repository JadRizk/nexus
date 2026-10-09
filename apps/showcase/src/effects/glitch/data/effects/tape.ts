import { COMMON } from "../../shaders/common.js";
import type { EffectDef } from "../types.js";

export const TAPE_EFFECTS = [
  {
    id: "dropout",
    group: "TAPE",
    label: "TAPE DROPOUT",
    note: "Short bright dashes where the head loses contact with the oxide. Real dropout is horizontal, one to three scanlines tall, and biased white because the AGC over-corrects for the missing signal.",
    params: [
      ["rate", 0, 1, 0.35],
      ["len", 0.005, 0.12, 0.04],
    ],
    frag: `${COMMON}
uniform float u_rate, u_len;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float line = floor(vUv.y * uRes.y / 2.0);
  float t = floor(uTime * 18.0);
  float hit = h2(vec2(line, t));
  float amt = uAmt * (1.0 + uBurst * 2.0);
  if (hit > 1.0 - u_rate * 0.10 * amt) {
    float start = h2(vec2(line + 3.0, t));
    float len = u_len * (0.4 + h2(vec2(line + 9.0, t)));
    if (vUv.x > start && vUv.x < start + len) {
      float w = h2(vec2(vUv.x * 400.0, line));
      c = mix(c, vec3(0.85 + 0.15 * w), 0.92);
    }
  }
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "tracking",
    group: "TAPE",
    label: "TRACKING BAND",
    note: "Azimuth misalignment: a band of the tape reads at the wrong angle, so it loses high-frequency detail and shifts horizontally. The band drifts vertically because the error is periodic with head rotation.",
    params: [
      ["height", 0.02, 0.4, 0.12],
      ["shift", 0, 0.15, 0.04],
      ["speed", -1, 1, 0.18],
    ],
    frag: `${COMMON}
uniform float u_height, u_shift, u_speed;
void main(){
  vec2 uv = vUv;
  float band = fract(uv.y + uTime * u_speed);
  float inBand = smoothstep(u_height, u_height * 0.35, abs(band - 0.5) * 2.0 - (1.0 - u_height));
  inBand = smoothstep(0.0, 1.0, inBand);
  float amt = uAmt * (1.0 + uBurst);
  float n = h2(vec2(floor(uv.y * uRes.y), floor(uTime * 24.0)));
  uv.x += (n - 0.5) * u_shift * inBand * amt;
  vec3 c = texture2D(uTex, uv).rgb;
  // the band loses HF: mix toward a horizontally smeared copy
  vec3 soft = vec3(0.0);
  for (int i = -3; i <= 3; i++) soft += texture2D(uTex, uv + vec2(float(i) * 3.0 / uRes.x, 0.0)).rgb;
  soft /= 7.0;
  c = mix(c, soft, inBand * amt * 0.8);
  c += vec3(n * 0.16) * inBand * amt;
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "headswitch",
    group: "TAPE",
    label: "HEAD SWITCH",
    note: "The signature VHS tell. The video head physically swaps mid-field, so the bottom ~6 scanlines of EVERY frame are displaced and noisy. It is a constant, not a random glitch — which is exactly why it reads as tape rather than as an effect.",
    params: [
      ["lines", 2, 24, 7],
      ["skew", 0, 0.2, 0.06],
    ],
    frag: `${COMMON}
uniform float u_lines, u_skew;
void main(){
  vec2 uv = vUv;
  float px = (1.0 - uv.y) * uRes.y;         // scanlines up from the bottom
  float k = 1.0 - clamp(px / u_lines, 0.0, 1.0);
  vec3 c;
  if (k > 0.0) {
    float wob = h2(vec2(floor(px), floor(uTime * 30.0)));
    uv.x += (u_skew * k * uAmt) + (wob - 0.5) * 0.02 * k * uAmt;
    c = texture2D(uTex, uv).rgb;
    c = mix(c, vec3(h2(uv * 700.0 + uTime)), k * 0.55 * uAmt);
  } else {
    c = texture2D(uTex, uv).rgb;
  }
  gl_FragColor = vec4(c, 1.0);
}`,
  },
] as const satisfies readonly EffectDef[];
