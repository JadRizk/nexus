import { useCallback, useEffect, useRef } from "react";

/* ============================================================================
   GLITCH ENGINE
   Glitch Lab's signal path, apart from its UI: the source and effect shaders,
   the event bus (keyframed faults), the presets, and the WebGL render loop as
   a hook. Glitch Lab drives every knob of it; Home's hero drives a few. One
   copy, so the two can never drift apart.

   The pipeline is ordered as a real signal path — see GlitchLab.jsx:

     SOURCE → TAPE → COMPOSITE SIGNAL → DIGITAL → DISPLAY → GLASS
   ========================================================================== */

/* ------------------------------------------------------------------ source */
export const SRC_FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform int uMode;
// Offsets every hash that places the graph, so each seed is a new layout.
// 0 is the layout Glitch Lab has always shown.
uniform float uSeed;
varying vec2 vUv;

float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

float seg(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h);
}

vec3 graph(vec2 uv){
  vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;
  vec3 col = vec3(0.012, 0.016, 0.014);

  // parallax grid floor
  float g = 0.0;
  vec2 q = p * 6.0;
  g += smoothstep(0.045, 0.0, abs(fract(q.x)-0.5)-0.47);
  g += smoothstep(0.045, 0.0, abs(fract(q.y)-0.5)-0.47);
  col += vec3(0.10,0.13,0.06) * g * 0.10;

  // 22 nodes on a hashed lattice, breathing
  for (int i = 0; i < 22; i++){
    float fi = float(i);
    float k = fi + uSeed;
    vec2 c = vec2(h1(k*1.7)*2.0-1.0, h1(k*3.1+7.0)*2.0-1.0) * 1.35;
    c += 0.06*vec2(sin(uTime*0.4+fi), cos(uTime*0.33+fi*1.7));
    float r = 0.030 + 0.020*h1(k*5.3);
    r *= 1.0 + 0.09*sin(uTime*1.4 + fi*2.0);
    float d = length(p - c);

    vec3 tint = fi < 3.0 ? vec3(0.78,0.95,0.21)      // acid  — atlases
              : fi < 6.0 ? vec3(1.0,0.18,0.39)        // alarm — unresolved
              : fi < 10.0 ? vec3(1.0,0.54,0.12)       // sodium — sources
              : vec3(0.09,0.89,0.90);                 // data — nodes

    col += tint * smoothstep(r, r*0.55, d) * 0.55;                    // core
    col += tint * smoothstep(r*1.28, r*1.05, d) * smoothstep(r*0.98, r*1.2, d) * 2.2; // rim
    col += tint * pow(max(0.0, 1.0 - d/(r*7.0)), 4.0) * 0.30;         // halo

    // one link per node, so there is real edge detail for artifacts to chew on
    float k2 = mod(fi*7.0+3.0,22.0) + uSeed;
    vec2 c2 = vec2(h1(k2*1.7)*2.0-1.0,
                   h1(k2*3.1+7.0)*2.0-1.0) * 1.35;
    float ld = seg(p, c, c2);
    float pkt = exp(-pow((fract(dot(p-c, normalize(c2-c))/length(c2-c) - uTime*0.25 + h1(k))-0.5)*13.0, 2.0));
    col += vec3(0.14,0.55,0.62) * smoothstep(0.006, 0.0, ld) * 0.9;
    col += vec3(0.6,1.0,1.0) * smoothstep(0.004, 0.0, ld) * pkt * 1.4;
  }
  return col;
}

vec3 bars(vec2 uv){
  // SMPTE-ish bars over a zone plate. The fine radial detail is what makes
  // chroma bleed and dot crawl legible — flat colour hides both.
  vec3 c;
  float x = uv.x;
  if (uv.y > 0.34) {
    if (x < 0.143) c = vec3(0.75);
    else if (x < 0.286) c = vec3(0.75,0.75,0.0);
    else if (x < 0.429) c = vec3(0.0,0.75,0.75);
    else if (x < 0.571) c = vec3(0.0,0.75,0.0);
    else if (x < 0.714) c = vec3(0.75,0.0,0.75);
    else if (x < 0.857) c = vec3(0.75,0.0,0.0);
    else c = vec3(0.0,0.0,0.75);
  } else if (uv.y > 0.24) {
    c = vec3(0.0,0.0,0.75) * step(0.5, fract(x*7.0));
    c += vec3(0.75,0.0,0.0) * step(0.5, fract(x*7.0+0.5));
  } else {
    vec2 p = (uv - vec2(0.5,0.12)) * vec2(uRes.x/uRes.y, 1.0);
    float zp = 0.5 + 0.5*sin(dot(p,p) * 900.0);
    c = vec3(zp);
    c *= smoothstep(0.42, 0.10, length(p));
    c += vec3(0.78,0.95,0.21) * step(0.985, fract(uv.x*12.0 - uTime*0.4)) * 0.6;
  }
  return c;
}

vec3 console_(vec2 uv){
  vec3 col = vec3(0.012,0.016,0.014);
  // stacked HUD rows: high-contrast rectangles and hairlines
  for (int r = 0; r < 14; r++){
    float fr = float(r);
    float y0 = 0.06 + fr*0.064;
    if (uv.y > y0 && uv.y < y0+0.030) {
      float w = 0.12 + h1(fr)*0.55;
      float scroll = fract(uTime*0.05 + h1(fr*3.0));
      if (uv.x > 0.06 && uv.x < 0.06+w) {
        float cells = step(0.35, fract((uv.x-0.06)*90.0));
        vec3 tint = h1(fr*9.0) > 0.82 ? vec3(1.0,0.18,0.39) : vec3(0.78,0.95,0.21);
        col += tint * cells * (0.35 + 0.65*step(scroll, (uv.x-0.06)/w));
      }
      if (uv.x > 0.68 && uv.x < 0.94) {
        col += vec3(0.09,0.89,0.90) * step(0.5, fract(uv.x*120.0)) * 0.5;
      }
    }
    if (abs(uv.y - (y0+0.046)) < 0.0012) col += vec3(0.10,0.14,0.08);
  }
  return col;
}

void main(){
  vec2 uv = vUv;
  vec3 col = uMode == 0 ? graph(uv) : uMode == 1 ? bars(uv) : console_(uv);
  gl_FragColor = vec4(col, 1.0);
}`;

/* =========================================================================
   EFFECTS
   Each is one fragment shader plus its parameter descriptors. `uAmt` is the
   master mix for the effect; `uBurst` is a transient envelope shared by the
   destructive ones so a single event can hit several stages at once.
   ========================================================================= */
export const COMMON = `
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uAmt, uBurst;
varying vec2 vUv;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
`;

export const EFFECTS = [
  /* -------------------------------------------------------------- TAPE -- */
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

  /* ---------------------------------------------------------- COMPOSITE -- */
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

  /* ------------------------------------------------------------ DIGITAL -- */
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

  /* ------------------------------------------------------------ DISPLAY -- */
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

  /* -------------------------------------------------------------- GLASS -- */
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
];

/* ============================================================================
   EVENTS
   A transient glitch lives or dies on its envelope, not its effects. Three
   rules the keyframes below all follow:

   1. Attack is near-instant — one or two frames. Anything slower reads as an
      animation rather than a fault.
   2. Sustain is jagged and non-monotonic. A real signal fights to recover, so
      it partially comes back and fails again. `chaos` adds per-frame dropouts
      on top of the curve.
   3. Effects inside one event are correlated but OFFSET. Perfectly
      synchronised ramps look synthetic; a 40ms stagger looks causal.

   Digital faults use "step" keys (hold, then jump) because codecs quantise.
   Analogue faults interpolate. That single distinction is most of what makes
   DATA CORRUPT feel different from SIGNAL LOSS.

   Track modes:
     max — take the greater of the resting value and the event value (for mix)
     set — override the resting value outright
     add — offset the resting value
   ========================================================================== */

export const EVENTS = [
  {
    id: "dropout",
    label: "DROPOUT",
    key: "1",
    dur: 0.22,
    chaos: 0.35,
    cause:
      "A flaw in the oxide passes under the head. Signal is gone for a few scanlines, the AGC over-corrects, and colour drops out before luma does.",
    tracks: [
      {
        fx: "dropout",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.03, 1, "step"],
          [0.55, 0.7],
          [1, 0],
        ],
      },
      {
        fx: "dropout",
        param: "rate",
        mode: "set",
        keys: [
          [0, 0.9],
          [1, 0.5],
        ],
      },
      {
        fx: "tracking",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.1, 0.8],
          [0.7, 0.2],
          [1, 0],
        ],
      },
      // chroma dies before luma — colour loss is the tell
      {
        fx: "chroma",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.06, 1, "step"],
          [0.8, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "chroma",
        param: "width",
        mode: "set",
        keys: [
          [0, 22],
          [1, 9],
        ],
      },
    ],
  },
  {
    id: "signal",
    label: "SIGNAL LOSS",
    key: "2",
    dur: 0.95,
    chaos: 0.5,
    cause:
      "The antenna gets knocked. Vertical sync goes first, the picture rolls, multipath ghosting doubles up, and it wobbles back rather than snapping back.",
    tracks: [
      {
        fx: "roll",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.04, 1],
          [0.45, 0.9],
          [0.75, 0.35],
          [1, 0],
        ],
      },
      {
        fx: "roll",
        param: "speed",
        mode: "set",
        keys: [
          [0, 1.3],
          [0.5, 0.6],
          [1, 0.1],
        ],
      },
      {
        fx: "jitter",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.02, 1],
          [0.6, 0.55],
          [1, 0],
        ],
      },
      {
        fx: "jitter",
        param: "amp",
        mode: "set",
        keys: [
          [0, 0.03],
          [1, 0.004],
        ],
      },
      // ghost arrives late — offset from the sync failure, not simultaneous
      {
        fx: "ghost",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.12, 0],
          [0.2, 0.9],
          [0.85, 0.3],
          [1, 0],
        ],
      },
      {
        fx: "crt",
        param: "grain",
        mode: "add",
        keys: [
          [0, 0],
          [0.1, 0.9],
          [0.7, 0.35],
          [1, 0],
        ],
      },
    ],
  },
  {
    id: "corrupt",
    label: "DATA CORRUPT",
    key: "3",
    dur: 0.38,
    chaos: 0.2,
    cause:
      "Packet loss. Motion vectors point at garbage, so macroblocks copy from the wrong place and hold there until the next keyframe. Everything steps — codecs quantise, they do not ease.",
    tracks: [
      {
        fx: "blocks",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.02, 1, "step"],
          [0.45, 1, "step"],
          [0.75, 0.6, "step"],
          [1, 0, "step"],
        ],
      },
      {
        fx: "blocks",
        param: "rate",
        mode: "set",
        keys: [
          [0, 0.7],
          [0.5, 0.45, "step"],
          [1, 0.2, "step"],
        ],
      },
      {
        fx: "blocks",
        param: "push",
        mode: "set",
        keys: [
          [0, 0.26],
          [1, 0.08, "step"],
        ],
      },
      {
        fx: "streak",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.14, 0.8, "step"],
          [0.7, 0.4, "step"],
          [1, 0, "step"],
        ],
      },
      {
        fx: "crush",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.08, 0.9, "step"],
          [0.6, 0.5, "step"],
          [1, 0, "step"],
        ],
      },
      {
        fx: "crush",
        param: "bits",
        mode: "set",
        keys: [
          [0, 2],
          [1, 5, "step"],
        ],
      },
    ],
  },
  {
    id: "crash",
    label: "HEAD CRASH",
    key: "4",
    dur: 0.55,
    chaos: 0.8,
    cause:
      "Mechanical failure. Everything at once, with the head-switch region swelling from six scanlines to most of the frame. The chaos term is high, so it stutters rather than fades.",
    tracks: [
      {
        fx: "headswitch",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.02, 1, "step"],
          [0.6, 0.8],
          [1, 0],
        ],
      },
      {
        fx: "headswitch",
        param: "lines",
        mode: "set",
        keys: [
          [0, 90],
          [0.5, 40],
          [1, 7],
        ],
      },
      {
        fx: "headswitch",
        param: "skew",
        mode: "set",
        keys: [
          [0, 0.18],
          [1, 0.06],
        ],
      },
      {
        fx: "tracking",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.05, 1],
          [0.7, 0.5],
          [1, 0],
        ],
      },
      {
        fx: "tracking",
        param: "shift",
        mode: "set",
        keys: [
          [0, 0.13],
          [1, 0.04],
        ],
      },
      {
        fx: "jitter",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.03, 1],
          [0.8, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "dropout",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.06, 1],
          [0.75, 0.5],
          [1, 0],
        ],
      },
      {
        fx: "blocks",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.1, 0.7, "step"],
          [0.6, 0.3, "step"],
          [1, 0, "step"],
        ],
      },
    ],
  },
  {
    id: "degauss",
    label: "DEGAUSS",
    key: "5",
    dur: 1.2,
    chaos: 0.05,
    cause:
      "The degauss coil fires on power-up. Purely smooth — a magnetic field settling, not a signal failing. No chaos, no stepping, sine decay.",
    tracks: [
      {
        fx: "chroma",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.06, 1],
          [0.5, 0.6],
          [1, 0],
        ],
      },
      {
        fx: "chroma",
        param: "width",
        mode: "set",
        keys: [
          [0, 24],
          [0.5, 14],
          [1, 9],
        ],
      },
      {
        fx: "chroma",
        param: "lag",
        mode: "set",
        keys: [
          [0, 11],
          [0.4, -5],
          [0.7, 6],
          [1, 4],
        ],
      },
      {
        fx: "crt",
        param: "aberr",
        mode: "add",
        keys: [
          [0, 0],
          [0.08, 3.2],
          [0.4, 1.2],
          [0.65, 2.0],
          [1, 0],
        ],
      },
      {
        fx: "crt",
        param: "curve",
        mode: "add",
        keys: [
          [0, 0],
          [0.12, 0.5],
          [0.5, 0.15],
          [1, 0],
        ],
      },
      {
        fx: "holo",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.15, 0.35],
          [0.6, 0.15],
          [1, 0],
        ],
      },
    ],
  },
  {
    id: "scrub",
    label: "SCRUB",
    key: "6",
    dur: 0.7,
    chaos: 0.3,
    cause:
      "Shuttle search. The tape moves faster than playback speed, so the tracking band sweeps through rapidly and the head-switch point wanders up the frame.",
    tracks: [
      {
        fx: "tracking",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.05, 1],
          [0.85, 0.9],
          [1, 0],
        ],
      },
      {
        fx: "tracking",
        param: "speed",
        mode: "set",
        keys: [
          [0, 1.4],
          [0.6, 0.9],
          [1, 0.18],
        ],
      },
      {
        fx: "tracking",
        param: "height",
        mode: "set",
        keys: [
          [0, 0.3],
          [1, 0.12],
        ],
      },
      {
        fx: "headswitch",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.08, 0.9],
          [0.85, 0.5],
          [1, 0],
        ],
      },
      {
        fx: "headswitch",
        param: "lines",
        mode: "set",
        keys: [
          [0, 26],
          [1, 7],
        ],
      },
      {
        fx: "interlace",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.1, 0.8],
          [0.9, 0.3],
          [1, 0],
        ],
      },
    ],
  },
  {
    id: "interference",
    label: "INTERFERENCE",
    key: "7",
    dur: 2.0,
    chaos: 0.15,
    cause:
      "Something periodic nearby — a motor, a transmitter. Low amplitude, long duration, and it pulses rather than decays. The kind of fault you live with rather than notice.",
    tracks: [
      {
        fx: "ghost",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.1, 0.5],
          [0.3, 0.15],
          [0.5, 0.6],
          [0.7, 0.2],
          [0.9, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "ghost",
        param: "delay",
        mode: "set",
        keys: [
          [0, 0.02],
          [0.5, 0.06],
          [1, 0.03],
        ],
      },
      {
        fx: "jitter",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.15, 0.35],
          [0.55, 0.2],
          [0.8, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "dotcrawl",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0],
          [0.2, 0.8],
          [1, 0],
        ],
      },
    ],
  },
  {
    id: "boot",
    label: "COLD BOOT",
    key: "8",
    dur: 1.5,
    chaos: 0.25,
    cause:
      "Power-on. Sync has not locked yet so the picture rolls, then catches. Useful as a route transition — the screen is genuinely arriving rather than fading in.",
    tracks: [
      {
        fx: "roll",
        param: "amt",
        mode: "max",
        keys: [
          [0, 1],
          [0.35, 0.9],
          [0.6, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "roll",
        param: "speed",
        mode: "set",
        keys: [
          [0, 1.5],
          [0.5, 0.5],
          [1, 0.05],
        ],
      },
      {
        fx: "roll",
        param: "bar",
        mode: "set",
        keys: [
          [0, 0.16],
          [1, 0.04],
        ],
      },
      {
        fx: "crush",
        param: "amt",
        mode: "max",
        keys: [
          [0, 1],
          [0.25, 0.6, "step"],
          [0.5, 0, "step"],
          [1, 0, "step"],
        ],
      },
      {
        fx: "crush",
        param: "bits",
        mode: "set",
        keys: [
          [0, 1],
          [0.4, 4, "step"],
          [1, 8, "step"],
        ],
      },
      {
        fx: "jitter",
        param: "amt",
        mode: "max",
        keys: [
          [0, 0.9],
          [0.4, 0.4],
          [1, 0],
        ],
      },
      {
        fx: "crt",
        param: "grain",
        mode: "add",
        keys: [
          [0, 1.0],
          [0.5, 0.3],
          [1, 0],
        ],
      },
      {
        fx: "crt",
        param: "scan",
        mode: "add",
        keys: [
          [0, 0.4],
          [0.6, 0.1],
          [1, 0],
        ],
      },
    ],
  },
];

/* Chains: an event is one fault, a chain is a failure cascading. The delays
   are what sell it — a second fault landing while the first is still decaying
   reads as a system coming apart, not as two effects. */
export const CHAINS = [
  {
    id: "cascade",
    label: "CASCADE",
    steps: [
      [0, "dropout"],
      [0.12, "corrupt"],
      [0.34, "signal"],
    ],
  },
  {
    id: "collapse",
    label: "COLLAPSE",
    steps: [
      [0, "corrupt"],
      [0.08, "crash"],
      [0.5, "signal"],
      [1.1, "boot"],
    ],
  },
  {
    id: "wake",
    label: "WAKE",
    steps: [
      [0, "boot"],
      [0.9, "degauss"],
    ],
  },
  {
    id: "hunt",
    label: "HUNT",
    steps: [
      [0, "scrub"],
      [0.3, "dropout"],
      [0.55, "scrub"],
      [0.9, "interference"],
    ],
  },
];

export const EV_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Sample a keyframe track. A "step" key holds the previous value, then jumps. */
export function sampleKeys(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i],
      k0 = keys[i - 1];
    if (u <= k1[0]) {
      if (k1[2] === "step") return k0[1];
      const t = (u - k0[0]) / Math.max(1e-6, k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * t;
    }
  }
  return keys[keys.length - 1][1];
}

export const hashf = (n) => {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
};

/**
 * The chaos term. Quantised to ~24Hz so it stutters like frames dropping
 * rather than shimmering like noise, and it only ever *reduces* the envelope —
 * a fault that randomly gets stronger than its own peak feels wrong.
 */
export function chaosEnv(u, chaos, seed) {
  if (chaos <= 0) return 1;
  const f = Math.floor(u * 24);
  const n = hashf(f * 7.13 + seed * 31.7);
  const dip = n > 0.72 ? 1 - chaos * (0.35 + 0.65 * hashf(f * 3.1 + seed)) : 1;
  return dip;
}
/* ------------------------------------------------------------- base presets */
export const PRESETS = {
  CLEAN: { crt: { on: 1, amt: 0.35, curve: 0.3, scan: 0.3, aberr: 0.4, grain: 0.15 } },
  "VHS 1987": {
    chroma: { on: 1, amt: 0.85, width: 11, lag: 5 },
    dotcrawl: { on: 1, amt: 0.6, freq: 190, gain: 0.5 },
    headswitch: { on: 1, amt: 1, lines: 8, skew: 0.07 },
    crt: { on: 1, amt: 0.9, curve: 0.6, scan: 0.55, aberr: 0.8, grain: 0.5 },
  },
  BROADCAST: {
    chroma: { on: 1, amt: 0.5, width: 7, lag: 3 },
    ghost: { on: 1, amt: 0.35, delay: 0.022, decay: 0.35 },
    crt: { on: 1, amt: 0.85, curve: 0.5, scan: 0.5, aberr: 1.0, grain: 0.4 },
  },
  HOLOTABLE: {
    holo: { on: 1, amt: 0.9, bands: 200, lift: 1.0, flicker: 0.35 },
    chroma: { on: 1, amt: 0.4, width: 6, lag: 3 },
    interlace: { on: 1, amt: 0.5, offset: 0.004 },
    crt: { on: 1, amt: 0.7, curve: 0.35, scan: 0.35, aberr: 1.8, grain: 0.25 },
  },
  TERMINAL: {
    crush: { on: 1, amt: 0.6, bits: 3, dither: 0.85 },
    crt: { on: 1, amt: 1, curve: 0.8, scan: 0.7, aberr: 0.6, grain: 0.55 },
  },
};

/* ================================================================== WebGL */
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "shader compile failed");
  }
  return s;
}
const VS = `
attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export function program(gl, frag) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, VS);
  const f = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) || "link failed");
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}
function makeRT(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb };
}

/**
 * A full effect config: every effect at its parameter defaults (only the CRT
 * on), with the named preset applied over it. A fresh object each call.
 *
 * @param {string} preset A key of PRESETS.
 * @returns {Record<string, Record<string, number>>} Effect id → its knobs.
 */
export function configFor(preset) {
  const cfg = {};
  for (const e of EFFECTS) {
    cfg[e.id] = { on: e.id === "crt" ? 1 : 0, amt: 1 };
    for (const [k, , , d] of e.params) cfg[e.id][k] = d;
  }
  for (const [k, v] of Object.entries(PRESETS[preset])) Object.assign(cfg[k], v);
  return cfg;
}

/**
 * Starts the event `id` on an engine's event bus (its `activeRef`), now.
 *
 * @returns The event's definition, or undefined for an unknown id.
 */
export function fireEvent(activeRef, id) {
  const def = EV_BY_ID[id];
  if (def)
    activeRef.current.push({ def, t0: performance.now() / 1000, seed: Math.random() * 1000 });
  return def;
}

/** Gives the graph source a new layout: a fresh seed in `seedRef`, never 0. */
export function shuffleSeed(seedRef) {
  seedRef.current = 1 + Math.floor(Math.random() * 997);
}

// The clock a still frame is drawn at, so it is the same frame every time.
const STILL_TIME = 2.5;

/**
 * Runs the pipeline into a canvas appended to `hostRef.current`. Everything
 * the loop reads is a ref, so it is current as of the last commit without
 * re-arming the loop. Required: cfgRef (effect config, as Glitch Lab builds
 * it), srcRef (source index), activeRef and queueRef (the event bus). Optional:
 * autoRef/rateRef (auto-fire), audioRef, stillRef (true: draw one frame per
 * invalidate() instead of looping — for reduced motion), seedRef (the graph
 * source's layout seed; see shuffleSeed).
 *
 * Options: onError/onLive/onFps callbacks; maxFps (0 = every display frame)
 * and maxDpr, for a small screen that should not cost what Glitch Lab does.
 *
 * Returns `invalidate`, which draws a frame now; needed only for stills.
 *
 * @param {{ current: HTMLElement | null }} hostRef
 * @param {Record<string, { current: any }>} refs
 * @param {{
 *   onError?: (message: string) => void,
 *   onLive?: (running: Array<{ id: string, label: string, u: number }>) => void,
 *   onFps?: (fps: number) => void,
 *   maxFps?: number,
 *   maxDpr?: number,
 * }} [options]
 * @returns {() => void}
 */
export function useGlitchEngine(
  hostRef,
  refs,
  { onError, onLive, onFps, maxFps = 0, maxDpr = 1.5 } = {},
) {
  const none = useRef(null);
  const { cfgRef, srcRef, activeRef, queueRef } = refs;
  const autoRef = refs.autoRef ?? none;
  const rateRef = refs.rateRef ?? none;
  const audioRef = refs.audioRef ?? none;
  const stillRef = refs.stillRef ?? none;
  const seedRef = refs.seedRef ?? none;
  const callbacks = useRef({ onError, onLive, onFps });
  useEffect(() => {
    callbacks.current = { onError, onLive, onFps };
  });
  const invalidate = useRef(() => {});
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(canvas);
    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) {
      callbacks.current.onError?.("WebGL unavailable in this context.");
      return undefined;
    }

    let progs,
      srcProg,
      copyProg,
      quad,
      rtA,
      rtB,
      feed0,
      feed1,
      raf = 0;
    try {
      srcProg = program(gl, SRC_FS);
      copyProg = program(
        gl,
        `${COMMON}\nvoid main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }`,
      );
      progs = {};
      for (const e of EFFECTS) progs[e.id] = program(gl, e.frag);
    } catch (e) {
      callbacks.current.onError?.(String(e.message || e));
      return undefined;
    }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    let W = 1,
      H = 1;
    const dpr = Math.min(window.devicePixelRatio, maxDpr);
    const minGap = maxFps > 0 ? 1000 / maxFps - 1 : 0;
    let lastDraw = -Infinity;
    const resize = () => {
      W = Math.max(2, Math.floor(host.clientWidth * dpr));
      H = Math.max(2, Math.floor(host.clientHeight * dpr));
      canvas.width = W;
      canvas.height = H;
      [rtA, rtB, feed0, feed1].forEach((rt) => {
        if (!rt) return;
        gl.deleteTexture(rt.tex);
        gl.deleteFramebuffer(rt.fb);
      });
      rtA = makeRT(gl, W, H);
      rtB = makeRT(gl, W, H);
      feed0 = makeRT(gl, W, H);
      feed1 = makeRT(gl, W, H);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      invalidate.current();
    });
    ro.observe(host);

    const bind = (prog) => {
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      return (n) => gl.getUniformLocation(prog, n);
    };

    let t0 = performance.now(),
      fAcc = 0,
      fN = 0,
      fT = 0,
      nextAuto = 2,
      liveT = 0;

    const frame = (now) => {
      // A still renders one frame per invalidate() rather than looping.
      const still = !!stillRef.current;
      if (!still) raf = requestAnimationFrame(frame);
      // Under a frame cap, skip display frames until the gap has passed.
      if (!still && now - lastDraw < minGap) return;
      lastDraw = now;
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const time = still ? STILL_TIME : now / 1000;
      const base = cfgRef.current;

      /* ---- event bus -------------------------------------------------- */
      for (let i = queueRef.current.length - 1; i >= 0; i--) {
        if (queueRef.current[i].at <= time) {
          const { id } = queueRef.current.splice(i, 1)[0];
          const def = EV_BY_ID[id];
          if (def) {
            activeRef.current.push({ def, t0: time, seed: Math.random() * 1000 });
            audioRef.current?.fire(id);
          }
        }
      }
      if (autoRef.current) {
        nextAuto -= dt;
        if (nextAuto <= 0) {
          const e = EVENTS[(Math.random() * EVENTS.length) | 0];
          activeRef.current.push({ def: e, t0: time, seed: Math.random() * 1000 });
          audioRef.current?.fire(e.id);
          nextAuto = 0.4 + (1 - rateRef.current) * 7 + Math.random() * 2;
        }
      }

      // Resolve every active event into a per-effect override layer. Multiple
      // events stack: `max` takes the strongest, `add` accumulates.
      const ov = {};
      const running = [];
      for (let i = activeRef.current.length - 1; i >= 0; i--) {
        const ev = activeRef.current[i];
        const u = (time - ev.t0) / ev.def.dur;
        if (u >= 1) {
          activeRef.current.splice(i, 1);
          continue;
        }
        if (u < 0) continue;
        const env = chaosEnv(u, ev.def.chaos, ev.seed);
        running.push({ id: ev.def.id, label: ev.def.label, u });
        for (const tr of ev.def.tracks) {
          const raw = sampleKeys(tr.keys, u);
          const v = tr.param === "amt" ? raw * env : raw;
          const slot = (ov[tr.fx] ||= {});
          if (tr.mode === "max") slot[tr.param] = Math.max(slot[tr.param] ?? 0, v);
          else if (tr.mode === "add") slot[tr.param] = (slot[tr.param] ?? 0) + v;
          else slot[tr.param] = v;
        }
      }
      liveT += dt;
      if (liveT > 0.05) {
        liveT = 0;
        callbacks.current.onLive?.(running);
      }

      /* ---- render ----------------------------------------------------- */
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, rtA.fb);
      let u = bind(srcProg);
      gl.uniform2f(u("uRes"), W, H);
      gl.uniform1f(u("uTime"), time);
      gl.uniform1i(u("uMode"), srcRef.current);
      gl.uniform1f(u("uSeed"), seedRef.current ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      let src = rtA,
        dst = rtB;

      for (const e of EFFECTS) {
        const b = base[e.id];
        const o = ov[e.id];
        const restAmt = b.on ? b.amt : 0;
        const amt = o?.amt !== undefined ? Math.max(restAmt, o.amt) : restAmt;
        if (amt <= 0.001) continue;

        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        u = bind(progs[e.id]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(u("uTex"), 0);
        if (e.id === "feedback") {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, feed0.tex);
          gl.uniform1i(u("uPrev"), 1);
        }
        gl.uniform2f(u("uRes"), W, H);
        gl.uniform1f(u("uTime"), time);
        gl.uniform1f(u("uAmt"), amt);
        gl.uniform1f(u("uBurst"), 0);
        for (const [k, lo, hi] of e.params) {
          let v = b[k];
          if (o && o[k] !== undefined) v = o[k];
          gl.uniform1f(u(`u_${k}`), Math.min(hi, Math.max(lo, v)));
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (e.id === "feedback") {
          gl.bindFramebuffer(gl.FRAMEBUFFER, feed1.fb);
          const cu = bind(copyProg);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dst.tex);
          gl.uniform1i(cu("uTex"), 0);
          gl.uniform2f(cu("uRes"), W, H);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          const t = feed0;
          feed0 = feed1;
          feed1 = t;
        }
        const t = src;
        src = dst;
        dst = t;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      u = bind(copyProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(u("uTex"), 0);
      gl.uniform2f(u("uRes"), W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      fAcc += 1 / Math.max(dt, 1e-4);
      fN++;
      fT += dt;
      if (fT > 0.5) {
        callbacks.current.onFps?.(Math.round(fAcc / fN));
        fAcc = 0;
        fN = 0;
        fT = 0;
      }
    };
    raf = requestAnimationFrame(frame);
    invalidate.current = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    return () => {
      invalidate.current = () => {};
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    };
    // Refs only, all stable: the loop is armed once per mount.
  }, [
    hostRef,
    cfgRef,
    srcRef,
    activeRef,
    queueRef,
    autoRef,
    rateRef,
    audioRef,
    stillRef,
    seedRef,
    maxFps,
    maxDpr,
  ]);

  return useCallback(() => invalidate.current(), []);
}
