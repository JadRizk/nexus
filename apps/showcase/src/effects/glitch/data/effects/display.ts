import { COMMON } from "../../shaders/common.js";
import type { EffectOf } from "../types.js";

export const DISPLAY_EFFECTS = [
  {
    id: "interlace",
    group: "DISPLAY",
    label: "INTERLACE COMB",
    note: "Two fields captured 1/60s apart and woven together, so anything moving grows comb teeth. Offsetting odd lines in time — not just in space — is what separates this from a scanline overlay.",
    params: [["offset", 0, 0.04, 0.008]],
    frag: `${COMMON}
uniform float u_offset;
void main(){
  float odd = mod(floor(vUv.y * uRes.y), 2.0);
  float dir = sin(uTime * 6.0);
  vec2 uv = vUv + vec2(odd * u_offset * dir * uAmt, 0.0);
  gl_FragColor = vec4(texture2D(uTex, uv).rgb, 1.0);
}`,
  },
  {
    id: "roll",
    group: "DISPLAY",
    label: "VERTICAL ROLL",
    note: "Vertical sync lost: the picture slides and the blanking interval becomes visible as a dark bar. The bar is the important part — a roll without it is just a scroll.",
    params: [
      ["speed", -1.5, 1.5, 0.22],
      ["bar", 0, 0.2, 0.05],
    ],
    frag: `${COMMON}
uniform float u_speed, u_bar;
void main(){
  float amt = uAmt * (1.0 + uBurst * 2.0);
  float off = uTime * u_speed * amt;
  vec2 uv = vec2(vUv.x, fract(vUv.y + off));
  vec3 c = texture2D(uTex, uv).rgb;
  float d = abs(fract(vUv.y + off) - 0.0);
  float inBar = smoothstep(u_bar, 0.0, min(d, 1.0 - d));
  c = mix(c, vec3(0.01), inBar * amt);
  c += vec3(0.10, 0.13, 0.07) * smoothstep(u_bar * 1.6, u_bar, min(d, 1.0 - d)) * amt * 0.5;
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "holo",
    group: "DISPLAY",
    label: "HOLOGRAM",
    note: "Not an analogue artifact — a synthetic one. Horizontal scan bands travelling upward, a brightness flicker, and an edge lift that fakes Fresnel. The travelling direction matters: downward reads as a screen, upward reads as a projection.",
    params: [
      ["bands", 40, 500, 160],
      ["lift", 0, 2, 0.7],
      ["flicker", 0, 1, 0.3],
    ],
    frag: `${COMMON}
uniform float u_bands, u_lift, u_flicker;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float band = 0.5 + 0.5 * sin((vUv.y * u_bands - uTime * 2.2) * 6.2831);
  float fl = 1.0 - u_flicker * step(0.86, h1(floor(uTime * 20.0))) * 0.55;

  // edge lift: local contrast pushed toward cyan, faking a Fresnel rim
  vec3 n = texture2D(uTex, vUv + vec2(0.0, 2.0 / uRes.y)).rgb;
  float edge = clamp(length(c - n) * 6.0, 0.0, 1.0);

  vec3 o = c * (0.72 + 0.5 * band) * fl;
  o += vec3(0.09, 0.89, 0.90) * edge * u_lift;
  o += vec3(0.05, 0.35, 0.38) * band * 0.10;
  gl_FragColor = vec4(mix(c, o, uAmt), 1.0);
}`,
  },
  {
    id: "feedback",
    group: "DISPLAY",
    label: "FEEDBACK TUNNEL",
    note: "A camera pointed at its own monitor. Each frame is composited with a scaled and rotated copy of the last, so detail spirals inward forever. Keep decay under ~0.9 or it saturates to white in about a second.",
    params: [
      ["zoom", 0.9, 1.1, 1.012],
      ["rot", -0.05, 0.05, 0.004],
      ["decay", 0, 0.95, 0.72],
    ],
    extra: ["uPrev"],
    frag: `${COMMON}
uniform sampler2D uPrev;
uniform float u_zoom, u_rot, u_decay;
void main(){
  vec2 p = vUv - 0.5;
  p *= u_zoom;
  float s = sin(u_rot), co = cos(u_rot);
  p = mat2(co, -s, s, co) * p;
  vec3 prev = texture2D(uPrev, p + 0.5).rgb;
  vec3 c = texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(max(c, prev * u_decay * uAmt), 1.0);
}`,
  },
] as const satisfies readonly EffectOf<"DISPLAY">[];
