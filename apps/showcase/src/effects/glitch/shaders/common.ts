/**
 * The prelude every effect shader starts with. `uAmt` is the effect's master
 * mix; `uBurst` is a transient envelope the destructive effects share, so one
 * event can hit several stages at once.
 */
export const COMMON = `
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime, uAmt, uBurst;
varying vec2 vUv;
float h1(float n){ return fract(sin(n)*43758.5453123); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
`;
