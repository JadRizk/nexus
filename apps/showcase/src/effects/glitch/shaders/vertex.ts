/** The one vertex shader: a triangle that covers the viewport, with `vUv` 0–1 across it. */
export const VERTEX_SHADER = `
attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
