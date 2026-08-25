import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import tokens from "@nexus/tokens/tokens.json";
import {
  Panel, Button, TabStrip, Slider, ToggleRow, SectionHeading, HazardRule, Wordmark, BlinkCursor,
  KeyValue, Stat, MeterRow, Glyph, LinkGlyph, GLYPH_SHAPES, useFocusTrap,
} from "@nexus/react";

/* ============================================================================
   NEXUS // CYBERDECK  —  typed knowledge graph on a CRT

   Passes: scene→RT (accumulating) · bright+blurH · blurV · composite

   The console chrome below is built from @nexus/react — it used to be a
   second hand-rolled copy of Panel/Button/Slider/Drawer (its own `cx-*` CSS
   classes) with its own retyped hex palette. Ported the same way GlitchLab
   was: the physics/shaders/render loop below are untouched.
   ========================================================================== */

// GPU buffers (Three.js colour parsing) and the canvas 2D `font` property
// used for label-width measurement both sit outside the CSSOM, so neither
// can resolve a `var(--nx-*)` custom property — they need real values. These
// are sourced from tokens.json (the same source tokens.css is generated
// from) instead of being retyped, so they can't drift from it.
const VOID = tokens.primitive.colour.void;
const ACID = tokens.primitive.colour.acid.value;
const ALARM = tokens.primitive.colour.alarm.value;
const DATA = tokens.primitive.colour.data.value;
const SODIUM = tokens.primitive.colour.sodium.value;
const PHOS = tokens.primitive.colour.phosphor.value;
// The console keeps the prototype's original "hud" grey ramp on purpose —
// like the site CRT toggle, this page opts out of the AA theme switch.
const GRID = tokens.primitive.greyRamp.hud["grey-100"];
const DIM = tokens.primitive.greyRamp.hud["grey-300"];
const MID = tokens.primitive.greyRamp.hud["grey-600"];

// Canvas measureText() cannot resolve var(--nx-font-mono) either — kept as
// the literal stack tokens.css itself expands that custom property to.
const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

/* Label tiers. A graph where every node shouts its name is unreadable, and one
   where nothing is named is unnavigable. Tier decides when a name earns screen
   space: 0 = landmark, always legible; higher tiers appear as you zoom in, or
   immediately when the node enters the active neighbourhood.
     0  ATLAS, TAG        the map's fixed points — always drawn
     1  UNRSLV            rare and consequential — from zoom 1.0
     2  SOURCE, AGENT     cross-cutting, worth finding — from zoom 1.8
     3  NODE              the bulk — only when you zoom in, or on focus     */
const TIER_ZOOM = [0, 1.0, 1.8, 3.0];

const NODE_TYPES = {
  moc:      { label: "ATLAS",  code: "ATL", tier: 0, shape: 1, color: ACID,      size: 3.6, charge: 3.2, mass: 3.4 },
  note:     { label: "NODE",   code: "NDE", tier: 3, shape: 0, color: DATA,      size: 1.7, charge: 1.0, mass: 1.0 },
  question: { label: "UNRSLV", code: "UNR", tier: 1, shape: 5, color: ALARM,     size: 2.1, charge: 1.3, mass: 0.7 },
  source:   { label: "SOURCE", code: "SRC", tier: 2, shape: 4, color: SODIUM,    size: 1.8, charge: 1.1, mass: 1.3 },
  person:   { label: "AGENT",  code: "AGT", tier: 2, shape: 3, color: "#9D7BFF", size: 2.2, charge: 1.5, mass: 1.5 },
  tag:      { label: "TAG",    code: "TAG", tier: 0, shape: 2, color: "#7CFF4F", size: 1.4, charge: 0.6, mass: 0.5 },
};
const NODE_KEYS = Object.keys(NODE_TYPES);

// Link colours are deliberately bright: the CRT composite removes ~45% of
// signal, so anything that starts dim disappears entirely on screen.
const LINK_TYPES = {
  refs:        { label: "LINK",     color: "#3AC6D4", width: 1.15, dist: 1.00, strength: 0.55, dash: 0,   arrow: 1, flow: 1.0,  curve: 0.13, jit: 0 },
  cites:       { label: "CITE",     color: SODIUM,    width: 1.40, dist: 1.35, strength: 0.40, dash: 0,   arrow: 1, flow: 0.5,  curve: 0.20, jit: 0 },
  tagged:      { label: "TAGGED",   color: ACID,      width: 0.95, dist: 0.48, strength: 0.95, dash: 2.4, arrow: 0, flow: 0,    curve: 0.05, jit: 0 },
  mentions:    { label: "MENTION",  color: "#A98BFF", width: 1.00, dist: 1.10, strength: 0.28, dash: 1.3, arrow: 1, flow: 0.3,  curve: 0.27, jit: 0 },
  contradicts: { label: "CONFLICT", color: ALARM,     width: 1.50, dist: 1.60, strength: 0.20, dash: 0,   arrow: 0, flow: -1.0, curve: 0.36, jit: 1 },
};
const LINK_KEYS = Object.keys(LINK_TYPES);
const STATE_LABEL = ["DORMANT", "STABLE", "HOT", "ORPHAN"];
const ARROW_T = 20 / 24;
const hex4 = (i) => (((i * 2654435761) >>> 0) % 65536).toString(16).toUpperCase().padStart(4, "0");

/* ============================================================================
   GRAPH
   ========================================================================== */
const W_A = ["liminal", "recursive", "brittle", "molten", "adjacent", "hollow", "umbral", "narrow", "folded", "tidal", "opaque", "severed", "grafted", "latent", "static"];
const W_B = ["threshold", "protocol", "grammar", "residue", "aperture", "scaffold", "corpus", "vector", "margin", "ledger", "atlas", "relay", "basin", "index", "cache"];
const AGENTS = ["OKONKWO", "HALVORSEN", "RIVAS", "ALDOURI", "FENN", "KAUR", "MBEKI", "OSEI", "TERZIAN", "NOVAK", "BELLO", "ITO", "MARCHETTI", "ADEYEMI"];
const SRC = ["ARXIV", "DUMP", "INTERCEPT", "FIELDLOG", "TRANSCRIPT", "DATASET", "ARCHIVE", "LEAK"];
const pick = (a) => a[(Math.random() * a.length) | 0];

function generateGraph(total) {
  const nodes = [];
  const add = (type, name) => {
    nodes.push({ type, name, state: Math.random() < 0.12 ? 2 : Math.random() < 0.18 ? 0 : 1 });
    return nodes.length - 1;
  };
  const nMoc = Math.max(3, Math.round(total * 0.032));
  const nTag = Math.max(4, Math.round(total * 0.075));
  const nPerson = Math.max(3, Math.round(total * 0.06));
  const nSource = Math.max(4, Math.round(total * 0.115));
  const nQ = Math.max(2, Math.round(total * 0.05));
  const nNote = Math.max(10, total - nMoc - nTag - nPerson - nSource - nQ);

  const mocs = [], tags = [], people = [], sources = [], questions = [], notes = [];
  for (let i = 0; i < nMoc; i++) mocs.push(add("moc", pick(W_B).toUpperCase() + "//ATLAS"));
  for (let i = 0; i < nTag; i++) tags.push(add("tag", "#" + pick(W_A)));
  for (let i = 0; i < nPerson; i++) people.push(add("person", pick(AGENTS)));
  for (let i = 0; i < nSource; i++) sources.push(add("source", pick(SRC) + "-" + (100 + ((Math.random() * 899) | 0))));
  for (let i = 0; i < nQ; i++) questions.push(add("question", "?" + pick(W_A) + "_" + pick(W_B)));
  for (let i = 0; i < nNote; i++) notes.push(add("note", pick(W_A) + "_" + pick(W_B)));

  const seen = new Set(), edges = [];
  const link = (a, b, type) => {
    if (a === b) return false;
    const k = a < b ? a * 100000 + b : b * 100000 + a;
    if (seen.has(k)) return false;
    seen.add(k); edges.push({ a, b, type }); return true;
  };
  const mocOf = new Map();
  for (const id of notes) {
    const home = mocs[(Math.random() * mocs.length) | 0];
    mocOf.set(id, home); link(home, id, "refs");
    if (Math.random() < 0.10) link(mocs[(Math.random() * mocs.length) | 0], id, "refs");
  }
  for (const id of notes) {
    const sibs = notes.filter((o) => mocOf.get(o) === mocOf.get(id));
    const k = 1 + ((Math.random() * 2.4) | 0);
    for (let j = 0; j < k && sibs.length > 1; j++) link(id, sibs[(Math.random() * sibs.length) | 0], "refs");
  }
  for (const id of notes) {
    const k = Math.random() < 0.55 ? 1 : Math.random() < 0.8 ? 2 : 0;
    for (let j = 0; j < k; j++) link(id, tags[(Math.random() * tags.length) | 0], "tagged");
  }
  for (const q of questions) link(q, tags[(Math.random() * tags.length) | 0], "tagged");
  for (const s of sources) {
    const k = 1 + ((Math.random() * 3) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0], s, "cites");
  }
  for (const p of people) {
    const k = 1 + ((Math.random() * 3.5) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0], p, "mentions");
    if (Math.random() < 0.5) link(p, sources[(Math.random() * sources.length) | 0], "cites");
  }
  for (const q of questions) {
    const k = 1 + ((Math.random() * 2) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0], q, "refs");
  }
  const nC = Math.max(2, Math.round(total * 0.022));
  for (let i = 0; i < nC; i++) {
    const a = notes[(Math.random() * notes.length) | 0], b = notes[(Math.random() * notes.length) | 0];
    if (mocOf.get(a) !== mocOf.get(b)) link(a, b, "contradicts");
  }
  const degree = new Uint16Array(nodes.length);
  for (const e of edges) { degree[e.a]++; degree[e.b]++; }
  for (let i = 0; i < nodes.length; i++) if (degree[i] === 0) nodes[i].state = 3;
  return { nodes, edges, degree };
}

/* ============================================================================
   PHYSICS
   ========================================================================== */
function createPhysics(G) {
  const n = G.nodes.length, m = G.edges.length;
  const pos = new Float32Array(n * 2), vel = new Float32Array(n * 2);
  const fx = new Float32Array(n), fy = new Float32Array(n);
  const charge = new Float32Array(n), mass = new Float32Array(n);
  const eA = new Uint32Array(m), eB = new Uint32Array(m);
  const eRest = new Float32Array(m), eK = new Float32Array(m);
  const eWA = new Float32Array(m), eWB = new Float32Array(m);

  for (let i = 0; i < n; i++) {
    const t = NODE_TYPES[G.nodes[i].type];
    charge[i] = t.charge; mass[i] = t.mass;
    const a = (i / n) * Math.PI * 10, r = 30 + Math.sqrt(i) * 9;
    pos[i * 2] = Math.cos(a) * r + (Math.random() - 0.5) * 20;
    pos[i * 2 + 1] = Math.sin(a) * r + (Math.random() - 0.5) * 20;
  }
  // Stiffness normalised by degree, or a 35-link hub diverges under Euler.
  for (let e = 0; e < m; e++) {
    const L = LINK_TYPES[G.edges[e].type], a = G.edges[e].a, b = G.edges[e].b;
    const da = Math.max(1, G.degree[a]), db = Math.max(1, G.degree[b]);
    eA[e] = a; eB[e] = b; eRest[e] = L.dist;
    eK[e] = L.strength / Math.min(da, db);
    eWA[e] = db / (da + db); eWB[e] = da / (da + db);
  }

  let alpha = 1, alphaTarget = 0, settled = false;
  const A_MIN = 0.0015, A_DECAY = 0.0208;
  const P = { repulsion: 900, linkDistance: 78, gravity: 0.028, damping: 0.62, cursorForce: 0 };
  let pinIdx = -1, pinX = 0, pinY = 0, curX = 0, curY = 0, curOn = false;

  function step() {
    if (settled && pinIdx < 0 && !(curOn && P.cursorForce !== 0)) return false;
    fx.fill(0); fy.fill(0);
    const k = P.repulsion * alpha;
    for (let i = 0; i < n; i++) {
      const xi = pos[i * 2], yi = pos[i * 2 + 1], ci = charge[i];
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j * 2] - xi, dy = pos[j * 2 + 1] - yi;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-3) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy + 1e-3; }
        const f = (k * ci * charge[j]) / (d2 * Math.sqrt(d2));
        const ax = dx * f, ay = dy * f;
        fx[i] -= ax; fy[i] -= ay; fx[j] += ax; fy[j] += ay;
      }
    }
    for (let e = 0; e < m; e++) {
      const a = eA[e], b = eB[e];
      let dx = pos[b * 2] - pos[a * 2], dy = pos[b * 2 + 1] - pos[a * 2 + 1];
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-4) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = 1e-2; }
      const f = ((d - eRest[e] * P.linkDistance) / d) * eK[e] * alpha;
      fx[a] += dx * f * eWA[e]; fy[a] += dy * f * eWA[e];
      fx[b] -= dx * f * eWB[e]; fy[b] -= dy * f * eWB[e];
    }
    const g = P.gravity * alpha, damp = P.damping, cf = P.cursorForce;
    let maxS = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2], y = pos[i * 2 + 1];
      fx[i] -= x * g; fy[i] -= y * g;
      if (curOn && cf !== 0) {
        const dx = x - curX, dy = y - curY, d2 = dx * dx + dy * dy + 60;
        const inv = (cf * 14000) / (d2 * Math.sqrt(d2));
        fx[i] += dx * inv; fy[i] += dy * inv;
      }
      const im = 1 / mass[i];
      let vx = (vel[i * 2] + fx[i] * im) * damp, vy = (vel[i * 2 + 1] + fy[i] * im) * damp;
      const s2 = vx * vx + vy * vy;
      if (s2 > 400) { const s = 20 / Math.sqrt(s2); vx *= s; vy *= s; }
      if (s2 > maxS) maxS = s2;
      vel[i * 2] = vx; vel[i * 2 + 1] = vy;
      pos[i * 2] = x + vx; pos[i * 2 + 1] = y + vy;
    }
    if (pinIdx >= 0) {
      pos[pinIdx * 2] = pinX; pos[pinIdx * 2 + 1] = pinY;
      vel[pinIdx * 2] = 0; vel[pinIdx * 2 + 1] = 0;
    }
    alpha += (alphaTarget - alpha) * A_DECAY;
    if ((alpha < A_MIN || (Math.sqrt(maxS) < 0.004 && alpha < 0.06)) && alphaTarget < A_MIN) {
      settled = true; vel.fill(0);
    }
    return true;
  }
  return {
    pos, step,
    isSettled: () => settled,
    setParams(p) {
      Object.assign(P, p);
      if ("settle" in p) alphaTarget = p.settle;
      settled = false; alpha = Math.max(alpha, 0.28);
    },
    reheat(v) { settled = false; alpha = Math.max(alpha, v); },
    pin(i, x, y) { pinIdx = i; pinX = x; pinY = y; if (i >= 0) { settled = false; alpha = Math.max(alpha, 0.35); } },
    cursor(x, y, on) { curX = x; curY = y; curOn = on; },
  };
}

/* ============================================================================
   SHADERS
   ========================================================================== */
const NODE_VS = `
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

const NODE_FS = `
precision highp float;
uniform float uTime, uGlow, uFocus;
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

  float flick = vState > 2.5
    ? (0.35 + 0.65*step(0.32, h1(vSeed*91.7 + floor(uTime*9.0)*12.9898))) : 1.0;
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

const EDGE_VS = `
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

const EDGE_FS = `
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

const FADE_VS = `precision highp float; attribute vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
const FADE_FS = `precision highp float; uniform vec3 uColor; uniform float uAlpha;
void main(){ gl_FragColor = vec4(uColor, uAlpha); }`;

const POST_VS = `precision highp float;
attribute vec2 position; attribute vec2 uv; varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const BLUR_FS = `
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

const COMPOSITE_FS = `
precision highp float;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes;
uniform float uTime, uScan, uAberr, uCurve, uGrain, uBloomAmt, uGlitch;
varying vec2 vUv;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453123); }
void main(){
  vec2 uv = vUv*2.0 - 1.0;
  vec2 off = abs(uv.yx)/vec2(6.0, 5.0);
  uv += uv*off*off*uCurve;
  uv = uv*0.5 + 0.5;

  if (uGlitch > 0.001) {
    float band = floor(uv.y*26.0);
    float r = h1(band*7.13 + floor(uTime*15.0)*3.77);
    if (r > 0.80) uv.x += (r-0.9)*0.10*uGlitch;
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
  col += vec3(0.09,0.12,0.06) * pow(max(0.0, 1.0-abs(roll-0.5)*2.0), 24.0) * uScan;
  col += (h2(uv*vec2(uRes.x, uRes.y) + floor(uTime*24.0)) - 0.5) * uGrain*0.11;
  vec2 d = uv-0.5;
  col *= 1.0 - dot(d,d)*0.78;
  gl_FragColor = vec4(col, 1.0);
}`;

/* ============================================================================
   COMPONENT
   ========================================================================== */
export default function NexusCyberdeck() {
  const mountRef = useRef(null);
  const labelRef = useRef(null);
  const api = useRef({});

  const [total, setTotal] = useState(200);
  const [seed, setSeed] = useState(0);
  const [stats, setStats] = useState({ fps: 0, nodes: 0, edges: 0, ms: 0, sim: "COOLING", drawn: 0, attribs: 0, gl: 2 });
  const [selected, setSelected] = useState(null);
  const [isolate, setIsolate] = useState(-1);
  const [running, setRunning] = useState(true);
  const [fatal, setFatal] = useState(null);
  const [tab, setTab] = useState("crt");
  const [labelMode, setLabelMode] = useState("auto");   // auto | key | all | off

  const [nodeOn, setNodeOn] = useState(() => Object.fromEntries(NODE_KEYS.map((k) => [k, true])));
  const [linkOn, setLinkOn] = useState(() => Object.fromEntries(LINK_KEYS.map((k) => [k, true])));

  const [cfg, setCfg] = useState({
    repulsion: 900, linkDistance: 78, cursorForce: 0, settle: 0,
    flowSpeed: 0.24, glow: 0.8, trails: 0.16, edgeOpacity: 0.5, edgeWidth: 2.4,
    scan: 0.55, aberr: 1.0, curve: 0.55, grain: 0.45, bloom: 0.85, glitch: 0.5,
  });
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const runRef = useRef(running); runRef.current = running;
  const nodeOnRef = useRef(nodeOn); nodeOnRef.current = nodeOn;
  const linkOnRef = useRef(linkOn); linkOnRef.current = linkOn;
  const isolateRef = useRef(isolate); isolateRef.current = isolate;
  const labelModeRef = useRef(labelMode); labelModeRef.current = labelMode;

  useEffect(() => {
    api.current.params?.({
      repulsion: cfg.repulsion, linkDistance: cfg.linkDistance,
      cursorForce: cfg.cursorForce, settle: cfg.settle,
    });
  }, [cfg.repulsion, cfg.linkDistance, cfg.cursorForce, cfg.settle]);
  useEffect(() => { api.current.refilter?.(); }, [nodeOn, linkOn, isolate]);
  useEffect(() => { api.current.select?.(selected ? selected.id : -1); }, [selected]);

  const goTo = useCallback((id) => {
    const d = api.current.getNode?.(id);
    if (!d) return;
    setSelected(d);
    api.current.focus?.(id);
    // walking the graph while isolated should move the isolation with you,
    // otherwise the node you just jumped to is the only thing you can't expand
    setIsolate((v) => (v >= 0 ? id : v));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setSelected(null); setIsolate(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mount = mountRef.current, lab = labelRef.current;
    if (!mount || !lab) return;
    let dispose = () => {};
    try { dispose = boot(mount, lab); }
    catch (err) { console.error(err); setFatal(String((err && err.message) || err)); }
    return () => { try { dispose(); } catch (e) { console.error(e); } };

    function boot(mountEl, labelEl) {
      const G = generateGraph(total);
      const n = G.nodes.length, m = G.edges.length;
      const sim = createPhysics(G);
      const pos = sim.pos;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      // Four full-screen passes at dpr 2 is a lot of fill for little gain;
      // the CRT grille and grain hide the difference anyway.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearColor(new THREE.Color(VOID), 1);
      renderer.autoClear = false;
      mountEl.appendChild(renderer.domElement);
      renderer.domElement.style.cssText =
        "display:block;touch-action:none;width:100%;height:100%";

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      camera.position.z = 5;
      let camZoom = 1;

      const nRadius = new Float32Array(n), nShape = new Float32Array(n);
      const nColor = new Float32Array(n * 3), nSeed = new Float32Array(n);
      const nDepth = new Float32Array(n).fill(-1), nState = new Float32Array(n);
      const nSel = new Float32Array(n), nHide = new Float32Array(n);
      const tc = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const t = NODE_TYPES[G.nodes[i].type];
        nRadius[i] = t.size * (1 + Math.min(1.4, Math.log2(1 + G.degree[i]) * 0.16));
        nShape[i] = t.shape; tc.set(t.color);
        nColor[i * 3] = tc.r; nColor[i * 3 + 1] = tc.g; nColor[i * 3 + 2] = tc.b;
        nSeed[i] = Math.random(); nState[i] = G.nodes[i].state;
      }
      const eAPos = new Float32Array(m * 2), eBPos = new Float32Array(m * 2);
      const eColor = new Float32Array(m * 3);
      const eP0 = new Float32Array(m * 4);   // width, curve, dash, arrow
      const eP1 = new Float32Array(m * 4);   // flow, seed, radA, radB
      const eP2 = new Float32Array(m * 3);   // active, hide, jitter
      const A_ACT = 0, A_HIDE = 1, A_JIT = 2;
      for (let e = 0; e < m; e++) {
        const L = LINK_TYPES[G.edges[e].type];
        tc.set(L.color);
        eColor[e * 3] = tc.r; eColor[e * 3 + 1] = tc.g; eColor[e * 3 + 2] = tc.b;
        eP0[e * 4] = L.width;
        eP0[e * 4 + 1] = L.curve * (e % 2 === 0 ? 1 : -1);
        eP0[e * 4 + 2] = L.dash;
        eP0[e * 4 + 3] = L.arrow;
        eP1[e * 4] = L.flow;
        eP1[e * 4 + 1] = Math.random();
        eP1[e * 4 + 2] = nRadius[G.edges[e].a] * 1.15;
        eP1[e * 4 + 3] = nRadius[G.edges[e].b] * 1.45;
        eP2[e * 3 + A_JIT] = L.jit;
      }
      const dyn = (arr, size) => {
        const a = new THREE.InstancedBufferAttribute(arr, size);
        a.setUsage(THREE.DynamicDrawUsage); return a;
      };
      const stat = (arr, size) => new THREE.InstancedBufferAttribute(arr, size);

      const SEG = 24;
      const ev = new Float32Array((SEG + 1) * 4); const ei = [];
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        ev[s * 4] = t; ev[s * 4 + 1] = -1; ev[s * 4 + 2] = t; ev[s * 4 + 3] = 1;
      }
      for (let s = 0; s < SEG; s++) { const b = s * 2; ei.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
      const edgeGeo = new THREE.InstancedBufferGeometry();
      edgeGeo.setAttribute("position", new THREE.BufferAttribute(ev, 2));
      edgeGeo.setIndex(ei);
      const aEA = dyn(eAPos, 2), aEB = dyn(eBPos, 2), aEP2 = dyn(eP2, 3);
      edgeGeo.setAttribute("iA", aEA);
      edgeGeo.setAttribute("iB", aEB);
      edgeGeo.setAttribute("iColor", stat(eColor, 3));
      edgeGeo.setAttribute("iP0", stat(eP0, 4));
      edgeGeo.setAttribute("iP1", stat(eP1, 4));
      edgeGeo.setAttribute("iP2", aEP2);
      edgeGeo.instanceCount = m;
      const edgeMat = new THREE.RawShaderMaterial({
        vertexShader: EDGE_VS, fragmentShader: EDGE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: {
          uPx: { value: 1 }, uWidth: { value: cfg.edgeWidth }, uTime: { value: 0 },
          uOpacity: { value: cfg.edgeOpacity }, uFlowSpeed: { value: cfg.flowSpeed }, uFocus: { value: 0 },
        },
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.frustumCulled = false; edgeMesh.renderOrder = 0; scene.add(edgeMesh);

      const nodeGeo = new THREE.InstancedBufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 2));
      nodeGeo.setIndex([0, 1, 2, 2, 1, 3]);
      // The JS logic keeps its readable per-node arrays; syncNodes() mirrors
      // them into the packed GPU buffers so only the upload path changed.
      const nN0 = new Float32Array(n * 4), nN1 = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        nN0[i * 4] = nRadius[i]; nN0[i * 4 + 1] = nShape[i]; nN0[i * 4 + 2] = nSeed[i];
        nN1[i * 4] = nState[i];
      }
      const aPos = dyn(pos, 2), aN0 = dyn(nN0, 4), aN1 = dyn(nN1, 4);
      function syncNodes() {
        for (let i = 0; i < n; i++) {
          nN0[i * 4 + 3] = nDepth[i];
          nN1[i * 4 + 1] = nSel[i];
          nN1[i * 4 + 2] = nHide[i];
        }
        aN0.needsUpdate = true; aN1.needsUpdate = true;
      }
      syncNodes();
      nodeGeo.setAttribute("iPos", aPos);
      nodeGeo.setAttribute("iColor", stat(nColor, 3));
      nodeGeo.setAttribute("iN0", aN0);
      nodeGeo.setAttribute("iN1", aN1);
      nodeGeo.instanceCount = n;
      const nodeMat = new THREE.RawShaderMaterial({
        vertexShader: NODE_VS, fragmentShader: NODE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        uniforms: {
          uTime: { value: 0 }, uPx: { value: 1 }, uHlStart: { value: -999 },
          uGlow: { value: cfg.glow }, uFocus: { value: 0 },
        },
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.frustumCulled = false; nodeMesh.renderOrder = 1; scene.add(nodeMesh);

      const vc = new THREE.Color(VOID);
      const fadeGeo = new THREE.BufferGeometry();
      fadeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
      const fadeMat = new THREE.RawShaderMaterial({
        vertexShader: FADE_VS, fragmentShader: FADE_FS,
        transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Vector3(vc.r, vc.g, vc.b) }, uAlpha: { value: 1 } },
      });
      const fadeMesh = new THREE.Mesh(fadeGeo, fadeMat);
      fadeMesh.frustumCulled = false; fadeMesh.renderOrder = -10; scene.add(fadeMesh);

      const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
      const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
      const bloomA = new THREE.WebGLRenderTarget(2, 2, rtOpts);
      const bloomB = new THREE.WebGLRenderTarget(2, 2, rtOpts);

      const fsGeo = new THREE.BufferGeometry();
      fsGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
      fsGeo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
      const blurMat = new THREE.RawShaderMaterial({
        vertexShader: POST_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false,
        uniforms: {
          uTex: { value: null }, uTexel: { value: new THREE.Vector2() },
          uDir: { value: new THREE.Vector2(1, 0) }, uThresh: { value: 0.34 },
        },
      });
      const compMat = new THREE.RawShaderMaterial({
        vertexShader: POST_VS, fragmentShader: COMPOSITE_FS, depthTest: false, depthWrite: false,
        uniforms: {
          uScene: { value: null }, uBloom: { value: null },
          uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
          uScan: { value: cfg.scan }, uAberr: { value: cfg.aberr }, uCurve: { value: cfg.curve },
          uGrain: { value: cfg.grain }, uBloomAmt: { value: cfg.bloom }, uGlitch: { value: 0 },
        },
      });
      const fsQuad = new THREE.Mesh(fsGeo, compMat);
      fsQuad.frustumCulled = false;
      const postScene = new THREE.Scene(); postScene.add(fsQuad);
      const postCam = new THREE.Camera();

      /* --------------------------------------------------------- label pool */
      const POOL = 60;
      const labels = [], owner = new Int32Array(POOL).fill(-1);
      for (let i = 0; i < POOL; i++) {
        const el = document.createElement("div");
        el.className = "cx-lb";
        el.style.cssText =
          "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;" +
          `font:600 9.5px/1 ${MONO};letter-spacing:.09em;text-transform:uppercase;` +
          "text-shadow:1px 0 rgba(255,46,99,.4),-1px 0 rgba(23,226,229,.4),0 0 7px rgba(0,0,0,.98);" +
          "transform:translate3d(-9999px,-9999px,0);will-change:transform;opacity:0;transition:opacity .1s";
        labelEl.appendChild(el);
        labels.push(el);
      }
      const LAB_H = 11;

      // Measure once per node instead of guessing from character count — the
      // collision test is only as good as the box it is given.
      const meas = document.createElement("canvas").getContext("2d");
      const wCache = new Float32Array(n).fill(-1);
      function labelWidth(i) {
        if (wCache[i] < 0) {
          const t = G.nodes[i].name;
          const key = NODE_TYPES[G.nodes[i].type].tier === 0;
          meas.font = key ? `700 10.5px ${MONO}` : `500 9px ${MONO}`;
          wCache[i] = meas.measureText(t).width + t.length * (key ? 1.47 : 0.72) + 7;
        }
        return wCache[i];
      }

      // Imperative tooltip. Driving this through React state re-rendered the
      // whole tree on every pointermove — 60 reconciles a second while hovering.
      const tip = document.createElement("div");
      tip.style.cssText =
        "position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;max-width:270px;" +
        "overflow:hidden;text-overflow:ellipsis;background:rgba(8,10,9,.95);border:1px solid " + GRID + ";" +
        "border-left-width:2px;padding:4px 7px;font:600 9px/1.4 " + MONO + ";letter-spacing:.11em;" +
        "text-transform:uppercase;opacity:0;transition:opacity .1s;" +
        "transform:translate3d(-9999px,-9999px,0);will-change:transform;z-index:5";
      labelEl.appendChild(tip);

      let W = 1, H = 1, px = 1;
      const bufSize = new THREE.Vector2();
      const camT = { x: 0, y: 0, zoom: 1 };
      function resize() {
        W = mountEl.clientWidth || 1; H = mountEl.clientHeight || 1;
        // updateStyle must stay on: with it off three sets canvas.width = W*dpr
        // but no CSS size, so the element lays out at W*dpr and every DOM
        // overlay is in a coordinate space half the size of the canvas.
        renderer.setSize(W, H);
        camera.left = -W / 2; camera.right = W / 2;
        camera.top = H / 2; camera.bottom = -H / 2;
        camera.updateProjectionMatrix();
        renderer.getDrawingBufferSize(bufSize);
        const bw = Math.max(2, bufSize.x | 0), bh = Math.max(2, bufSize.y | 0);
        sceneRT.setSize(bw, bh);
        const sw = Math.max(2, (bw / 3) | 0), sh = Math.max(2, (bh / 3) | 0);
        bloomA.setSize(sw, sh); bloomB.setSize(sw, sh);
        compMat.uniforms.uRes.value.set(bw, bh);
        blurMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
        renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.setRenderTarget(null);
      }
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mountEl);
      camT.zoom = camZoom = Math.min(2.2, Math.max(0.5, 420 / (Math.sqrt(n) * 14)));
      /* ------------------------------------------------- CRT screen mapping
         The composite pass samples the scene through a barrel warp, so what
         is drawn at screen position p came from scene position warp(p). Any
         DOM overlay or hit-test that ignores this drifts by up to ~13px in
         the corners — and by exactly zero on the centre axes, because the
         shader cross-couples x with |y| and y with |x|.                    */
      function crtFwd(nx, ny, c) {          // screen -> scene
        const ox = Math.abs(ny) / 6, oy = Math.abs(nx) / 5;
        return [nx + nx * ox * ox * c, ny + ny * oy * oy * c];
      }
      function crtInv(nx, ny, c) {          // scene -> screen (fixed point)
        let px = nx, py = ny;
        for (let k = 0; k < 4; k++) {
          const ox = Math.abs(py) / 6, oy = Math.abs(px) / 5;
          const a = nx - px * ox * ox * c, b = ny - py * oy * oy * c;
          px = a; py = b;
        }
        return [px, py];
      }

      /* ---------------------------------------------- one transform, one truth
         Everything on screen goes through this pair. The render path is
         ortho(zoom) -> barrel warp; project() mirrors it exactly and
         unproject() inverts it. Labels, picking and zoom-to-cursor all call
         these, so they cannot drift apart the way three hand-rolled copies did. */
      const OUT = [0, 0];

      function project(wx, wy, zoom, cx, cy) {      // world -> CSS pixels
        let nx = (wx - cx) * zoom / (W / 2);
        let ny = -(wy - cy) * zoom / (H / 2);
        const c = cfgRef.current.curve;
        if (c > 0) { const p = crtInv(nx, ny, c); nx = p[0]; ny = p[1]; }
        OUT[0] = nx * W / 2 + W / 2;
        OUT[1] = ny * H / 2 + H / 2;
        return OUT;
      }

      function unproject(sx, sy, zoom, cx, cy) {    // CSS pixels -> world
        let nx = (sx - W / 2) / (W / 2), ny = (sy - H / 2) / (H / 2);
        const c = cfgRef.current.curve;
        if (c > 0) { const p = crtFwd(nx, ny, c); nx = p[0]; ny = p[1]; }
        return { x: (nx * W / 2) / zoom + cx, y: -(ny * H / 2) / zoom + cy };
      }

      // Mirrors the vertex shader's minimum-size clamp so the label gap stays
      // constant in pixels instead of collapsing into the node when zoomed out.
      // span = r*3.2 and the SDF glyph sits at R=0.285 of that -> 0.912*r.
      function glyphRadiusPx(i) {
        return Math.max(nRadius[i] * camZoom, 2.2) * 0.912;
      }

      const toWorld = (sx, sy) => unproject(sx, sy, camZoom, camera.position.x, camera.position.y);

      const inc = Array.from({ length: n }, () => []);
      for (let e = 0; e < m; e++) {
        inc[G.edges[e].a].push({ e, other: G.edges[e].b, type: G.edges[e].type, out: true });
        inc[G.edges[e].b].push({ e, other: G.edges[e].a, type: G.edges[e].type, out: false });
      }

      let selIdx = -1, hoverIdx = -1, clock = 0, glitchUntil = -1, drawnLinks = m;

      // If the edge program ever fails to link again, this makes it obvious
      // instead of silent: compare slots used against what the driver allows.
      const glc = renderer.getContext();
      const glCaps = {
        attribs: glc.getParameter(glc.MAX_VERTEX_ATTRIBS),
        ver: renderer.capabilities.isWebGL2 ? 2 : 1,
      };
      const kick = (d) => { glitchUntil = clock + d; };

      function refilter() {
        const NO = nodeOnRef.current, LO = linkOnRef.current, iso = isolateRef.current;
        let allow = null;
        if (iso >= 0 && iso < n) {
          allow = new Set([iso]);
          for (const it of inc[iso]) allow.add(it.other);
        }
        for (let i = 0; i < n; i++) {
          nHide[i] = (!NO[G.nodes[i].type] || (allow && !allow.has(i))) ? 1 : 0;
        }
        let shown = 0;
        for (let e = 0; e < m; e++) {
          const vis = LO[G.edges[e].type] && !nHide[G.edges[e].a] && !nHide[G.edges[e].b];
          eP2[e * 3 + A_HIDE] = vis ? 0 : 1;
          if (vis) shown++;
        }
        drawnLinks = shown;
        syncNodes(); aEP2.needsUpdate = true;
      }
      refilter();

      function highlight(idx) {
        nDepth.fill(-1);
        for (let e = 0; e < m; e++) eP2[e * 3 + A_ACT] = 0;
        if (idx >= 0) {
          const q = [idx]; nDepth[idx] = 0;
          for (let h = 0; h < q.length; h++) {
            const v = q[h], d = nDepth[v];
            if (d >= 3) continue;
            for (const it of inc[v]) {
              if (nDepth[it.other] < -0.5 && !nHide[it.other]) { nDepth[it.other] = d + 1; q.push(it.other); }
            }
          }
          for (const it of inc[idx]) eP2[it.e * 3 + A_ACT] = 1;
          nodeMat.uniforms.uHlStart.value = clock;
        }
        syncNodes(); aEP2.needsUpdate = true;
        const f = idx >= 0 ? 1 : 0;
        nodeMat.uniforms.uFocus.value = f; edgeMat.uniforms.uFocus.value = f;
      }
      function showTip(idx, sx, sy) {
        if (idx < 0 || idx === selIdx) { tip.style.opacity = "0"; tip.dataset.k = ""; return; }
        const t = NODE_TYPES[G.nodes[idx].type];
        if (tip.dataset.k !== String(idx)) {
          tip.dataset.k = String(idx);
          tip.textContent = "";
          const a = document.createElement("span");
          a.style.color = t.color; a.textContent = G.nodes[idx].name;
          const b = document.createElement("span");
          b.style.color = DIM; b.textContent = " \u00B7 " + t.code + " \u00B7 " + G.degree[idx];
          tip.appendChild(a); tip.appendChild(b);
          tip.style.borderLeftColor = t.color;
        }
        tip.style.transform = "translate3d(" + ((sx + 16) | 0) + "px," + ((sy + 14) | 0) + "px,0)";
        tip.style.opacity = "1";
      }

      function marks() {
        nSel.fill(0);
        if (hoverIdx >= 0) nSel[hoverIdx] = 1;
        if (selIdx >= 0) nSel[selIdx] = 2;
        syncNodes();
      }
      function applySelection(idx) {
        selIdx = idx;
        if (idx >= 0) kick(0.22);
        marks();
        highlight(idx >= 0 ? idx : hoverIdx);
        if (idx >= 0 && idx === hoverIdx) showTip(-1, 0, 0);
      }
      const describe = (i) => {
        const groups = LINK_KEYS.map((k) => ({
          key: k,
          rows: inc[i].filter((x) => x.type === k).map((x) => ({
            id: x.other, name: G.nodes[x.other].name, type: G.nodes[x.other].type, out: x.out,
          })).sort((a, b) => a.name.localeCompare(b.name)),
        })).filter((g) => g.rows.length);
        return {
          id: i, name: G.nodes[i].name, type: G.nodes[i].type, hex: hex4(i),
          state: STATE_LABEL[G.nodes[i].state], degree: G.degree[i], groups,
        };
      };

      api.current.params = (p) => sim.setParams(p);
      api.current.refilter = () => { refilter(); highlight(selIdx >= 0 ? selIdx : hoverIdx); kick(0.14); };
      api.current.select = (i) => applySelection(i);
      api.current.reheat = () => { sim.reheat(1.0); kick(0.3); };
      api.current.getNode = (i) => (i >= 0 && i < n ? describe(i) : null);
      api.current.fit = () => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
        for (let i = 0; i < n; i++) {
          if (nHide[i]) continue;
          any = true;
          const x = pos[i * 2], y = pos[i * 2 + 1];
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (!any) return;
        const gw = Math.max(1, x1 - x0), gh = Math.max(1, y1 - y0);
        camT.x = (x0 + x1) / 2; camT.y = (y0 + y1) / 2;
        camT.zoom = Math.min(16, Math.max(0.12, Math.min(W / (gw * 1.35), H / (gh * 1.35))));
      };
      api.current.focus = (i) => {
        if (i < 0 || i >= n) return;
        camT.x = pos[i * 2]; camT.y = pos[i * 2 + 1];
        camT.zoom = Math.max(camT.zoom, 2.6);
      };

      let drag = -1, panning = false, moved = false, lastP = { x: 0, y: 0 };
      const el = renderer.domElement;
      function pickNode(wx, wy) {
        let best = -1, bd = Infinity;
        const grab = Math.max(5, 12 / camZoom);
        for (let i = 0; i < n; i++) {
          if (nHide[i]) continue;
          const dx = pos[i * 2] - wx, dy = pos[i * 2 + 1] - wy;
          const d2 = dx * dx + dy * dy, r = nRadius[i] + grab;
          if (d2 < r * r && d2 < bd) { bd = d2; best = i; }
        }
        return best;
      }
      const onMove = (ev) => {
        const rc = el.getBoundingClientRect();
        const sx = ev.clientX - rc.left, sy = ev.clientY - rc.top, w = toWorld(sx, sy);
        sim.cursor(w.x, w.y, true);
        if (drag >= 0) { sim.pin(drag, w.x, w.y); moved = true; return; }
        if (panning) {
          camera.position.x -= (sx - lastP.x) / camZoom;
          camera.position.y += (sy - lastP.y) / camZoom;
          camT.x = camera.position.x; camT.y = camera.position.y;
          lastP = { x: sx, y: sy }; moved = true; return;
        }
        const idx = pickNode(w.x, w.y);
        if (idx !== hoverIdx) {
          hoverIdx = idx;
          marks();
          if (selIdx < 0) highlight(idx);
          el.style.cursor = idx >= 0 ? "crosshair" : "grab";
        }
        showTip(idx, sx, sy);
      };
      const onDown = (ev) => {
        try { el.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
        const rc = el.getBoundingClientRect();
        const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
        const idx = pickNode(w.x, w.y);
        moved = false;
        if (idx >= 0) { drag = idx; sim.pin(idx, w.x, w.y); }
        else { panning = true; lastP = { x: ev.clientX - rc.left, y: ev.clientY - rc.top }; }
        el.style.cursor = "grabbing";
      };
      const onUp = () => {
        if (drag >= 0) sim.pin(-1, 0, 0);
        drag = -1; panning = false;
        el.style.cursor = hoverIdx >= 0 ? "crosshair" : "grab";
      };
      const onClick = (ev) => {
        if (moved) return;
        const rc = el.getBoundingClientRect();
        const w = toWorld(ev.clientX - rc.left, ev.clientY - rc.top);
        const idx = pickNode(w.x, w.y);
        const next = idx >= 0 && idx !== selIdx ? idx : -1;
        setSelected(next >= 0 ? describe(next) : null);
      };
      const onWheel = (ev) => {
        ev.preventDefault();
        const rc = el.getBoundingClientRect();
        const sx = ev.clientX - rc.left, sy = ev.clientY - rc.top;
        // Anchor against the TARGET camera, not the smoothed one. Solving
        // against a lagging camera makes fast scrolls compound their error.
        const b = unproject(sx, sy, camT.zoom, camT.x, camT.y);
        camT.zoom = Math.min(16, Math.max(0.12, camT.zoom * Math.exp(-ev.deltaY * 0.0015)));
        const a = unproject(sx, sy, camT.zoom, camT.x, camT.y);
        camT.x += b.x - a.x;
        camT.y += b.y - a.y;
      };
      const onLeave = () => {
        sim.cursor(0, 0, false); hoverIdx = -1; marks(); showTip(-1, 0, 0);
        if (selIdx < 0) highlight(-1);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("click", onClick);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("wheel", onWheel, { passive: false });
      el.style.cursor = "grab";

      let raf = 0, last = performance.now(), accum = 0, dirty = true;
      let fA = 0, fN = 0, fT = 0;
      const boxes = [], screenPos = new Map();

      function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now; clock += dt;
        const t0 = performance.now();
        const c = cfgRef.current;

        let didStep = false;
        if (runRef.current || drag >= 0) {
          accum += dt; let s = 0;
          while (accum >= 1 / 60 && s < 3) { if (sim.step()) didStep = true; accum -= 1 / 60; s++; }
          if (didStep) { aPos.needsUpdate = true; dirty = true; }
        } else accum = 0;

        const sp = 1 - Math.pow(0.0045, dt);
        camera.position.x += (camT.x - camera.position.x) * sp;
        camera.position.y += (camT.y - camera.position.y) * sp;
        camZoom += (camT.zoom - camZoom) * sp;
        camera.zoom = camZoom; camera.updateProjectionMatrix();
        px = 1 / camZoom;

        if (dirty) {
          for (let e = 0; e < m; e++) {
            const a = G.edges[e].a, b = G.edges[e].b;
            eAPos[e * 2] = pos[a * 2]; eAPos[e * 2 + 1] = pos[a * 2 + 1];
            eBPos[e * 2] = pos[b * 2]; eBPos[e * 2 + 1] = pos[b * 2 + 1];
          }
          aEA.needsUpdate = true; aEB.needsUpdate = true;
          dirty = didStep;
        }

        nodeMat.uniforms.uTime.value = clock;
        nodeMat.uniforms.uPx.value = px;
        nodeMat.uniforms.uGlow.value = c.glow;
        edgeMat.uniforms.uTime.value = clock;
        edgeMat.uniforms.uPx.value = px;
        edgeMat.uniforms.uWidth.value = c.edgeWidth;
        edgeMat.uniforms.uOpacity.value = c.edgeOpacity;
        edgeMat.uniforms.uFlowSpeed.value = c.flowSpeed;
        fadeMat.uniforms.uAlpha.value = 1 - c.trails * 0.94;

        if (c.glitch > 0 && clock > glitchUntil && Math.random() < 0.0022 * c.glitch) kick(0.10 + Math.random() * 0.22);
        const gActive = clock < glitchUntil ? c.glitch : 0;

        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);

        blurMat.uniforms.uTex.value = sceneRT.texture;
        blurMat.uniforms.uDir.value.set(1, 0);
        blurMat.uniforms.uThresh.value = 0.34;
        fsQuad.material = blurMat;
        renderer.setRenderTarget(bloomA); renderer.clear(); renderer.render(postScene, postCam);
        blurMat.uniforms.uTex.value = bloomA.texture;
        blurMat.uniforms.uDir.value.set(0, 1);
        blurMat.uniforms.uThresh.value = 0.0;
        renderer.setRenderTarget(bloomB); renderer.clear(); renderer.render(postScene, postCam);

        compMat.uniforms.uScene.value = sceneRT.texture;
        compMat.uniforms.uBloom.value = bloomB.texture;
        compMat.uniforms.uTime.value = clock;
        compMat.uniforms.uScan.value = c.scan;
        compMat.uniforms.uAberr.value = c.aberr;
        compMat.uniforms.uCurve.value = c.curve;
        compMat.uniforms.uGrain.value = c.grain;
        compMat.uniforms.uBloomAmt.value = c.bloom;
        compMat.uniforms.uGlitch.value = gActive;
        fsQuad.material = compMat;
        renderer.setRenderTarget(null); renderer.clear(); renderer.render(postScene, postCam);

        /* ------------------------------------------------- label placement
           Anchored via project(), so the label sits at the node's *drawn*
           position and its gap is a constant number of pixels at any zoom.
           A leader tick makes the association explicit when nodes crowd.   */
        boxes.length = 0; screenPos.clear();
        const mode = labelModeRef.current;
        if (mode !== "off") {
          const cx = camera.position.x, cy = camera.position.y;
          const hw = W / 2 * px * 1.15, hh = H / 2 * px * 1.15;
          const focused = selIdx >= 0 || hoverIdx >= 0;
          const cand = [];
          for (let i = 0; i < n; i++) {
            if (nHide[i]) continue;
            const x = pos[i * 2], y = pos[i * 2 + 1];
            if (Math.abs(x - cx) > hw || Math.abs(y - cy) > hh) continue;

            const T = NODE_TYPES[G.nodes[i].type];
            const isTarget = i === selIdx || i === hoverIdx;
            const inFlow = nDepth[i] >= 0;          // inside the active neighbourhood
            const landmark = T.tier === 0;

            // Three ways to earn a name: you're the target, you're in the
            // active flow, or your tier has come into range at this zoom.
            let earns;
            if (mode === "all") earns = true;
            else if (mode === "key") earns = landmark || isTarget || nDepth[i] === 1;
            else earns = isTarget || inFlow || camZoom >= TIER_ZOOM[T.tier];
            if (!earns) continue;

            // While something is focused, everything outside the flow steps
            // back — except landmarks, which you need to keep your bearings.
            if (focused && !inFlow && !isTarget && !landmark) continue;

            let sc = nRadius[i] + (3 - T.tier) * 9;
            if (inFlow) sc += nDepth[i] === 1 ? 70 : 30;
            if (i === hoverIdx) sc += 1e4;
            if (i === selIdx) sc += 2e4;
            cand.push([sc, i]);
          }
          cand.sort((a, b) => b[0] - a[0]);
          for (let k = 0; k < cand.length && screenPos.size < POOL; k++) {
            const i = cand[k][1];
            const sp2 = project(pos[i * 2], pos[i * 2 + 1], camZoom, cx, cy);
            const sx = sp2[0], sy = sp2[1];
            if (sx < -60 || sx > W + 60 || sy < -24 || sy > H + 24) continue;
            const bx = sx + glyphRadiusPx(i) + 8;
            const by = sy - LAB_H * 0.5;
            const bw = labelWidth(i);
            let hit = false;
            for (let q = 0; q < boxes.length; q++) {
              const p = boxes[q];
              if (bx < p[0] + p[2] && bx + bw > p[0] && by < p[1] + LAB_H && by + LAB_H > p[1]) { hit = true; break; }
            }
            if (hit) continue;
            const T2 = NODE_TYPES[G.nodes[i].type];
            const op = (i === selIdx || i === hoverIdx) ? 1
              : nDepth[i] >= 0 ? 0.92
              : (selIdx >= 0 || hoverIdx >= 0) ? 0.28     // landmark, holding position
              : T2.tier === 0 ? 0.82 : 0.52;
            boxes.push([bx, by, bw]);
            screenPos.set(i, [bx, by, op, T2.tier === 0 ? 1 : 0]);
          }
        }
        for (let k = 0; k < POOL; k++) {
          if (owner[k] >= 0 && !screenPos.has(owner[k])) { owner[k] = -1; labels[k].style.opacity = "0"; }
        }
        const held = new Set();
        for (let k = 0; k < POOL; k++) if (owner[k] >= 0) held.add(owner[k]);
        let free = 0;
        for (const id of screenPos.keys()) {
          if (held.has(id)) continue;
          while (free < POOL && owner[free] >= 0) free++;
          if (free >= POOL) break;
          owner[free] = id;
          const T3 = NODE_TYPES[G.nodes[id].type];
          const L3 = labels[free];
          L3.textContent = G.nodes[id].name;
          L3.style.color = T3.color;
          // Landmarks read heavier so the eye can find structure without
          // parsing every name on screen.
          L3.style.fontSize = T3.tier === 0 ? "10.5px" : "9px";
          L3.style.fontWeight = T3.tier === 0 ? "700" : "500";
          L3.style.letterSpacing = T3.tier === 0 ? ".16em" : ".08em";
          held.add(id);
        }
        for (let k = 0; k < POOL; k++) {
          const id = owner[k];
          if (id < 0) continue;
          const p = screenPos.get(id);
          labels[k].style.transform = `translate3d(${p[0] | 0}px,${p[1] | 0}px,0)`;
          labels[k].style.opacity = String(p[2]);
        }

        fA += 1 / Math.max(dt, 1e-4); fN++; fT += dt;
        if (fT > 0.5) {
          setStats({ fps: Math.round(fA / fN), nodes: n, edges: m,
            ms: +(performance.now() - t0).toFixed(2), sim: sim.isSettled() ? "LOCKED" : "COOLING",
            drawn: drawnLinks, attribs: glCaps.attribs, gl: glCaps.ver });
          fA = 0; fN = 0; fT = 0;
        }
      }
      raf = requestAnimationFrame(frame);

      return function cleanup() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        el.removeEventListener("click", onClick);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("wheel", onWheel);
        labels.forEach((l) => l.remove());
        tip.remove();
        [nodeGeo, edgeGeo, fadeGeo, fsGeo].forEach((g) => g.dispose());
        [nodeMat, edgeMat, fadeMat, blurMat, compMat].forEach((mm) => mm.dispose());
        [sceneRT, bloomA, bloomB].forEach((rt) => rt.dispose());
        renderer.dispose();
        if (el.parentNode) el.parentNode.removeChild(el);
        api.current = {};
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, seed]);

  const set = useCallback((k, v) => setCfg((p) => ({ ...p, [k]: v })), []);

  if (fatal) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "var(--nx-bg-canvas)", color: "var(--nx-fg-default)",
        padding: "var(--nx-space-8)", fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-sm)", lineHeight: 1.8,
      }}>
        <div style={{ color: "var(--nx-fg-critical)", letterSpacing: "var(--nx-track-wider)", marginBottom: "var(--nx-space-4)" }}>▚ SYSTEM HALT</div>
        <div>{fatal}</div>
      </div>
    );
  }

  return (
    <div data-nx-theme="hud" style={{
      position: "relative", width: "100%", height: "100%", background: "var(--nx-bg-canvas)", overflow: "hidden",
    }}>
      {/* Leader tick for the imperatively-created label pool (see the mount
          effect above) — a pseudo-element on a dynamically created DOM node
          has no other way to be styled, so this one rule stays local. */}
      <style>{`.cx-lb::before { content:""; position:absolute; left:-8px; top:50%; width:7px; height:1px; background:currentColor; opacity:.5; }`}</style>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={labelRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {/* -------------------------------------------------- left: console+legend */}
      <div style={{
        position: "absolute", top: "var(--nx-space-5)", left: "var(--nx-space-5)", width: 218,
        display: "flex", flexDirection: "column", gap: "var(--nx-space-3)",
        maxHeight: "calc(100% - var(--nx-space-6))", overflowY: "auto", scrollbarWidth: "none",
      }}>
        <Panel style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
            <span style={{
              fontFamily: "var(--nx-font-stencil)", fontSize: "var(--nx-text-xl)", lineHeight: 0.8,
              color: stats.fps > 50 ? "var(--nx-fg-accent)" : stats.fps > 28 ? "var(--nx-fg-warning)" : "var(--nx-fg-critical)",
            }}>{stats.fps}</span>
          </div>
          <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)" }}>
            CYBERDECK v2.6 <BlinkCursor />
          </div>
          <HazardRule style={{ margin: "var(--nx-space-3) 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px var(--nx-space-4)" }}>
            <KeyValue label="NODES" value={stats.nodes} />
            <KeyValue label="LINKS" value={stats.edges} />
            <KeyValue label="DRAWN" value={stats.drawn} />
            <KeyValue label="FRAME" value={stats.ms} />
            <KeyValue label="SOLVER" value={<span style={{ color: stats.sim === "LOCKED" ? "var(--nx-fg-accent)" : "var(--nx-fg-warning)" }}>{stats.sim}</span>} />
            <KeyValue label="VTXATTR" value={<span style={{ color: stats.attribs >= 8 ? "var(--nx-fg-muted)" : "var(--nx-fg-critical)" }}>{stats.attribs}/7</span>} />
          </div>

          <div style={{ margin: "var(--nx-space-4) 0 var(--nx-space-3)" }}>
            <TabStrip
              value={tab}
              onChange={setTab}
              label="Optics or solver controls"
              tabs={[{ value: "crt", label: "Optics" }, { value: "sim", label: "Solver" }]}
            />
          </div>

          {tab === "crt" ? (
            <>
              <Slider label="scanlines" value={cfg.scan} min={0} max={1} step={0.02} onChange={(v) => set("scan", v)} format={(x) => x.toFixed(2)} />
              <Slider label="aberration" value={cfg.aberr} min={0} max={3} step={0.05} onChange={(v) => set("aberr", v)} format={(x) => x.toFixed(2)} />
              <Slider label="curvature" value={cfg.curve} min={0} max={1.6} step={0.02} onChange={(v) => set("curve", v)} format={(x) => x.toFixed(2)} />
              <Slider label="bloom" value={cfg.bloom} min={0} max={2.5} step={0.05} onChange={(v) => set("bloom", v)} format={(x) => x.toFixed(2)} />
              <Slider label="grain" value={cfg.grain} min={0} max={1.5} step={0.02} onChange={(v) => set("grain", v)} format={(x) => x.toFixed(2)} />
              <Slider label="glitch" value={cfg.glitch} min={0} max={2} step={0.05} onChange={(v) => set("glitch", v)} format={(x) => x.toFixed(2)} />
              <Slider label="persistence" value={cfg.trails} min={0} max={0.92} step={0.01} onChange={(v) => set("trails", v)} format={(x) => x.toFixed(2)} />
              <Slider label="packet rate" value={cfg.flowSpeed} min={0} max={1} step={0.01} onChange={(v) => set("flowSpeed", v)} format={(x) => x.toFixed(2)} />
            </>
          ) : (
            <>
              <Slider label="link width" value={cfg.edgeWidth} min={0.6} max={5} step={0.1} onChange={(v) => set("edgeWidth", v)} format={(x) => x.toFixed(1)} />
              <Slider label="link gain" value={cfg.edgeOpacity} min={0} max={2.5} step={0.05} onChange={(v) => set("edgeOpacity", v)} format={(x) => x.toFixed(2)} />
              <Slider label="node glow" value={cfg.glow} min={0} max={2.5} step={0.05} onChange={(v) => set("glow", v)} format={(x) => x.toFixed(2)} />
              <Slider label="repulsion" value={cfg.repulsion} min={100} max={2200} step={20} onChange={(v) => set("repulsion", v)} />
              <Slider label="link length" value={cfg.linkDistance} min={20} max={200} step={2} onChange={(v) => set("linkDistance", v)} />
              <Slider label="cursor field" value={cfg.cursorForce} min={-1} max={1} step={0.05} onChange={(v) => set("cursorForce", v)} format={(x) => x.toFixed(2)} />
              <Slider label="drift" value={cfg.settle} min={0} max={0.06} step={0.002} onChange={(v) => set("settle", v)} format={(x) => (x === 0 ? "LOCK" : x.toFixed(3))} />
              <Slider label="corpus size" value={total} min={60} max={600} step={20}
                onChange={(v) => { setSelected(null); setIsolate(-1); setTotal(v); }} />
            </>
          )}

          <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)", textTransform: "uppercase", marginBottom: "var(--nx-space-1)" }}>names</div>
          <TabStrip
            value={labelMode}
            onChange={setLabelMode}
            label="Label mode"
            tabs={[{ value: "auto", label: "Auto" }, { value: "key", label: "Key" }, { value: "all", label: "All" }, { value: "off", label: "Off" }]}
          />

          <div style={{ display: "flex", gap: "var(--nx-space-2)", marginTop: "var(--nx-space-3)" }}>
            <Button style={{ flex: 1 }} onClick={() => api.current.fit?.()}>Fit</Button>
            <Button style={{ flex: 1 }} onClick={() => api.current.reheat?.()}>Reheat</Button>
            <Button style={{ flex: 1 }} onClick={() => setRunning((r) => !r)}>{running ? "Halt" : "Run"}</Button>
            <Button style={{ flex: 1 }} onClick={() => { setSelected(null); setIsolate(-1); setSeed((s) => s + 1); }}>Reseed</Button>
          </div>
        </Panel>

        <Panel style={{ flexShrink: 0 }}>
          <SectionHeading>/// entity class</SectionHeading>
          {NODE_KEYS.map((k) => (
            <ToggleRow
              key={k}
              checked={!!nodeOn[k]}
              onChange={(v) => setNodeOn((p) => ({ ...p, [k]: v }))}
              icon={<Glyph shape={GLYPH_SHAPES[NODE_TYPES[k].shape]} colour={NODE_TYPES[k].color} muted={!nodeOn[k]} />}
              label={NODE_TYPES[k].label}
              meta={NODE_TYPES[k].tier === 0 ? "ALWAYS" : `z${TIER_ZOOM[NODE_TYPES[k].tier].toFixed(1)}`}
            />
          ))}
          <div style={{ height: "var(--nx-space-3)" }} />
          <SectionHeading>/// relation</SectionHeading>
          {LINK_KEYS.map((k) => (
            <ToggleRow
              key={k}
              checked={!!linkOn[k]}
              onChange={(v) => setLinkOn((p) => ({ ...p, [k]: v }))}
              icon={<LinkGlyph colour={LINK_TYPES[k].color} dashed={!!LINK_TYPES[k].dash} arrow={!!LINK_TYPES[k].arrow} width={LINK_TYPES[k].width * 1.05} muted={!linkOn[k]} />}
              label={LINK_TYPES[k].label}
            />
          ))}
        </Panel>
      </div>

      {/* ------------------------------------------------------------- drawer */}
      <InspectorDrawer
        selected={selected}
        onClose={() => { setSelected(null); setIsolate(-1); }}
        isolate={isolate}
        onIsolate={() => setIsolate((v) => (v === selected.id ? -1 : selected.id))}
        onFocus={() => api.current.focus?.(selected?.id)}
        onGoTo={goTo}
      />

      {/* ------------------------------------------------------------ hint bar */}
      <div style={{
        position: "absolute", bottom: "var(--nx-space-4)", left: "50%", transform: "translateX(-50%)",
        fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)",
        color: "var(--nx-fg-disabled)", textTransform: "uppercase", pointerEvents: "none", whiteSpace: "nowrap",
      }}>
        click lock · drag pan · scroll zoom · esc clear
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- bits
   The node/edge inspector. Positioned `absolute` within this page's own
   full-bleed root rather than the real <Drawer> component's `fixed`
   viewport anchoring — this console sits below the site's sticky header, so
   a viewport-fixed drawer would render partway behind it. Reuses
   useFocusTrap directly to get the same focus-trap/Escape/restore behaviour
   as <Drawer> without inheriting its positioning. */
function InspectorDrawer({ selected, onClose, isolate, onIsolate, onFocus, onGoTo }) {
  const trapRef = useFocusTrap(!!selected, onClose);
  const titleId = React.useId();
  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={selected ? titleId : undefined}
      aria-hidden={selected ? undefined : true}
      tabIndex={-1}
      style={{
        position: "absolute", top: "var(--nx-space-5)", right: "var(--nx-space-5)", bottom: "var(--nx-space-5)",
        width: 296, display: "flex", flexDirection: "column",
        transform: selected ? "translateX(0)" : "translateX(324px)",
        opacity: selected ? 1 : 0, pointerEvents: selected ? "auto" : "none",
        transition: "transform var(--nx-dur-panel) var(--nx-ease), opacity var(--nx-dur-fade) linear",
      }}
    >
      {selected && (
        <Panel padded={false} raised style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          <div style={{ padding: "var(--nx-space-5)", borderBottom: "var(--nx-hairline) solid var(--nx-border-default)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--nx-space-3)" }}>
              <div style={{ paddingTop: 2 }}>
                <Glyph shape={GLYPH_SHAPES[NODE_TYPES[selected.type].shape]} colour={NODE_TYPES[selected.type].color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div id={titleId} style={{
                  color: NODE_TYPES[selected.type].color, fontFamily: "var(--nx-font-mono)", fontSize: "var(--nx-text-md)",
                  fontWeight: 700, letterSpacing: "var(--nx-track-normal)", textTransform: "uppercase", wordBreak: "break-all",
                }}>{selected.name}</div>
                <div style={{ color: "var(--nx-fg-tertiary)", marginTop: "var(--nx-space-1)", letterSpacing: "var(--nx-track-wide)" }}>
                  0x{selected.hex} · {NODE_TYPES[selected.type].code}
                </div>
              </div>
              <Button onClick={onClose} aria-label="Close details" style={{ padding: "3px 6px", lineHeight: 1 }}>✕</Button>
            </div>
          </div>
          <HazardRule style={{ flexShrink: 0 }} />

          <div style={{
            padding: "var(--nx-space-4) var(--nx-space-5)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: "var(--nx-space-3)", borderBottom: "var(--nx-hairline) solid var(--nx-border-default)", flexShrink: 0,
          }}>
            {/* CLASS carries the node's own category colour, which sits outside
                the closed Tone enum (violet/lime aren't semantic tones) — same
                markup Stat renders internally, with an explicit colour instead. */}
            <div>
              <div style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)", marginBottom: "var(--nx-space-1)", textTransform: "uppercase" }}>CLASS</div>
              <div style={{ color: NODE_TYPES[selected.type].color, fontSize: "var(--nx-text-xs)", letterSpacing: "var(--nx-track-normal)" }}>{NODE_TYPES[selected.type].label}</div>
            </div>
            <Stat label="STATE" value={selected.state} tone={selected.state === "HOT" ? "warning" : selected.state === "ORPHAN" ? "critical" : "default"} />
            <Stat label="DEGREE" value={String(selected.degree)} />
          </div>

          <div style={{ padding: "var(--nx-space-4) var(--nx-space-5) var(--nx-space-1)", flexShrink: 0 }}>
            <SectionHeading>/// relation profile</SectionHeading>
            {selected.groups.map((g) => (
              <MeterRow key={g.key} label={LINK_TYPES[g.key].label} value={g.rows.length} total={selected.degree} colour={LINK_TYPES[g.key].color} />
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--nx-space-2) var(--nx-space-5) var(--nx-space-4)" }}>
            <SectionHeading>/// adjacency [{selected.degree}]</SectionHeading>
            {selected.groups.map((g) => (
              <div key={g.key} style={{ marginBottom: "var(--nx-space-3)" }}>
                <div style={{ color: LINK_TYPES[g.key].color, fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)", opacity: 0.75, margin: "var(--nx-space-2) 0" }}>
                  {LINK_TYPES[g.key].label}
                </div>
                {g.rows.map((r) => (
                  <button key={r.id} type="button" className="nx-row" onClick={() => onGoTo(r.id)}
                    style={{ width: "100%", background: "none", border: 0, textAlign: "left", paddingLeft: 0 }}>
                    <span aria-hidden="true" style={{ color: LINK_TYPES[g.key].color, width: 8, flexShrink: 0 }}>{r.out ? "▸" : "◂"}</span>
                    <Glyph shape={GLYPH_SHAPES[NODE_TYPES[r.type].shape]} colour={NODE_TYPES[r.type].color} size={10} />
                    <span style={{
                      flex: 1, color: NODE_TYPES[r.type].color, textTransform: "uppercase",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "var(--nx-track-tight)",
                    }}>{r.name}</span>
                    <span style={{ color: "var(--nx-fg-disabled)", fontSize: "var(--nx-text-2xs)", flexShrink: 0 }}>{NODE_TYPES[r.type].code}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "var(--nx-space-2)", padding: "var(--nx-space-4) var(--nx-space-5)", borderTop: "var(--nx-hairline) solid var(--nx-border-default)", flexShrink: 0 }}>
            <Button style={{ flex: 1 }} onClick={onFocus}>Focus</Button>
            <Button style={{ flex: 1 }} active={isolate === selected.id} onClick={onIsolate}>
              {isolate === selected.id ? "Restore" : "Isolate"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
