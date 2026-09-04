import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel, Button, TabStrip, Slider, ToggleRow, SectionHeading, HazardRule, Wordmark,
} from "@nexus-cyberdeck/react";

/* ============================================================================
   GLITCH LAB
   A post-processing playground for the Nexus system. Raw WebGL — no three.js,
   because the whole point is to see the shaders.

   The pipeline is ordered as a real signal path, not by convenience:

     SOURCE → TAPE → COMPOSITE SIGNAL → DIGITAL → DISPLAY → GLASS

   Stacking these in the wrong order is most of why glitch effects read as
   fake. Chroma bleed applied *after* scanlines is a filter; applied before,
   it is an artifact.

   Two layers:
     RESTING STACK — what is always on. The look.
     EVENT BUS     — transient keyframed faults that override the resting
                     stack for a few hundred milliseconds, then hand it back.

   Ported from effects/GlitchLab.jsx verbatim below the CHROME marker — the
   shaders, physics of the event bus and the audio synth are untouched. Only
   the surrounding UI changed, from a second hand-rolled copy of the design
   system (its own `C` palette and `gl-*` CSS classes) to the real
   @nexus-cyberdeck/react components and @nexus-cyberdeck/tokens custom properties, so this page
   can't drift from the rest of the system the way the original standalone
   file would have.
   ========================================================================== */

/* ------------------------------------------------------------------ source */
const SRC_FS = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform int uMode;
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
    vec2 c = vec2(h1(fi*1.7)*2.0-1.0, h1(fi*3.1+7.0)*2.0-1.0) * 1.35;
    c += 0.06*vec2(sin(uTime*0.4+fi), cos(uTime*0.33+fi*1.7));
    float r = 0.030 + 0.020*h1(fi*5.3);
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
    vec2 c2 = vec2(h1(mod(fi*7.0+3.0,22.0)*1.7)*2.0-1.0,
                   h1(mod(fi*7.0+3.0,22.0)*3.1+7.0)*2.0-1.0) * 1.35;
    float ld = seg(p, c, c2);
    float pkt = exp(-pow((fract(dot(p-c, normalize(c2-c))/length(c2-c) - uTime*0.25 + h1(fi))-0.5)*13.0, 2.0));
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
const COMMON = `
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uAmt, uBurst;
varying vec2 vUv;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
`;

const EFFECTS = [
  /* -------------------------------------------------------------- TAPE -- */
  {
    id: "dropout", group: "TAPE", label: "TAPE DROPOUT",
    note: "Short bright dashes where the head loses contact with the oxide. Real dropout is horizontal, one to three scanlines tall, and biased white because the AGC over-corrects for the missing signal.",
    params: [["rate", 0, 1, 0.35], ["len", 0.005, 0.12, 0.04]],
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
    id: "tracking", group: "TAPE", label: "TRACKING BAND",
    note: "Azimuth misalignment: a band of the tape reads at the wrong angle, so it loses high-frequency detail and shifts horizontally. The band drifts vertically because the error is periodic with head rotation.",
    params: [["height", 0.02, 0.4, 0.12], ["shift", 0, 0.15, 0.04], ["speed", -1, 1, 0.18]],
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
    id: "headswitch", group: "TAPE", label: "HEAD SWITCH",
    note: "The signature VHS tell. The video head physically swaps mid-field, so the bottom ~6 scanlines of EVERY frame are displaced and noisy. It is a constant, not a random glitch — which is exactly why it reads as tape rather than as an effect.",
    params: [["lines", 2, 24, 7], ["skew", 0, 0.2, 0.06]],
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
    id: "chroma", group: "SIGNAL", label: "CHROMA BLEED",
    note: "NTSC gives chroma roughly a third of luma's bandwidth, so colour smears horizontally while detail stays sharp. Done properly: convert to YIQ, blur only I and Q, convert back. Blurring RGB instead just looks out of focus.",
    params: [["width", 0, 24, 9], ["lag", -6, 12, 4]],
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
    id: "dotcrawl", group: "SIGNAL", label: "DOT CRAWL",
    note: "The checkerboard shimmer along colour edges. The chroma subcarrier gets misread as luma, and it CRAWLS because subcarrier phase inverts every frame. Gate it on chroma gradient — dot crawl on a flat area is a bug, not an artifact.",
    params: [["freq", 40, 400, 180], ["gain", 0, 1, 0.45]],
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
    id: "ghost", group: "SIGNAL", label: "MULTIPATH GHOST",
    note: "An antenna receives the signal twice — once direct, once bounced off a building — and the reflection arrives late, so it lands to the RIGHT of the original, attenuated. Two taps read as a city; one reads as a mistake.",
    params: [["delay", 0.002, 0.12, 0.028], ["decay", 0, 1, 0.45]],
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
    id: "jitter", group: "SIGNAL", label: "SYNC JITTER",
    note: "Unstable horizontal sync: each scanline starts a fraction early or late, so vertical edges go ragged. Correlate the noise slightly down the frame or it looks like static rather than a timing fault.",
    params: [["amp", 0, 0.05, 0.006], ["rate", 1, 90, 26]],
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
    id: "blocks", group: "DIGITAL", label: "DATAMOSH",
    note: "Corrupted motion vectors: macroblocks get told to copy from the wrong place. Snap displacement to the block grid — smooth offsets look like a warp, and codecs do not warp.",
    params: [["size", 4, 96, 26], ["rate", 0, 1, 0.18], ["push", 0, 0.4, 0.09]],
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
    id: "crush", group: "DIGITAL", label: "BITCRUSH",
    note: "Posterise with a 4×4 Bayer matrix rather than rounding. Ordered dithering is what makes low bit depth read as a limited display instead of as a broken gradient — the same reason it looked right on a Game Boy.",
    params: [["bits", 1, 8, 3], ["dither", 0, 1, 0.8]],
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
    id: "streak", group: "DIGITAL", label: "LUMA STREAK",
    note: "Bright pixels drag horizontally until something brighter interrupts them. A cheap cousin of pixel sorting — a true sort needs a full row in registers, which a fragment shader does not have, but the read is close and it costs one march.",
    params: [["thresh", 0, 1, 0.55], ["reach", 4, 160, 60]],
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
    id: "interlace", group: "DISPLAY", label: "INTERLACE COMB",
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
    id: "roll", group: "DISPLAY", label: "VERTICAL ROLL",
    note: "Vertical sync lost: the picture slides and the blanking interval becomes visible as a dark bar. The bar is the important part — a roll without it is just a scroll.",
    params: [["speed", -1.5, 1.5, 0.22], ["bar", 0, 0.2, 0.05]],
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
    id: "holo", group: "DISPLAY", label: "HOLOGRAM",
    note: "Not an analogue artifact — a synthetic one. Horizontal scan bands travelling upward, a brightness flicker, and an edge lift that fakes Fresnel. The travelling direction matters: downward reads as a screen, upward reads as a projection.",
    params: [["bands", 40, 500, 160], ["lift", 0, 2, 0.7], ["flicker", 0, 1, 0.3]],
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
    id: "feedback", group: "DISPLAY", label: "FEEDBACK TUNNEL",
    note: "A camera pointed at its own monitor. Each frame is composited with a scaled and rotated copy of the last, so detail spirals inward forever. Keep decay under ~0.9 or it saturates to white in about a second.",
    params: [["zoom", 0.9, 1.1, 1.012], ["rot", -0.05, 0.05, 0.004], ["decay", 0, 0.95, 0.72]],
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
    id: "crt", group: "GLASS", label: "CRT COMPOSITE",
    note: "The tube itself: barrel curvature with a hard black beyond the edge, chromatic aberration scaling toward the corners, scanlines, an RGB aperture grille on a 3px cycle, a rolling refresh bar, grain and vignette.",
    params: [["curve", 0, 1.6, 0.5], ["scan", 0, 1, 0.5], ["aberr", 0, 4, 1.0], ["grain", 0, 1.5, 0.4]],
    frag: `${COMMON}
uniform float u_curve, u_scan, u_aberr, u_grain;
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
  uv += uv * off * off * u_curve;
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

const EVENTS = [
  {
    id: "dropout", label: "DROPOUT", key: "1", dur: 0.22, chaos: 0.35,
    cause: "A flaw in the oxide passes under the head. Signal is gone for a few scanlines, the AGC over-corrects, and colour drops out before luma does.",
    tracks: [
      { fx: "dropout", param: "amt", mode: "max", keys: [[0, 0], [0.03, 1, "step"], [0.55, 0.7], [1, 0]] },
      { fx: "dropout", param: "rate", mode: "set", keys: [[0, 0.9], [1, 0.5]] },
      { fx: "tracking", param: "amt", mode: "max", keys: [[0, 0], [0.10, 0.8], [0.7, 0.2], [1, 0]] },
      // chroma dies before luma — colour loss is the tell
      { fx: "chroma", param: "amt", mode: "max", keys: [[0, 0], [0.06, 1, "step"], [0.8, 0.4], [1, 0]] },
      { fx: "chroma", param: "width", mode: "set", keys: [[0, 22], [1, 9]] },
    ],
  },
  {
    id: "signal", label: "SIGNAL LOSS", key: "2", dur: 0.95, chaos: 0.5,
    cause: "The antenna gets knocked. Vertical sync goes first, the picture rolls, multipath ghosting doubles up, and it wobbles back rather than snapping back.",
    tracks: [
      { fx: "roll", param: "amt", mode: "max", keys: [[0, 0], [0.04, 1], [0.45, 0.9], [0.75, 0.35], [1, 0]] },
      { fx: "roll", param: "speed", mode: "set", keys: [[0, 1.3], [0.5, 0.6], [1, 0.1]] },
      { fx: "jitter", param: "amt", mode: "max", keys: [[0, 0], [0.02, 1], [0.6, 0.55], [1, 0]] },
      { fx: "jitter", param: "amp", mode: "set", keys: [[0, 0.03], [1, 0.004]] },
      // ghost arrives late — offset from the sync failure, not simultaneous
      { fx: "ghost", param: "amt", mode: "max", keys: [[0, 0], [0.12, 0], [0.20, 0.9], [0.85, 0.3], [1, 0]] },
      { fx: "crt", param: "grain", mode: "add", keys: [[0, 0], [0.1, 0.9], [0.7, 0.35], [1, 0]] },
    ],
  },
  {
    id: "corrupt", label: "DATA CORRUPT", key: "3", dur: 0.38, chaos: 0.2,
    cause: "Packet loss. Motion vectors point at garbage, so macroblocks copy from the wrong place and hold there until the next keyframe. Everything steps — codecs quantise, they do not ease.",
    tracks: [
      { fx: "blocks", param: "amt", mode: "max", keys: [[0, 0], [0.02, 1, "step"], [0.45, 1, "step"], [0.75, 0.6, "step"], [1, 0, "step"]] },
      { fx: "blocks", param: "rate", mode: "set", keys: [[0, 0.7], [0.5, 0.45, "step"], [1, 0.2, "step"]] },
      { fx: "blocks", param: "push", mode: "set", keys: [[0, 0.26], [1, 0.08, "step"]] },
      { fx: "streak", param: "amt", mode: "max", keys: [[0, 0], [0.14, 0.8, "step"], [0.7, 0.4, "step"], [1, 0, "step"]] },
      { fx: "crush", param: "amt", mode: "max", keys: [[0, 0], [0.08, 0.9, "step"], [0.6, 0.5, "step"], [1, 0, "step"]] },
      { fx: "crush", param: "bits", mode: "set", keys: [[0, 2], [1, 5, "step"]] },
    ],
  },
  {
    id: "crash", label: "HEAD CRASH", key: "4", dur: 0.55, chaos: 0.8,
    cause: "Mechanical failure. Everything at once, with the head-switch region swelling from six scanlines to most of the frame. The chaos term is high, so it stutters rather than fades.",
    tracks: [
      { fx: "headswitch", param: "amt", mode: "max", keys: [[0, 0], [0.02, 1, "step"], [0.6, 0.8], [1, 0]] },
      { fx: "headswitch", param: "lines", mode: "set", keys: [[0, 90], [0.5, 40], [1, 7]] },
      { fx: "headswitch", param: "skew", mode: "set", keys: [[0, 0.18], [1, 0.06]] },
      { fx: "tracking", param: "amt", mode: "max", keys: [[0, 0], [0.05, 1], [0.7, 0.5], [1, 0]] },
      { fx: "tracking", param: "shift", mode: "set", keys: [[0, 0.13], [1, 0.04]] },
      { fx: "jitter", param: "amt", mode: "max", keys: [[0, 0], [0.03, 1], [0.8, 0.4], [1, 0]] },
      { fx: "dropout", param: "amt", mode: "max", keys: [[0, 0], [0.06, 1], [0.75, 0.5], [1, 0]] },
      { fx: "blocks", param: "amt", mode: "max", keys: [[0, 0], [0.10, 0.7, "step"], [0.6, 0.3, "step"], [1, 0, "step"]] },
    ],
  },
  {
    id: "degauss", label: "DEGAUSS", key: "5", dur: 1.2, chaos: 0.05,
    cause: "The degauss coil fires on power-up. Purely smooth — a magnetic field settling, not a signal failing. No chaos, no stepping, sine decay.",
    tracks: [
      { fx: "chroma", param: "amt", mode: "max", keys: [[0, 0], [0.06, 1], [0.5, 0.6], [1, 0]] },
      { fx: "chroma", param: "width", mode: "set", keys: [[0, 24], [0.5, 14], [1, 9]] },
      { fx: "chroma", param: "lag", mode: "set", keys: [[0, 11], [0.4, -5], [0.7, 6], [1, 4]] },
      { fx: "crt", param: "aberr", mode: "add", keys: [[0, 0], [0.08, 3.2], [0.4, 1.2], [0.65, 2.0], [1, 0]] },
      { fx: "crt", param: "curve", mode: "add", keys: [[0, 0], [0.12, 0.5], [0.5, 0.15], [1, 0]] },
      { fx: "holo", param: "amt", mode: "max", keys: [[0, 0], [0.15, 0.35], [0.6, 0.15], [1, 0]] },
    ],
  },
  {
    id: "scrub", label: "SCRUB", key: "6", dur: 0.7, chaos: 0.3,
    cause: "Shuttle search. The tape moves faster than playback speed, so the tracking band sweeps through rapidly and the head-switch point wanders up the frame.",
    tracks: [
      { fx: "tracking", param: "amt", mode: "max", keys: [[0, 0], [0.05, 1], [0.85, 0.9], [1, 0]] },
      { fx: "tracking", param: "speed", mode: "set", keys: [[0, 1.4], [0.6, 0.9], [1, 0.18]] },
      { fx: "tracking", param: "height", mode: "set", keys: [[0, 0.30], [1, 0.12]] },
      { fx: "headswitch", param: "amt", mode: "max", keys: [[0, 0], [0.08, 0.9], [0.85, 0.5], [1, 0]] },
      { fx: "headswitch", param: "lines", mode: "set", keys: [[0, 26], [1, 7]] },
      { fx: "interlace", param: "amt", mode: "max", keys: [[0, 0], [0.1, 0.8], [0.9, 0.3], [1, 0]] },
    ],
  },
  {
    id: "interference", label: "INTERFERENCE", key: "7", dur: 2.0, chaos: 0.15,
    cause: "Something periodic nearby — a motor, a transmitter. Low amplitude, long duration, and it pulses rather than decays. The kind of fault you live with rather than notice.",
    tracks: [
      { fx: "ghost", param: "amt", mode: "max", keys: [[0, 0], [0.1, 0.5], [0.3, 0.15], [0.5, 0.6], [0.7, 0.2], [0.9, 0.4], [1, 0]] },
      { fx: "ghost", param: "delay", mode: "set", keys: [[0, 0.02], [0.5, 0.06], [1, 0.03]] },
      { fx: "jitter", param: "amt", mode: "max", keys: [[0, 0], [0.15, 0.35], [0.55, 0.2], [0.8, 0.4], [1, 0]] },
      { fx: "dotcrawl", param: "amt", mode: "max", keys: [[0, 0], [0.2, 0.8], [1, 0]] },
    ],
  },
  {
    id: "boot", label: "COLD BOOT", key: "8", dur: 1.5, chaos: 0.25,
    cause: "Power-on. Sync has not locked yet so the picture rolls, then catches. Useful as a route transition — the screen is genuinely arriving rather than fading in.",
    tracks: [
      { fx: "roll", param: "amt", mode: "max", keys: [[0, 1], [0.35, 0.9], [0.6, 0.4], [1, 0]] },
      { fx: "roll", param: "speed", mode: "set", keys: [[0, 1.5], [0.5, 0.5], [1, 0.05]] },
      { fx: "roll", param: "bar", mode: "set", keys: [[0, 0.16], [1, 0.04]] },
      { fx: "crush", param: "amt", mode: "max", keys: [[0, 1], [0.25, 0.6, "step"], [0.5, 0, "step"], [1, 0, "step"]] },
      { fx: "crush", param: "bits", mode: "set", keys: [[0, 1], [0.4, 4, "step"], [1, 8, "step"]] },
      { fx: "jitter", param: "amt", mode: "max", keys: [[0, 0.9], [0.4, 0.4], [1, 0]] },
      { fx: "crt", param: "grain", mode: "add", keys: [[0, 1.0], [0.5, 0.3], [1, 0]] },
      { fx: "crt", param: "scan", mode: "add", keys: [[0, 0.4], [0.6, 0.1], [1, 0]] },
    ],
  },
];

/* Chains: an event is one fault, a chain is a failure cascading. The delays
   are what sell it — a second fault landing while the first is still decaying
   reads as a system coming apart, not as two effects. */
const CHAINS = [
  { id: "cascade", label: "CASCADE", steps: [[0, "dropout"], [0.12, "corrupt"], [0.34, "signal"]] },
  { id: "collapse", label: "COLLAPSE", steps: [[0, "corrupt"], [0.08, "crash"], [0.5, "signal"], [1.1, "boot"]] },
  { id: "wake", label: "WAKE", steps: [[0, "boot"], [0.9, "degauss"]] },
  { id: "hunt", label: "HUNT", steps: [[0, "scrub"], [0.3, "dropout"], [0.55, "scrub"], [0.9, "interference"]] },
];

const EV_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Sample a keyframe track. A "step" key holds the previous value, then jumps. */
export function sampleKeys(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i], k0 = keys[i - 1];
    if (u <= k1[0]) {
      if (k1[2] === "step") return k0[1];
      const t = (u - k0[0]) / Math.max(1e-6, k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * t;
    }
  }
  return keys[keys.length - 1][1];
}

export const hashf = (n) => { const s = Math.sin(n) * 43758.5453123; return s - Math.floor(s); };

/**
 * The chaos term. Quantised to ~24Hz so it stutters like frames dropping
 * rather than shimmering like noise, and it only ever *reduces* the envelope —
 * a fault that randomly gets stronger than its own peak feels wrong.
 */
export function chaosEnv(u, chaos, seed) {
  if (chaos <= 0) return 1;
  const f = Math.floor(u * 24);
  const n = hashf(f * 7.13 + seed * 31.7);
  const dip = n > 0.72 ? (1 - chaos * (0.35 + 0.65 * hashf(f * 3.1 + seed))) : 1;
  return dip;
}
/* ------------------------------------------------------------- base presets */
const PRESETS = {
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

/* ============================================================================
   AUDIO — synthesised, not sampled.

   Three reasons this beats sourcing files for these particular sounds:

   1. The events already carry keyframed envelopes. A synth can read the same
      curve; a .wav cannot. The audio and the picture fail together.
   2. Repetition is the tell. Fire DROPOUT twenty times with an identical
      sample and the illusion dies. Every shot here randomises playback rate,
      filter frequency and timing.
   3. Some of it is more accurate synthesised. CRT whine is 15.734 kHz — the
      NTSC horizontal scan rate — and an oscillator hits it exactly, for zero
      bytes and zero licensing.

   Nothing starts without a user gesture: browsers block it, and autoplaying
   audio is hostile regardless.
   ========================================================================== */

const NTSC_SCAN = 15734;   // horizontal scan frequency — the CRT whine
const MAINS = 60;          // hum fundamental; use 50 outside the Americas

function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = 0.5;
  // A limiter, so stacked events cannot clip. Glitch audio has extreme crest
  // factors — an unlimited noise burst on top of a thunk will square off.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(limiter);
  limiter.connect(ctx.destination);

  // one shared noise table; re-pitched per voice so bursts never repeat
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const R = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------- primitives */
  function noise(t, dur, o = {}) {
    const {
      f0 = 2000, f1 = f0, q = 1, type = "bandpass",
      gain = 0.4, attack = 0.003, curve = "exp",
    } = o;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = R(0.7, 1.4);
    src.playbackRate.setValueAtTime(src.playbackRate.value, t);

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    if (curve === "exp") g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + dur);

    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.06);
    src.onended = () => { try { g.disconnect(); filt.disconnect(); } catch { /* noop */ } };
  }

  function tone(t, dur, o = {}) {
    const {
      f0 = 200, f1 = f0, type = "sine", gain = 0.25,
      attack = 0.004, lp = 0, q = 1,
    } = o;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(10, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);

    let node = osc;
    let filt = null;
    if (lp) {
      filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(lp, t);
      filt.Q.value = q;
      osc.connect(filt);
      node = filt;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => { try { g.disconnect(); if (filt) filt.disconnect(); } catch { /* noop */ } };
  }

  /* -------------------------------------------------- per-event voicing --
     Each one is written from the same physical story as its shader. */
  const VOICES = {
    // Oxide flaw: broadband crack, then the AGC over-corrects and hisses.
    dropout(t) {
      noise(t, 0.045, { f0: R(2600, 4200), q: 0.8, gain: 0.55, attack: 0.001 });
      noise(t + 0.012, 0.14, { f0: R(900, 1400), f1: 400, q: 2.5, gain: 0.22 });
      if (Math.random() > 0.5) noise(t + R(0.05, 0.1), 0.03, { f0: 5200, gain: 0.3 });
    },

    // Sync failure: the 60Hz field buzz detunes downward, snow swells behind it.
    signal(t) {
      tone(t, 0.55, { f0: MAINS, f1: MAINS * 0.45, type: "sawtooth", gain: 0.16, lp: 800, q: 6 });
      noise(t + 0.02, 0.85, { f0: 1200, f1: 5000, q: 0.4, type: "highpass", gain: 0.30, attack: 0.06 });
      noise(t + 0.30, 0.5, { f0: 300, q: 1.2, gain: 0.14 });
      tone(t + 0.62, 0.28, { f0: MAINS * 0.5, f1: MAINS, type: "square", gain: 0.10, lp: 500 });
    },

    // Packet loss: stepped square blips at quantised pitches. Deliberately
    // scheduled on a grid — smooth glissando would undo the whole idea.
    corrupt(t) {
      const n = 7 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const at = t + i * 0.028;
        const f = [110, 220, 330, 440, 587, 880, 1320][(Math.random() * 7) | 0];
        tone(at, 0.024, { f0: f, type: "square", gain: 0.14, attack: 0.0005 });
        if (Math.random() > 0.6) noise(at, 0.02, { f0: R(3000, 7000), gain: 0.18, attack: 0.0005 });
      }
      noise(t, 0.05, { f0: 180, q: 3, gain: 0.35, attack: 0.001 });
    },

    // Mechanical failure: a low thump, a rising shriek, and sustained tearing.
    crash(t) {
      tone(t, 0.35, { f0: 90, f1: 32, type: "sine", gain: 0.5, attack: 0.001, lp: 300 });
      noise(t, 0.42, { f0: 400, f1: 2600, q: 0.6, gain: 0.42, attack: 0.002 });
      tone(t + 0.04, 0.30, { f0: 700, f1: 4200, type: "sawtooth", gain: 0.12, lp: 5000, q: 8 });
      noise(t + 0.18, 0.30, { f0: 6000, f1: 900, q: 1.5, gain: 0.25 });
    },

    // The degauss coil: a resonant thunk. Smooth, mechanical, no noise at all.
    degauss(t) {
      tone(t, 0.85, { f0: 150, f1: 38, type: "sine", gain: 0.55, attack: 0.006, lp: 420, q: 9 });
      tone(t + 0.01, 0.6, { f0: 300, f1: 76, type: "triangle", gain: 0.16, lp: 600, q: 4 });
      noise(t, 0.20, { f0: 120, f1: 60, q: 4, gain: 0.10, attack: 0.01 });
    },

    // Shuttle search: pitched tape wow sweeping past playback speed.
    scrub(t) {
      noise(t, 0.55, { f0: 500, f1: 2400, q: 3.5, gain: 0.28, attack: 0.01 });
      noise(t + 0.1, 0.45, { f0: 2200, f1: 700, q: 3.0, gain: 0.20, attack: 0.01 });
      tone(t, 0.5, { f0: 240, f1: 900, type: "sawtooth", gain: 0.07, lp: 2500, q: 5 });
    },

    // Something periodic nearby: mains hum with a slow beat against itself.
    interference(t) {
      tone(t, 1.7, { f0: MAINS, type: "sawtooth", gain: 0.10, lp: 400, q: 3, attack: 0.15 });
      tone(t + 0.05, 1.5, { f0: MAINS * 2 + 1.5, type: "sine", gain: 0.06, attack: 0.2 });
      for (let i = 0; i < 4; i++) {
        noise(t + 0.15 + i * 0.42, 0.12, { f0: R(1800, 3400), q: 2, gain: 0.10 });
      }
    },

    // Power-on: relay click, HV whine spinning up to scan frequency, thunk.
    boot(t) {
      noise(t, 0.02, { f0: 3000, q: 0.5, gain: 0.5, attack: 0.0005 });   // relay
      tone(t + 0.05, 0.9, { f0: 400, f1: NTSC_SCAN, type: "sine", gain: 0.05, attack: 0.2 });
      noise(t + 0.06, 0.7, { f0: 200, f1: 1800, q: 0.8, gain: 0.18, attack: 0.1 });
      VOICES.degauss(t + 0.55);
    },
  };

  /* ----------------------------------------------------------- ambience --
     The bed you stop hearing after ten seconds and immediately miss when it
     cuts. Off by default; the CRT whine especially is not for everyone. */
  let bed = null;
  function setBed(on, opts = {}) {
    const { hiss = 0.35, hum = 0.3, whine = 0.25 } = opts;
    if (bed) {
      // stop the sources AND disconnect the gain/filter nodes behind them,
      // or the graph accumulates orphans every time this is toggled
      bed.sources.forEach((n) => { try { n.stop(); } catch { /* noop */ } });
      bed.chain.forEach((n) => { try { n.disconnect(); } catch { /* noop */ } });
      bed = null;
    }
    if (!on) return;
    const sources = [];
    const chain = [];
    const t = ctx.currentTime;

    // tape hiss
    const hs = ctx.createBufferSource();
    hs.buffer = noiseBuf; hs.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = "highpass"; hf.frequency.value = 3200;
    const hg = ctx.createGain(); hg.gain.value = hiss * 0.035;
    hs.connect(hf); hf.connect(hg); hg.connect(master);
    hs.start(t); sources.push(hs); chain.push(hf, hg);

    // mains hum plus its second harmonic
    [MAINS, MAINS * 2].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i ? "sine" : "sawtooth";
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 260;
      const g = ctx.createGain(); g.gain.value = hum * (i ? 0.012 : 0.022);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); sources.push(o); chain.push(lp, g);
    });

    // the flyback whine. Many adults cannot hear 15.7kHz at all — that is
    // authentic, and the reason it is opt-in and separately levelled.
    const w = ctx.createOscillator();
    w.type = "sine";
    w.frequency.value = NTSC_SCAN;
    const wg = ctx.createGain(); wg.gain.value = whine * 0.010;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;                 // slow drift, so it feels alive
    const lfoG = ctx.createGain(); lfoG.gain.value = 6;
    lfo.connect(lfoG); lfoG.connect(w.frequency);
    w.connect(wg); wg.connect(master);
    w.start(t); lfo.start(t);
    sources.push(w, lfo); chain.push(wg, lfoG);

    bed = { sources, chain };
  }

  return {
    ctx,
    resume: () => ctx.resume(),
    fire(id) {
      const v = VOICES[id];
      if (!v) return;
      // a touch of scheduling latency keeps the first sample from being clipped
      v(ctx.currentTime + 0.01);
    },
    setVolume: (v) => { master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); },
    setBed,
    dispose() { setBed(false); try { ctx.close(); } catch { /* noop */ } },
  };
}

/* ================================================================== WebGL */
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s); gl.deleteShader(s);
    throw new Error(log || "shader compile failed");
  }
  return s;
}
const VS = `
attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

function program(gl, frag) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, VS);
  const f = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link failed");
  gl.deleteShader(v); gl.deleteShader(f);
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

/* ================================================================ CHROME
   Everything from here down used to be a second hand-rolled copy of the
   design system: its own hex palette (`const C = {...}`) and its own
   gl-s/gl-b/gl-e/gl-p/gl-r/gl-col/gl-t CSS classes, standing in for
   Slider/Button/Panel/ToggleRow/Panel-column/TabStrip. None of that is
   needed here — this page renders inside the same NexusProvider tree as
   the rest of the showcase (see App.tsx), so it already inherits nx-root's
   base layer (font, colour, focus ring, scrollbars, reduced-motion) for
   free, and the real components already exist. Only the WebGL host div,
   the event-trigger cards and the keyframe chart below have no equivalent
   in @nexus-cyberdeck/react and stay bespoke — styled from tokens, not hex.
   ================================================================== */

const SOURCES = ["GRAPH", "BARS", "HUD"];
const GROUPS = ["TAPE", "SIGNAL", "DIGITAL", "DISPLAY", "GLASS"];
const TRACK_COL = [
  "var(--nx-fg-accent)", "var(--nx-fg-info)", "var(--nx-fg-warning)", "var(--nx-fg-critical)",
  "var(--nx-fg-cat-violet)", "var(--nx-fg-cat-lime)", "var(--nx-fg-default)", "#3AC6D4",
];
const fmt = (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(3));

export default function GlitchLab() {
  const hostRef = useRef(null);
  const [err, setErr] = useState(null);
  const [source, setSource] = useState(0);
  const [fps, setFps] = useState(0);
  const [tab, setTab] = useState("events");
  const [openFx, setOpenFx] = useState("chroma");
  const [openEv, setOpenEv] = useState("signal");
  const [live, setLive] = useState([]);
  const [autoFire, setAutoFire] = useState(false);
  const [sound, setSound] = useState(false);
  const [vol, setVol] = useState(0.5);
  const [bed, setBedOn] = useState(false);
  const audioRef = useRef(null);
  const [rate, setRate] = useState(0.35);

  const initial = {};
  for (const e of EFFECTS) {
    initial[e.id] = { on: e.id === "crt" ? 1 : 0, amt: 1 };
    for (const [k, , , d] of e.params) initial[e.id][k] = d;
  }
  const makeBase = (name) => {
    const b = JSON.parse(JSON.stringify(initial));
    for (const [k, v] of Object.entries(PRESETS[name])) Object.assign(b[k], v);
    return b;
  };
  const [cfg, setCfg] = useState(() => makeBase("VHS 1987"));
  // The render loop reads these asynchronously via requestAnimationFrame, so
  // they only ever need to be current as of the last commit. Assigning during
  // render instead would leave them holding values from a render React threw
  // away, which is exactly the case concurrent rendering makes reachable.
  const cfgRef = useRef(cfg);
  const srcRef = useRef(source);
  const autoRef = useRef(autoFire);
  const rateRef = useRef(rate);
  useEffect(() => {
    cfgRef.current = cfg;
    srcRef.current = source;
    autoRef.current = autoFire;
    rateRef.current = rate;
  });
  const activeRef = useRef([]);
  const queueRef = useRef([]);

  const set = (id, key, v) => setCfg((p) => ({ ...p, [id]: { ...p[id], [key]: v } }));

  const fire = useCallback((id) => {
    const def = EV_BY_ID[id];
    if (!def) return;
    activeRef.current.push({ def, t0: performance.now() / 1000, seed: Math.random() * 1000 });
    audioRef.current?.fire(id);
  }, []);

  const fireChain = useCallback((chain) => {
    const now = performance.now() / 1000;
    for (const [d, id] of chain.steps) queueRef.current.push({ at: now + d, id });
  }, []);

  // Audio only ever starts from a user gesture: browsers require it, and
  // autoplaying sound is hostile regardless of policy.
  const enableSound = useCallback(() => {
    if (!audioRef.current) {
      const a = createAudio();
      if (!a) return;
      audioRef.current = a;
    }
    audioRef.current.resume();
    audioRef.current.setVolume(vol);
    setSound(true);
  }, [vol]);

  useEffect(() => { audioRef.current?.setVolume(sound ? vol : 0); }, [vol, sound]);
  useEffect(() => { audioRef.current?.setBed(sound && bed); }, [bed, sound]);
  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const ev = EVENTS.find((x) => x.key === e.key);
      if (ev) { e.preventDefault(); fire(ev.id); setOpenEv(ev.id); setTab("events"); return; }
      if (e.key === " ") {
        e.preventDefault();
        fire(EVENTS[(Math.random() * EVENTS.length) | 0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(canvas);
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false })
      || canvas.getContext("experimental-webgl");
    if (!gl) { setErr("WebGL unavailable in this context."); return undefined; }

    let progs, srcProg, copyProg, quad, rtA, rtB, feed0, feed1, raf = 0;
    try {
      srcProg = program(gl, SRC_FS);
      copyProg = program(gl, `${COMMON}\nvoid main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }`);
      progs = {};
      for (const e of EFFECTS) progs[e.id] = program(gl, e.frag);
    } catch (e) { setErr(String(e.message || e)); return undefined; }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    let W = 1, H = 1;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    const resize = () => {
      W = Math.max(2, Math.floor(host.clientWidth * dpr));
      H = Math.max(2, Math.floor(host.clientHeight * dpr));
      canvas.width = W; canvas.height = H;
      [rtA, rtB, feed0, feed1].forEach((rt) => {
        if (!rt) return;
        gl.deleteTexture(rt.tex); gl.deleteFramebuffer(rt.fb);
      });
      rtA = makeRT(gl, W, H); rtB = makeRT(gl, W, H);
      feed0 = makeRT(gl, W, H); feed1 = makeRT(gl, W, H);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    const bind = (prog) => {
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      return (n) => gl.getUniformLocation(prog, n);
    };

    let t0 = performance.now(), fAcc = 0, fN = 0, fT = 0, nextAuto = 2, liveT = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const time = now / 1000;
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
        if (u >= 1) { activeRef.current.splice(i, 1); continue; }
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
      if (liveT > 0.05) { liveT = 0; setLive(running); }

      /* ---- render ----------------------------------------------------- */
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, rtA.fb);
      let u = bind(srcProg);
      gl.uniform2f(u("uRes"), W, H);
      gl.uniform1f(u("uTime"), time);
      gl.uniform1i(u("uMode"), srcRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      let src = rtA, dst = rtB;

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
          const t = feed0; feed0 = feed1; feed1 = t;
        }
        const t = src; src = dst; dst = t;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      u = bind(copyProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(u("uTex"), 0);
      gl.uniform2f(u("uRes"), W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      fAcc += 1 / Math.max(dt, 1e-4); fN++; fT += dt;
      if (fT > 0.5) { setFps(Math.round(fAcc / fN)); fAcc = 0; fN = 0; fT = 0; }
    };
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); };
  }, []);

  const selFx = EFFECTS.find((e) => e.id === openFx);
  const selEv = EV_BY_ID[openEv];
  const activeCount = EFFECTS.filter((e) => cfg[e.id]?.on).length;

  if (err) {
    return (
      <div style={{
        background: "var(--nx-bg-canvas)", color: "var(--nx-fg-critical)", height: "100%",
        padding: "var(--nx-space-8)", fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-sm)", lineHeight: 1.8,
      }}>
        <div style={{ letterSpacing: "var(--nx-track-wider)", marginBottom: "var(--nx-space-4)" }}>▚ SHADER FAULT</div>
        <div style={{ color: "var(--nx-fg-subtle)" }}>{err}</div>
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", background: "var(--nx-bg-canvas)",
      overflow: "hidden", fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-xs)", color: "var(--nx-fg-subtle)",
    }}>
      <style>{`
        .nxgl-trigger { position: relative; overflow: hidden; text-align: left; cursor: pointer;
          border: var(--nx-hairline) solid var(--nx-border-default); background: rgba(12,16,12,.6);
          color: var(--nx-fg-default); font-family: var(--nx-font-mono); font-size: var(--nx-text-2xs);
          font-weight: var(--nx-weight-medium); letter-spacing: var(--nx-track-wide); text-transform: uppercase;
          padding: var(--nx-space-3) var(--nx-space-3); transition: all var(--nx-dur-micro); }
        .nxgl-trigger:hover { border-color: var(--nx-border-accent); background: var(--nx-bg-hover); }
        .nxgl-trigger:active { background: var(--nx-fg-accent); color: var(--nx-bg-canvas); }
      `}</style>

      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      {/* ------------------------------------------------------ left column */}
      <div style={{
        position: "absolute", top: "var(--nx-space-5)", bottom: "var(--nx-space-5)", left: "var(--nx-space-5)",
        width: 226, overflowY: "auto", scrollbarWidth: "thin", display: "flex", flexDirection: "column", gap: "var(--nx-space-4)",
      }}>
        <Panel style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "var(--nx-space-4)" }}>
            <Wordmark size="var(--nx-text-lg)">GLITCH LAB</Wordmark>
            <span style={{
              fontFamily: "var(--nx-font-stencil)", fontSize: "var(--nx-text-xl)", lineHeight: 0.8,
              color: fps > 50 ? "var(--nx-fg-accent)" : fps > 28 ? "var(--nx-fg-warning)" : "var(--nx-fg-critical)",
            }}>{fps}</span>
          </div>
          <HazardRule style={{ marginBottom: "var(--nx-space-4)" }} />
          <div style={{ display: "flex", gap: "var(--nx-space-2)" }}>
            {SOURCES.map((s, i) => (
              <Button key={s} active={source === i} style={{ flex: 1 }} onClick={() => setSource(i)}>{s}</Button>
            ))}
          </div>
          <div style={{ marginTop: "var(--nx-space-4)", color: "var(--nx-fg-tertiary)", letterSpacing: "var(--nx-track-wide)", fontSize: "var(--nx-text-2xs)" }}>
            RESTING STATE
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)", marginTop: "var(--nx-space-2)" }}>
            {Object.keys(PRESETS).map((p) => (
              <Button key={p} style={{ fontSize: "var(--nx-text-2xs)" }} onClick={() => setCfg(makeBase(p))}>{p}</Button>
            ))}
          </div>
        </Panel>

        {/* ------------------------------------------------ event triggers */}
        <Panel style={{ flexShrink: 0 }}>
          <SectionHeading>/// EVENTS — TRANSIENT</SectionHeading>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)" }}>
            {EVENTS.map((e) => {
              const run = live.find((l) => l.id === e.id);
              return (
                <button key={e.id} type="button" className="nxgl-trigger"
                  onMouseDown={() => { fire(e.id); setOpenEv(e.id); setTab("events"); }}>
                  {run && (
                    <span style={{
                      position: "absolute", inset: 0, background: "var(--nx-bg-active)",
                      transform: `scaleX(${1 - run.u})`, transformOrigin: "left", pointerEvents: "none",
                    }} />
                  )}
                  <span style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "var(--nx-space-2)" }}>
                    <span>{e.label}</span>
                    <span style={{ color: "var(--nx-fg-disabled)" }}>{e.key}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <SectionHeading style={{ margin: "var(--nx-space-5) 0 var(--nx-space-2)" }}>/// CHAINS — CASCADING</SectionHeading>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--nx-space-2)" }}>
            {CHAINS.map((c) => (
              <button key={c.id} type="button" className="nxgl-trigger" onMouseDown={() => fireChain(c)}>
                <span style={{ color: "var(--nx-fg-warning)" }}>{c.label}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "var(--nx-space-2)", marginTop: "var(--nx-space-4)", alignItems: "center" }}>
            <Button active={autoFire} style={{ flex: 1 }} onClick={() => setAutoFire((v) => !v)}>Auto</Button>
            <Button style={{ flex: 1 }} onMouseDown={() => fire(EVENTS[(Math.random() * EVENTS.length) | 0].id)}>Random</Button>
          </div>
          {autoFire && (
            <div style={{ marginTop: "var(--nx-space-3)" }}>
              <Slider label="frequency" value={rate} min={0} max={1} step={0.01} onChange={setRate} format={(v) => v.toFixed(2)} />
            </div>
          )}

          <div style={{
            marginTop: "var(--nx-space-4)", paddingTop: "var(--nx-space-3)", borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
            color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-normal)", minHeight: 26,
          }}>
            {live.length === 0
              ? <span style={{ color: "var(--nx-fg-disabled)" }}>BUS IDLE · KEYS 1–8 · SPACE RANDOM</span>
              : live.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", color: "var(--nx-fg-accent)" }}>
                  <span>▸ {l.label}</span>
                  <span style={{ color: "var(--nx-fg-tertiary)" }}>{Math.round(l.u * 100)}%</span>
                </div>
              ))}
          </div>
        </Panel>

        {/* ------------------------------------------------ audio */}
        <Panel style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--nx-space-3)" }}>
            <SectionHeading style={{ marginBottom: 0 }}>/// AUDIO — SYNTHESISED</SectionHeading>
            <Button active={sound} onClick={() => (sound ? (setSound(false), setBedOn(false)) : enableSound())}>
              {sound ? "ON" : "ENABLE"}
            </Button>
          </div>
          {sound ? (
            <>
              <Slider label="volume" value={vol} min={0} max={1} step={0.01} onChange={setVol} format={(v) => v.toFixed(2)} />
              <div style={{ display: "flex", gap: "var(--nx-space-2)", marginTop: "var(--nx-space-1)" }}>
                <Button active={bed} style={{ flex: 1 }} onClick={() => setBedOn((v) => !v)}>Room tone</Button>
              </div>
              <div style={{ marginTop: "var(--nx-space-3)", color: "var(--nx-fg-subtle)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.6 }}>
                Bed is tape hiss + 60Hz mains + flyback whine at 15.734kHz — the NTSC
                scan rate. Many adults cannot hear that last one at all.
              </div>
            </>
          ) : (
            <div style={{ color: "var(--nx-fg-subtle)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.65 }}>
              No files, no licences. Every voice is generated, so no two shots
              of an event are identical.
            </div>
          )}
        </Panel>

        {/* ------------------------------------------------ resting stack */}
        <Panel style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--nx-space-3)" }}>
            <SectionHeading style={{ marginBottom: 0 }}>/// STACK</SectionHeading>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{activeCount} ON</span>
          </div>
          {GROUPS.map((g) => (
            <div key={g} style={{ marginBottom: "var(--nx-space-3)" }}>
              <div style={{ color: "var(--nx-fg-disabled)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)", marginBottom: "var(--nx-space-1)" }}>{g}</div>
              {EFFECTS.filter((e) => e.group === g).map((e) => {
                const hot = live.some((l) => EV_BY_ID[l.id].tracks.some((t) => t.fx === e.id));
                return (
                  <div key={e.id} onClick={() => { setOpenFx(e.id); setTab("fx"); }}
                    style={{
                      cursor: "pointer",
                      borderLeft: `2px solid ${openFx === e.id ? "var(--nx-fg-accent)" : "transparent"}`,
                    }}>
                    <ToggleRow
                      checked={!!cfg[e.id].on}
                      onChange={(v) => set(e.id, "on", v ? 1 : 0)}
                      label={<span style={{ color: hot ? "var(--nx-fg-critical)" : undefined }}>{e.label}{hot ? " ●" : ""}</span>}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </Panel>
      </div>

      {/* ----------------------------------------------------- right column */}
      <div style={{
        position: "absolute", top: "var(--nx-space-5)", bottom: "var(--nx-space-5)", right: "var(--nx-space-5)",
        width: 282, overflowY: "auto", scrollbarWidth: "thin",
      }}>
        <Panel padded={false}>
          <div style={{ padding: "var(--nx-space-3) var(--nx-space-3) 0" }}>
            <TabStrip
              value={tab}
              onChange={setTab}
              tabs={[{ value: "events", label: "Event" }, { value: "fx", label: "Effect" }]}
            />
          </div>

          {tab === "events" && selEv && (
            <div style={{ padding: "var(--nx-space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--nx-fg-accent)", fontWeight: 700, letterSpacing: "var(--nx-track-wide)", fontSize: "var(--nx-text-sm)" }}>{selEv.label}</span>
                <Button onMouseDown={() => fire(selEv.id)}>Fire</Button>
              </div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)", margin: "var(--nx-space-3) 0 var(--nx-space-4)" }}>
                {(selEv.dur * 1000) | 0}MS · CHAOS {selEv.chaos.toFixed(2)} · {selEv.tracks.length} TRACKS
              </div>
              <p style={{ margin: "0 0 var(--nx-space-5)", color: "var(--nx-fg-subtle)", lineHeight: 1.75, fontSize: "var(--nx-text-sm)" }}>{selEv.cause}</p>

              <SectionHeading>/// ENVELOPES</SectionHeading>
              <TrackViz ev={selEv} live={live.find((l) => l.id === selEv.id)} />

              <div style={{ marginTop: "var(--nx-space-4)" }}>
                {selEv.tracks.map((t, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", color: "var(--nx-fg-subtle)",
                    fontSize: "var(--nx-text-2xs)", padding: "1px 0",
                  }}>
                    <span style={{ color: TRACK_COL[i % TRACK_COL.length] }}>
                      {t.fx}.{t.param}
                    </span>
                    <span style={{ color: "var(--nx-fg-disabled)" }}>
                      {t.mode}{t.keys.some((k) => k[2] === "step") ? " · step" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "var(--nx-space-5)", paddingTop: "var(--nx-space-4)", borderTop: "var(--nx-hairline) solid var(--nx-border-default)" }}>
                <SectionHeading>/// INTEGRATION</SectionHeading>
                <pre style={{
                  margin: 0, padding: "var(--nx-space-4) var(--nx-space-5)", background: "rgba(0,0,0,.35)",
                  border: "var(--nx-hairline) solid var(--nx-border-default)", color: "var(--nx-fg-muted)",
                  fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.7, overflowX: "auto",
                }}><code>{`// on route change
glitch.fire("boot");

// on failed request
glitch.fire("${selEv.id}");

// on cascading failure
glitch.chain([[0,"dropout"],
  [0.12,"corrupt"],[0.34,"signal"]]);`}</code></pre>
              </div>
            </div>
          )}

          {tab === "fx" && selFx && (
            <div style={{ padding: "var(--nx-space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--nx-fg-accent)", fontWeight: 700, letterSpacing: "var(--nx-track-wide)", fontSize: "var(--nx-text-sm)" }}>{selFx.label}</span>
                <Button active={!!cfg[selFx.id].on} onClick={() => set(selFx.id, "on", cfg[selFx.id].on ? 0 : 1)}>
                  {cfg[selFx.id].on ? "ON" : "OFF"}
                </Button>
              </div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)", margin: "var(--nx-space-3) 0 var(--nx-space-4)" }}>
                {selFx.group} STAGE
              </div>
              <p style={{ margin: "0 0 var(--nx-space-5)", color: "var(--nx-fg-subtle)", lineHeight: 1.75, fontSize: "var(--nx-text-sm)" }}>{selFx.note}</p>
              <div style={{ height: "var(--nx-hairline)", background: "var(--nx-border-default)", marginBottom: "var(--nx-space-4)" }} />
              <Slider label="mix" value={cfg[selFx.id].amt} min={0} max={1} step={0.01} onChange={(v) => set(selFx.id, "amt", v)} format={fmt} />
              {selFx.params.map(([k, lo, hi]) => (
                <Slider key={k} label={k} value={cfg[selFx.id][k]} min={lo} max={hi}
                  step={(hi - lo) / 200} onChange={(v) => set(selFx.id, k, v)} format={fmt} />
              ))}
              <div style={{ marginTop: "var(--nx-space-3)", color: "var(--nx-fg-disabled)", fontSize: "var(--nx-text-2xs)", lineHeight: 1.6 }}>
                Events override these while running, then hand control back.
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div style={{
        position: "absolute", bottom: "var(--nx-space-4)", left: "50%", transform: "translateX(-50%)",
        color: "var(--nx-fg-disabled)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)",
        textTransform: "uppercase", pointerEvents: "none",
      }}>
        events override the resting stack, then hand it back · 1–8 · space
      </div>
    </div>
  );
}

/** Draws each track's keyframe curve, with a playhead when the event is live. */
function TrackViz({ ev, live }) {
  const W = 254, H = 72, N = 90;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{
      display: "block", border: "var(--nx-hairline) solid var(--nx-border-default)", background: "rgba(0,0,0,.35)",
    }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={g * W} y1={0} x2={g * W} y2={H} stroke="var(--nx-border-default)" strokeWidth="1" />
      ))}
      {ev.tracks.map((t, ti) => {
        let d = "";
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const v = sampleKeys(t.keys, u);
          // normalise each track against its own range so shape is comparable
          const lo = Math.min(...t.keys.map((k) => k[1]));
          const hi = Math.max(...t.keys.map((k) => k[1]));
          const n = hi === lo ? 0.5 : (v - lo) / (hi - lo);
          d += `${i ? "L" : "M"}${(u * W).toFixed(1)},${(H - 4 - n * (H - 9)).toFixed(1)}`;
        }
        return <path key={ti} d={d} fill="none" stroke={TRACK_COL[ti % TRACK_COL.length]} strokeWidth="1.2" opacity="0.85" />;
      })}
      {live && (
        <>
          <line x1={live.u * W} y1={0} x2={live.u * W} y2={H} stroke="var(--nx-fg-default)" strokeWidth="1.4" />
          <rect x={0} y={0} width={live.u * W} height={H} fill="var(--nx-fg-accent)" opacity="0.07" />
        </>
      )}
    </svg>
  );
}
