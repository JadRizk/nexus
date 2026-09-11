/* ============================================================================
   SHADERS

   Moved from NexusCyberdeck.jsx. `ARROW_T` is interpolated into EDGE_VS at
   module load, same as before.

   `uReduced` (0 or 1) is the one departure from the prototype: it carries
   `prefers-reduced-motion` into the node, fade and composite programs. It is a
   float rather than a bool so each effect can be scaled by `1.0 - uReduced`
   in place instead of forking the shader — the branches stay uniform across
   the whole draw, so there is no divergence cost.
   ========================================================================== */

/** Where the edge triangle-strip stops widening for the arrowhead (fraction along the strip). */
export const ARROW_T = 20 / 24;

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

  float br = 0.0;
  if (vSel > 0.5) {
    vec2 ap = abs(vQ);
    float lock = step(1.5, vSel);
    float bx = mix(0.70, 0.745 + 0.035*sin(uTime*2.4), lock);
    float th = mix(0.020, 0.032, lock);
    float ring = smoothstep(th, 0.0, abs(max(ap.x,ap.y)-bx));
    br = ring * step(bx-0.34, min(ap.x,ap.y)) * mix(0.75, 2.0, lock);
  }
  float dim = mix(1.0, 0.16, uFocus*vDim) * level * flick;
  vec3 col = vColor * (rim*1.55 + body*0.42 + halo*uGlow*(0.26 + vRipple*2.0)) * dim
           + vec3(1.0) * rim * 0.28 * dim
           + vColor * br * 1.9;
  if (max(col.r, max(col.g, col.b)) < 0.004) discard;
  gl_FragColor = vec4(col, 1.0);
}`;

export const EDGE_VS = `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform float uPx, uWidth, uTime;

// 7 attribute slots, 3 varyings. Ten of either is over the WebGL1 guaranteed
// minimum (8), and a program that exceeds it fails to LINK — drawing nothing
// at all, with no error surfaced anywhere on screen.
attribute vec2 position, iA, iB;
attribute vec3 iColor, iP2;   // active, hide, jitter
attribute vec4 iP0, iP1;      // width,curve,dash,arrow | flow,seed,radA,radB

varying vec4 vCT;   // colour.rgb, t
varying vec4 vA;    // across, seed, active, dash
varying vec4 vB;    // flow, arrowMask, chordLen, -

void main(){
  float iHide = iP2.y;
  if (iHide > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }  // clipped away

  float iWidth = iP0.x, iCurve = iP0.y, iDash = iP0.z, iArrow = iP0.w;
  float iFlow = iP1.x, iSeed = iP1.y, iRadA = iP1.z, iRadB = iP1.w;
  float iActive = iP2.x, iJit = iP2.z;

  vec2 chord = iB - iA;
  float L = length(chord);
  if (L < 0.001) { chord = vec2(0.001, 0.0); L = 0.001; }
  vec2 nr = vec2(-chord.y, chord.x) / L;
  vec2 C = (iA + iB) * 0.5 + nr * L * iCurve;

  float t0 = clamp(iRadA/L, 0.0, 0.26);
  float t1 = 1.0 - clamp(iRadB/L, 0.0, 0.26);
  float t = mix(t0, t1, position.x);
  float u = 1.0 - t;
  vec2 p  = u*u*iA + 2.0*u*t*C + t*t*iB;

  vec2 tg = 2.0*u*(C - iA) + 2.0*t*(iB - C);
  float tl = length(tg);
  vec2 nn = tl > 0.00001 ? vec2(-tg.y, tg.x)/tl : nr;   // normalize(0) is NaN

  float w = max(uWidth*iWidth, 1.7) * (1.0 + iActive*1.1) * uPx;
  float head = 0.0;
  if (iArrow > 0.5 && position.x > ${ARROW_T.toFixed(6)} - 0.0001) {
    float k = (position.x - ${ARROW_T.toFixed(6)})/(1.0 - ${ARROW_T.toFixed(6)});
    w = max(uWidth, 1.6)*uPx*3.2*(1.0-k)*(1.0+iActive*0.5);
    head = 1.0;
  }
  p += nn * sin(position.x*37.0 + uTime*11.0 + iSeed*40.0) * iJit * uPx * 1.6;

  vCT = vec4(iColor, position.x);
  vA  = vec4(position.y, iSeed, iActive, iDash);
  vB  = vec4(iFlow, head, L, 0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p + nn*position.y*w, 0.0, 1.0);
}`;

export const EDGE_FS = `
precision highp float;
uniform float uTime, uOpacity, uFlowSpeed, uFocus;
varying vec4 vCT, vA, vB;

void main(){
  vec3 vColor = vCT.rgb;
  float vT = vCT.w, vAcross = vA.x, vSeed = vA.y, vActive = vA.z, vDash = vA.w;
  float vFlow = vB.x, vArrow = vB.y, vLen = vB.z;

  float ax = abs(vAcross);
  // Full brightness across the inner 72% of the band. Calibrated against a
  // software render of this exact maths: the white centre spine was blowing
  // every link to pure white in dense regions, so it is now a hint, not a core.
  float core = smoothstep(1.0, 0.72, ax);
  float shoulder = pow(1.0 - ax, 2.4);
  float hot = smoothstep(1.0, 0.24, ax);
  float lineShape = core + shoulder * 0.14;

  if (vDash > 0.01 && vArrow < 0.5) {
    if (fract(vT*vLen*vDash*0.045) > 0.56) discard;
  }
  float shape = vArrow > 0.5 ? smoothstep(1.0, 0.78, ax) : lineShape;

  float packet = 0.0;
  if (abs(vFlow) > 0.01) {
    float p1 = fract(vT - uTime*uFlowSpeed*abs(vFlow) + vSeed);
    packet = max(step(abs(p1-0.5), 0.020), exp(-max(0.0, 0.5-p1)*26.0)*0.55);
    if (vFlow < 0.0) {
      float p2 = fract(-vT - uTime*uFlowSpeed + vSeed*1.7);
      packet = max(packet, max(step(abs(p2-0.5),0.020), exp(-max(0.0,0.5-p2)*26.0)*0.55));
    }
    packet *= (1.0 - ax*0.6) * (1.0 - vArrow);
  }

  float dim = mix(1.0, 0.32, uFocus*(1.0-vActive));
  vec3 col = vColor*shape*uOpacity*(1.0 + vActive*2.2)
           + vec3(1.0)*hot*(1.0 - vArrow)*0.07*uOpacity
           + vColor*packet*(1.4 + vActive*1.8)
           + vec3(1.0)*packet*0.40;
  col *= dim * smoothstep(0.0, 0.035, vT);
  if (max(col.r, max(col.g, col.b)) < 0.004) discard;
  gl_FragColor = vec4(col, 1.0);   // pure additive (ONE, ONE)
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
