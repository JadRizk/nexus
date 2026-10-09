import { COMMON } from "../../shaders/common.js";
import type { EffectOf } from "../types.js";

export const SIGNAL_EFFECTS = [
  {
    id: "chroma",
    group: "SIGNAL",
    label: "CHROMA BLEED",
    note: "NTSC gives chroma roughly a third of luma's bandwidth, so colour smears horizontally while detail stays sharp. Done properly: convert to YIQ, blur only I and Q, convert back. Blurring RGB instead just looks out of focus.",
    params: [
      ["width", 0, 24, 9],
      ["lag", -6, 12, 4],
    ],
    frag: `${COMMON}
uniform float u_width, u_lag;
const mat3 RGB2YIQ = mat3(0.299,0.596,0.211, 0.587,-0.274,-0.523, 0.114,-0.322,0.312);
const mat3 YIQ2RGB = mat3(1.0,1.0,1.0, 0.956,-0.272,-1.106, 0.621,-0.647,1.703);
void main(){
  vec3 yiq = RGB2YIQ * texture2D(uTex, vUv).rgb;
  vec2 acc = vec2(0.0); float wsum = 0.0;
  for (int i = 0; i < 13; i++){
    float o = float(i) - 6.0;
    float w = exp(-o*o / 12.0);
    vec2 s = vec2((o * u_width + u_lag) / uRes.x, 0.0);
    vec3 t = RGB2YIQ * texture2D(uTex, vUv - s).rgb;
    acc += t.yz * w; wsum += w;
  }
  vec3 bled = vec3(yiq.x, mix(yiq.yz, acc / wsum, uAmt));
  gl_FragColor = vec4(clamp(YIQ2RGB * bled, 0.0, 1.0), 1.0);
}`,
  },
  {
    id: "dotcrawl",
    group: "SIGNAL",
    label: "DOT CRAWL",
    note: "The checkerboard shimmer along colour edges. The chroma subcarrier gets misread as luma, and it CRAWLS because subcarrier phase inverts every frame. Gate it on chroma gradient — dot crawl on a flat area is a bug, not an artifact.",
    params: [
      ["freq", 40, 400, 180],
      ["gain", 0, 1, 0.45],
    ],
    frag: `${COMMON}
uniform float u_freq, u_gain;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  vec3 r = texture2D(uTex, vUv + vec2(2.0/uRes.x, 0.0)).rgb;
  // chroma gradient: how much colour changes, ignoring brightness
  float edge = length((c - vec3(luma(c))) - (r - vec3(luma(r))));
  float phase = floor(uTime * 30.0);
  float pat = sin(vUv.x * u_freq * 6.2831 + phase * 3.14159)
            * sin(vUv.y * uRes.y * 3.14159 + phase * 3.14159);
  c += vec3(pat) * edge * u_gain * uAmt * 2.4;
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "ghost",
    group: "SIGNAL",
    label: "MULTIPATH GHOST",
    note: "An antenna receives the signal twice — once direct, once bounced off a building — and the reflection arrives late, so it lands to the RIGHT of the original, attenuated. Two taps read as a city; one reads as a mistake.",
    params: [
      ["delay", 0.002, 0.12, 0.028],
      ["decay", 0, 1, 0.45],
    ],
    frag: `${COMMON}
uniform float u_delay, u_decay;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  vec3 g1 = texture2D(uTex, vUv - vec2(u_delay, 0.0)).rgb;
  vec3 g2 = texture2D(uTex, vUv - vec2(u_delay * 2.3, 0.0)).rgb;
  c += (g1 * u_decay + g2 * u_decay * 0.42) * uAmt;
  gl_FragColor = vec4(c, 1.0);
}`,
  },
  {
    id: "jitter",
    group: "SIGNAL",
    label: "SYNC JITTER",
    note: "Unstable horizontal sync: each scanline starts a fraction early or late, so vertical edges go ragged. Correlate the noise slightly down the frame or it looks like static rather than a timing fault.",
    params: [
      ["amp", 0, 0.05, 0.006],
      ["rate", 1, 90, 26],
    ],
    frag: `${COMMON}
uniform float u_amp, u_rate;
void main(){
  float line = floor(vUv.y * uRes.y);
  float t = floor(uTime * u_rate);
  float n = h2(vec2(line, t)) * 0.7 + h2(vec2(line * 0.25, t)) * 0.3;
  float amt = uAmt * (1.0 + uBurst * 4.0);
  vec2 uv = vUv + vec2((n - 0.5) * u_amp * amt, 0.0);
  gl_FragColor = vec4(texture2D(uTex, uv).rgb, 1.0);
}`,
  },
] as const satisfies readonly EffectOf<"SIGNAL">[];
