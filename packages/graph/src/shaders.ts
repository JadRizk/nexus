import type { LinkRouting } from "./types.js";

// `uReduced` (0 or 1) carries prefers-reduced-motion into every program that moves; a float, so
// each effect scales by `1.0 - uReduced` in place instead of forking the shader.

/** Per-edge vec4 attributes. With position, iA, iB and iColor that is 7 of WebGL1's guaranteed 8. */
export const EDGE_ATTRS = {
  /** width(register half-width), curve, dash(screen-space period, px), signed gain(weight; negative = undirected) */
  iP0: 4,
  /** flow, seed, radA, radB */
  iP1: 4,
  /** tier(0 | 0.45 two-hop | 1 incident), hide, jit, fray(0 none | 1 b-end | 2 a-end) */
  iP2: 4,
} as const;

/** Drawn ribbon half-width as a multiple of the register half-width the fragment shader measures in. */
export const EDGE_SPAN = 2.6;

/** `iP0.y` sentinel for etched routing. Tested by magnitude: an arc's sign picks its side. */
export const ROUTE_ETCHED = -1000.0;

/** Largest bow an arc may request. Keeps arcs three orders of magnitude clear of `ROUTE_ETCHED`. */
export const MAX_ARC_BOW = 1.0;

/** Bow used when a category asks for `routing: "arc"` without naming a `curve`. */
export const DEFAULT_ARC_BOW = 0.115;

/** Encodes `iP0.y`: the etched sentinel, a clamped signed bow for arcs, else 0 (straight). */
export function encodeRouting(routing: LinkRouting | undefined, bow: number): number {
  switch (routing) {
    case "etched":
      return ROUTE_ETCHED;
    case "arc":
      return Math.max(-MAX_ARC_BOW, Math.min(MAX_ARC_BOW, bow));
    default:
      return 0;
  }
}

/** Encodes `iP0.w`: the gain's magnitude, negative when undirected. */
export function encodeGain(gain: number, directed: boolean): number {
  const magnitude = Math.abs(gain);
  return directed ? magnitude : -magnitude;
}

// Shared by EDGE_VS and PAD_VS so a pad lands exactly where its trace ends.
const ROUTE_GLSL = `
vec2 routeAt(float t, vec2 A, vec2 B, float curve){
  if (curve > -900.0) {
    if (abs(curve) > 0.001) {
      vec2 ch = B - A; float L = max(length(ch), 1e-4);
      vec2 nr = vec2(-ch.y, ch.x)/L;
      vec2 Cc = (A + B)*0.5 + nr*L*curve;
      float u = 1.0 - t;
      return u*u*A + 2.0*u*t*Cc + t*t*B;
    }
    return mix(A, B, t);
  }
  // Etched: axis, 45 degrees, axis; the diagonal shrinks to 0 at |dx| == |dy| so it never pops sides.
  vec2 d = B - A;
  vec2 s = vec2(d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0);
  float adx = abs(d.x), ady = abs(d.y);
  float mn = min(adx, ady), mx = max(adx, ady);
  float e = (mx - mn) * 0.5;
  float diag = mn * 1.41421356;
  float ss = t * max(2.0*e + diag, 1e-4);
  vec2 ax = (adx > ady) ? vec2(s.x, 0.0) : vec2(0.0, s.y);
  vec2 dv = s * 0.70710678;
  if (ss < e)        return A + ax*ss;
  if (ss < e + diag) return A + ax*e + dv*(ss - e);
  return A + ax*e + dv*diag + ax*(ss - e - diag);
}
float routeLen(vec2 A, vec2 B, float curve){
  if (curve < -900.0) {
    vec2 d = B - A;
    float adx = abs(d.x), ady = abs(d.y);
    return max((max(adx,ady) - min(adx,ady)) + min(adx,ady)*1.41421356, 1e-4);
  }
  // Approximate: only feeds endpoint trimming and the dash period.
  return max(length(B - A) * (1.0 + curve*curve*1.3), 1e-4);
}`;

/** Screen px between a terminal pad and its node glyph. */
const PAD_GAP_PX = 1.5;

export const NODE_VS = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uTime, uPx, uHlStart;

attribute vec2 position, iPos;
attribute vec3 iColor;
attribute vec4 iN0, iN1;   // radius,shape,seed,depth | state,sel,hide,-

varying vec4 vA;   // q.x, q.y, ripple, dim
varying vec4 vB;   // colour.rgb, shape
varying vec4 vC;   // aa, state, sel, seed

void main() {
  float iRadius = iN0.x, iShape = iN0.y, iSeed = iN0.z, iDepth = iN0.w;
  float iState = iN1.x, iSel = iN1.y, iHide = iN1.z;
  if (iHide > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  float amp = (iState > 1.5 && iState < 2.5) ? 0.075 : 0.028;
  float spd = (iState > 1.5 && iState < 2.5) ? 3.1 : 1.35;
  float breathe = 1.0 + amp * sin(uTime * spd + iSeed * 6.2831);
  float age = uTime - uHlStart - iDepth * 0.07;
  float ripple = iDepth < -0.5 ? 0.0 : exp(-max(age,0.0)*2.4) * step(0.0,age) * step(age,7.0);

  float r = max(iRadius * breathe, uPx * 2.2) * (1.0 + ripple * 0.55);
  float span = r * 3.2;

  vA = vec4(position, ripple, iDepth < -0.5 ? 1.0 : 0.0);
  vB = vec4(iColor, iShape);
  vC = vec4(uPx / max(span, 1e-4), iState, iSel, iSeed);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + position * span, 0.0, 1.0);
}`;

export const NODE_FS = `
precision highp float;
uniform float uTime, uGlow, uFocus, uReduced;
varying vec4 vA, vB, vC;
const float R = 0.285;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float sdPoly(vec2 p, float r, float n, float rot){
  float an = 3.14159265/n;
  float a = atan(p.y,p.x)+rot;
  float bn = mod(a+an, 2.0*an)-an;
  return length(p)*cos(bn) - r*cos(an);
}
float shapeSDF(vec2 p, float s){
  if (s < 0.5) return length(p)-R;
  if (s < 1.5) return sdPoly(p, R*1.06, 6.0, 0.0);
  if (s < 2.5) return sdPoly(p, R*1.02, 4.0, 0.0);
  if (s < 3.5) return abs(length(p)-R*0.72)-R*0.24;
  if (s < 4.5) return sdPoly(p, R*0.98, 4.0, 0.78539);
  return sdPoly(p, R*1.12, 3.0, 1.5708);
}
void main(){
  vec2 vQ = vA.xy;
  float vRipple = vA.z, vDim = vA.w, vShape = vB.w;
  float vAA = vC.x, vState = vC.y, vSel = vC.z, vSeed = vC.w;
  vec3 vColor = vB.rgb;

  float d = shapeSDF(vQ, vShape);
  float rad = length(vQ);
  float rim  = smoothstep(vAA*2.2, 0.0, abs(d));
  float body = smoothstep(vAA, -vAA, d);
  float halo = pow(max(0.0, 1.0-rad), 5.0);
  body *= 0.55 + 0.45*step(0.5, fract(vQ.y*22.0 - uTime*0.25));

  // HOT nodes re-roll their flicker 9x a second — above the 3 Hz flash
  // threshold in WCAG 2.3.1. Under reduced motion the re-roll rate drops to
  // the 0.94 Hz the tokens layer caps its blink at, and the trough is lifted
  // so the node blinks rather than strobes.
  float flickHz = mix(9.0, 0.94, uReduced);
  float flickFloor = mix(0.35, 0.7, uReduced);
  float flick = vState > 2.5
    ? (flickFloor + (1.0-flickFloor)*step(0.32, h1(vSeed*91.7 + floor(uTime*flickHz)*12.9898))) : 1.0;
  float level = vState < 0.5 ? 0.38 : 1.0;

  // vSel: +4 when keyboard-focused; below that 1 = hovered, 2 = selected.
  float focusMark = step(3.5, vSel);
  float mark = vSel - 4.0*focusMark;
  vec2 ap = abs(vQ);
  float br = 0.0;
  if (mark > 0.5) {
    float lock = step(1.5, mark);
    float bx = mix(0.70, 0.745 + 0.035*sin(uTime*2.4)*(1.0 - uReduced), lock);
    float th = mix(0.020, 0.032, lock);
    float ring = smoothstep(th, 0.0, abs(max(ap.x,ap.y)-bx));
    br = ring * step(bx-0.34, min(ap.x,ap.y)) * mix(0.75, 2.0, lock);
  }
  // Focus ring, tinted toward the system focus accent.
  float fr = focusMark * smoothstep(0.07, 0.0, abs(max(ap.x,ap.y) - 0.88));
  float dim = mix(1.0, 0.16, uFocus*vDim) * level * flick;
  vec3 col = vColor * (rim*1.55 + body*0.42 + halo*uGlow*(0.26 + vRipple*2.0)) * dim
           + vec3(1.0) * rim * 0.28 * dim
           + vColor * br * 1.9
           + mix(vec3(1.0), vec3(0.776, 0.945, 0.208), 0.6) * fr * 3.0;
  if (max(col.r, max(col.g, col.b)) < 0.004) discard;
  gl_FragColor = vec4(col, 1.0);
}`;

export const EDGE_VS = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uPx, uWidth, uTime, uReduced;

// 7 attribute slots, 3 varyings. Ten of either is over the WebGL1 guaranteed
// minimum (8), and a program that exceeds it fails to LINK — drawing nothing
// at all, with no error surfaced anywhere on screen.
attribute vec2 position, iA, iB;
attribute vec3 iColor;
attribute vec4 iP0, iP1, iP2;   // see EDGE_ATTRS

varying vec4 vCT;   // colour.rgb, t
varying vec4 vA;    // across, seed, tier, dash
varying vec4 vB;    // flow, gain, lenPx, fray
${ROUTE_GLSL}
void main(){
  if (iP2.y > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // clipped away
  float iW = iP0.x, iCurve = iP0.y, iDash = iP0.z, iGain = abs(iP0.w);
  float iFlow = iP1.x, iSeed = iP1.y, iRadA = iP1.z, iRadB = iP1.w;
  float iTier = iP2.x, iJit = iP2.z, iFray = iP2.w;

  float L = routeLen(iA, iB, iCurve);
  float gap = ${PAD_GAP_PX.toFixed(1)} * uPx;
  float t0 = clamp((iRadA + gap)/L, 0.0, 0.30);
  float t1 = 1.0 - clamp((iRadB + gap)/L, 0.0, 0.30);
  float t  = mix(t0, t1, position.x);

  vec2 p = routeAt(t, iA, iB, iCurve);
  // A central difference gives the normal and rounds an etched route's 45 degree breaks for free.
  float hh = 0.6/24.0;
  vec2 pa = routeAt(clamp(t - hh, 0.0, 1.0), iA, iB, iCurve);
  vec2 pb = routeAt(clamp(t + hh, 0.0, 1.0), iA, iB, iCurve);
  vec2 tg = pb - pa;
  float tl = length(tg);
  vec2 nn = tl > 1e-5 ? vec2(-tg.y, tg.x)/tl : vec2(0.0, 1.0);   // normalize(0) is NaN

  // Width tapers only into the pads; tier (hover) changes alpha, never geometry.
  float x = position.x;
  float ee = min(x, 1.0 - x)/0.055;
  float taper = ee >= 1.0 ? 1.0 : pow(max(ee, 1e-4), 0.45);
  float w = max(uWidth*iW, 1.05) * ${EDGE_SPAN.toFixed(1)} * taper * uPx;

  // The jitter is a travelling sine at 11 rad/s: pure motion, so it is scaled
  // away under prefers-reduced-motion, leaving the edge on its true path.
  p += nn * sin(position.x*37.0 + uTime*11.0 + iSeed*40.0) * iJit * uPx * 1.6 * (1.0 - uReduced);

  vCT = vec4(iColor, position.x);
  vA  = vec4(position.y * ${EDGE_SPAN.toFixed(1)}, iSeed, iTier, iDash);
  vB  = vec4(iFlow, iGain, L/uPx, iFray);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + nn*position.y*w, 0.0, 1.0);
}`;

export const EDGE_FS = `
precision highp float;
uniform float uTime, uOpacity, uFlowSpeed, uFocus, uSignal, uPass, uReduced;
varying vec4 vCT, vA, vB;

void main(){
  vec3  col0  = vCT.rgb;
  float vT    = vCT.w;
  float sx    = vA.x;                 // signed, so the specular can pick a side
  float ax    = abs(sx);
  float vSeed = vA.y, vTier = vA.z, vDash = vA.w;
  float vFlow = vB.x, vGain = vB.y, vLenPx = vB.z, vFray = vB.w;

  // Resting pass composites so crossings don't sum to white; live pass adds. Each drops the other's.
  float isAct = step(0.5, vTier);
  if (abs(isAct - uPass) > 0.5) discard;

  float fray = 1.0;
  if (vFray > 0.5) {
    float u = vFray > 1.5 ? 1.0 - vT : vT;      // 1 = b-end absent, 2 = a-end
    fray = 1.0 - pow(clamp((u - 0.32)/0.62, 0.0, 1.0), 1.5);
    if (fray <= 0.02) discard;
  }

  // Screen-space dashes, so the rhythm holds at any zoom.
  if (vDash > 0.01) {
    if (fract(vT * vLenPx / vDash) > 0.62 * fray) discard;
  }

  float shoulder = exp(-ax*ax*2.2) * 0.16;
  float body     = smoothstep(1.0, 0.62, ax) * 0.62;
  float core     = exp(-ax*ax*11.0);
  float spec     = exp(-pow(ax - 0.66, 2.0)*90.0) * 0.5 * step(0.0, sx);

  float gain = vTier > 0.5 ? 3.2 : (vTier > 0.1 ? 1.15 : 1.0);
  float A = vGain * uOpacity * gain * fray;
  A *= mix(1.0, 0.20, uFocus * step(vTier, 0.05));

  float packet = 0.0, syncm = 0.0;
  if (uSignal > 0.5 && (vTier > 0.5 || abs(vFlow) > 0.01)) {
    float spd  = abs(vFlow) > 0.01 ? abs(vFlow) : 0.34;
    // Reduced motion stops the signal clock: packets hold still rather than vanish.
    float tSig = uTime * (1.0 - uReduced);
    float head = fract(tSig*uFlowSpeed*spd + vSeed);
    float dd   = vT - head; dd -= floor(dd + 0.5);          // wrap to [-0.5, 0.5]
    packet = max(exp(-dd*dd*2600.0), dd < 0.0 ? exp(dd*20.0)*0.6 : 0.0);
    packet *= exp(-ax*ax*3.0);
    if (vTier > 0.5) {
      float ph = fract((vT*vLenPx - tSig*uFlowSpeed*spd*5.7)/34.0);
      syncm = step(ph, 0.11) * exp(-ax*ax*9.0);
    }
  }

  // Core whitening scales with gain, so registers stay distinct at their peaks.
  vec3  hotC = mix(col0, vec3(1.0), 0.40*min(vGain, 1.0));
  float hotA = 0.12 + 0.28*min(vGain, 1.0);
  float cov  = shoulder + body + core + spec;
  vec3  col  = col0*(shoulder + body)*A
             + hotC*core*A
             + vec3(1.0)*spec*A*0.55
             + vec3(1.0)*core*hotA*step(0.5, vTier)*A
             + mix(col0, vec3(1.0), 0.5)*packet*(0.9 + step(0.5, vTier)*1.6)*max(A, 0.22)
             + vec3(1.0)*syncm*A*0.45;

  // Sit in COMPOSITE_FS's scanline grid rather than float over it.
  col *= 0.88 + 0.12*step(0.5, fract(gl_FragCoord.y*0.5));

  if (max(col.r, max(col.g, col.b)) < 0.004) discard;
  float a = clamp(cov*A + packet*0.8, 0.0, 1.0);
  gl_FragColor = uPass > 0.5 ? vec4(col, 1.0)   // additive: alpha unread
                             : vec4(col, a);     // premultiplied
}`;

/** Terminal pads on the edge instance buffers; `aPad` is (arm, thickness, whichEnd). A directed
 * edge's target end is an open bracket, so direction reads without motion; other ends a solid bar. */
export const PAD_VS = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uPx, uWidth, uFocus;

attribute vec3 aPad;
attribute vec2 iA, iB;
attribute vec3 iColor;
attribute vec4 iP0, iP1, iP2;

varying vec3 vCol;
varying float vFade;
varying vec4 vPad;   // uv.x (across), uv.y (along, +1 toward the node), stroke.x, stroke.y; stroke 0 = solid bar
${ROUTE_GLSL}
void main(){
  float iCurve = iP0.y, iGain = abs(iP0.w);
  float directed = step(0.0, iP0.w);
  float iTier = iP2.x, iFray = iP2.w;
  float absentEnd = iFray > 1.5 ? 0.0 : (iFray > 0.5 ? 1.0 : -1.0);
  if (iP2.y > 0.5 || (iFray > 0.5 && abs(aPad.z - absentEnd) < 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;
  }
  float L = routeLen(iA, iB, iCurve);
  float gap = ${PAD_GAP_PX.toFixed(1)} * uPx;
  float t = aPad.z < 0.5 ? clamp((iP1.z + gap)/L, 0.0, 0.30)
                         : 1.0 - clamp((iP1.w + gap)/L, 0.0, 0.30);
  vec2 p  = routeAt(t, iA, iB, iCurve);
  vec2 pa = routeAt(clamp(t - 0.02, 0.0, 1.0), iA, iB, iCurve);
  vec2 pb = routeAt(clamp(t + 0.02, 0.0, 1.0), iA, iB, iCurve);
  vec2 tg = pb - pa;
  float tl = max(length(tg), 1e-5);
  vec2 tt = tg/tl, nn = vec2(-tt.y, tt.x);
  float arm = 2.9*uPx*(iTier > 0.5 ? 1.3 : 1.0);
  float th  = 0.62*uPx;
  vCol  = mix(iColor, vec3(1.0), 0.35);
  vFade = iGain*(iTier > 0.5 ? 1.7 : 1.1) * mix(1.0, 0.20, uFocus * step(iTier, 0.05));

  float bracket = directed * step(0.5, aPad.z);
  vec2 centre = p;
  float along = th;
  vPad = vec4(aPad.xy, 0.0, 0.0);
  if (bracket > 0.5) {
    // tt runs a -> b, so at the b end +tt points into the node.
    along = arm * 0.85;
    centre = p - tt*along;
    vPad.zw = vec2(th/arm, th/along) * 1.6;
  }
  gl_Position = projectionMatrix * modelViewMatrix
              * vec4(centre + nn*aPad.x*arm + tt*aPad.y*along, 0.0, 1.0);
}`;

export const PAD_FS = `
precision highp float;
uniform float uOpacity;
varying vec3 vCol;
varying float vFade;
varying vec4 vPad;
void main(){
  // Bracket keeps its back bar and legs; a solid bar has stroke 0.
  if (vPad.z > 0.0 && abs(vPad.x) < 1.0 - vPad.z && vPad.y > -1.0 + vPad.w) discard;
  float a = clamp(vFade*uOpacity*1.6, 0.0, 1.0);
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol*a, a);   // premultiplied
}`;

export const FADE_VS = `precision highp float; attribute vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
// uAlpha < 1 leaves a fraction of the previous frame behind (the trails). Under
// reduced motion the veil goes fully opaque, so every frame starts clean.
export const FADE_FS = `precision highp float; uniform vec3 uColor; uniform float uAlpha, uReduced;
void main(){ gl_FragColor = vec4(uColor, max(uAlpha, uReduced)); }`;

export const POST_VS = `precision highp float;
attribute vec2 position; attribute vec2 uv; varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

export const BLUR_FS = `
precision highp float;
uniform sampler2D uTex; uniform vec2 uTexel, uDir; uniform float uThresh;
varying vec2 vUv;
void main(){
  float w[5];
  w[0]=0.227; w[1]=0.194; w[2]=0.122; w[3]=0.054; w[4]=0.016;
  vec3 acc = vec3(0.0);
  for (int i=-4; i<=4; i++){
    vec3 c = texture2D(uTex, vUv + uDir*uTexel*float(i)*1.35).rgb;
    if (uThresh > 0.0) c = max(c - uThresh, 0.0) / max(1.0 - uThresh, 0.001);
    int a = i < 0 ? -i : i;
    float k = a==0?w[0]:a==1?w[1]:a==2?w[2]:a==3?w[3]:w[4];
    acc += c * k;
  }
  gl_FragColor = vec4(acc, 1.0);
}`;

export const COMPOSITE_FS = `
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes;
uniform float uTime, uScan, uAberr, uCurve, uGrain, uBloomAmt, uGlitch, uReduced;
varying vec2 vUv;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453123); }
void main(){
  // Motion vs texture, the same split the CSS CRT layer makes: the glitch
  // bands (15 Hz), grain (24 Hz) and the rolling bar are motion and go to
  // zero under reduced motion; the scanlines, grille, curve, aberration and
  // vignette are static texture and stay.
  float motion = 1.0 - uReduced;
  float glitch = uGlitch * motion;
  vec2 uv = vUv*2.0 - 1.0;
  vec2 off = abs(uv.yx)/vec2(6.0, 5.0);
  uv += uv*off*off*uCurve;
  uv = uv*0.5 + 0.5;

  if (glitch > 0.001) {
    float band = floor(uv.y*26.0);
    float r = h1(band*7.13 + floor(uTime*15.0)*3.77);
    if (r > 0.80) uv.x += (r-0.9)*0.10*glitch;
  }
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0,0.0,0.0,1.0); return;
  }
  float ab = uAberr * (0.0012 + 0.0055*length(uv-0.5));
  vec3 col;
  col.r = texture2D(uScene, uv + vec2(ab, 0.0)).r;
  col.g = texture2D(uScene, uv).g;
  col.b = texture2D(uScene, uv - vec2(ab, 0.0)).b;
  col += texture2D(uBloom, uv).rgb * uBloomAmt;

  // Softer than before: the grille and scanlines were eating thin geometry.
  float sl = sin(uv.y*uRes.y*1.6)*0.5 + 0.5;
  col *= 1.0 - uScan*0.24*sl;
  float ag = mod(gl_FragCoord.x, 3.0);
  vec3 grille = vec3(ag<1.0?1.10:0.91, (ag>=1.0&&ag<2.0)?1.10:0.91, ag>=2.0?1.10:0.91);
  col *= mix(vec3(1.0), grille, uScan*0.5);

  float roll = fract(uv.y - uTime*0.08);
  col += vec3(0.09,0.12,0.06) * pow(max(0.0, 1.0-abs(roll-0.5)*2.0), 24.0) * uScan * motion;
  col += (h2(uv*vec2(uRes.x, uRes.y) + floor(uTime*24.0)) - 0.5) * uGrain*0.11 * motion;
  vec2 d = uv-0.5;
  col *= 1.0 - dot(d,d)*0.78;
  gl_FragColor = vec4(col, 1.0);
}`;
