import { COPY_FS } from "../shaders/copy.js";
import { SRC_FS } from "../shaders/source.js";
import type { Pass, PlannedEffect } from "./passes.js";
import { program } from "./program.js";
import type { RenderTarget } from "./renderTarget.js";
import { createRenderTarget, deleteRenderTarget } from "./renderTarget.js";

/** What one frame draws. */
export interface Frame {
  /** The shader clock, in seconds. */
  readonly time: number;
  /** Which picture the source draws (`uMode`): 0 graph, 1 bars, 2 console. */
  readonly source: number;
  /** The graph's layout seed (`uSeed`); 0 is the original layout. */
  readonly seed: number;
  /** The effect passes, in the order they are drawn; see `planPasses`. */
  readonly passes: readonly Pass[];
}

export interface Renderer {
  /** Sizes the canvas and every target to `width` × `height` device pixels. */
  resize(width: number, height: number): void;
  /** Draws the source, then each pass over the last, then the result to the canvas. */
  draw(frame: Frame): void;
}

interface Targets {
  readonly frameA: RenderTarget;
  readonly frameB: RenderTarget;
  /** The feedback pass's last output, which it reads as `uPrev`… */
  feedbackPrev: RenderTarget;
  /** …and where it copies this frame's, before the two swap. */
  feedbackNext: RenderTarget;
}

interface State {
  readonly gl: WebGLRenderingContext;
  readonly quad: WebGLBuffer | null;
  readonly sourceProgram: WebGLProgram;
  readonly copyProgram: WebGLProgram;
  readonly effectPrograms: ReadonlyMap<string, WebGLProgram>;
  width: number;
  height: number;
  /** Undefined until the first `resize`. */
  targets: Targets | undefined;
}

type UniformLookup = (name: string) => WebGLUniformLocation | null;

/** Makes `linked` current over the full-screen triangle; returns its uniform lookup. */
function bind(state: State, linked: WebGLProgram): UniformLookup {
  const { gl } = state;
  gl.useProgram(linked);
  const location = gl.getAttribLocation(linked, "aPos");
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quad);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  return (name) => gl.getUniformLocation(linked, name);
}

function resize(state: State, width: number, height: number): void {
  const { gl } = state;
  state.width = width;
  state.height = height;
  gl.canvas.width = width;
  gl.canvas.height = height;
  if (state.targets) {
    const { frameA, frameB, feedbackPrev, feedbackNext } = state.targets;
    for (const target of [frameA, frameB, feedbackPrev, feedbackNext])
      deleteRenderTarget(gl, target);
  }
  state.targets = {
    frameA: createRenderTarget(gl, width, height),
    frameB: createRenderTarget(gl, width, height),
    feedbackPrev: createRenderTarget(gl, width, height),
    feedbackNext: createRenderTarget(gl, width, height),
  };
}

function drawSource(state: State, frame: Frame, into: RenderTarget): void {
  const { gl } = state;
  gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer);
  const uniform = bind(state, state.sourceProgram);
  gl.uniform2f(uniform("uRes"), state.width, state.height);
  gl.uniform1f(uniform("uTime"), frame.time);
  gl.uniform1i(uniform("uMode"), frame.source);
  gl.uniform1f(uniform("uSeed"), frame.seed);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Draws `from` into `into` with the copy shader: the screen when `into` is null. */
function copy(state: State, from: RenderTarget, into: RenderTarget | null): void {
  const { gl } = state;
  gl.bindFramebuffer(gl.FRAMEBUFFER, into === null ? null : into.framebuffer);
  const uniform = bind(state, state.copyProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, from.texture);
  gl.uniform1i(uniform("uTex"), 0);
  gl.uniform2f(uniform("uRes"), state.width, state.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function drawPass(
  state: State,
  targets: Targets,
  pass: Pass,
  step: { read: RenderTarget; write: RenderTarget; time: number },
): void {
  const { gl } = state;
  const effectProgram = state.effectPrograms.get(pass.effect.id);
  // Every planned effect was compiled with the renderer; this only narrows the type.
  if (effectProgram === undefined) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, step.write.framebuffer);
  const uniform = bind(state, effectProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, step.read.texture);
  gl.uniform1i(uniform("uTex"), 0);
  if (pass.isFeedback) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, targets.feedbackPrev.texture);
    gl.uniform1i(uniform("uPrev"), 1);
  }
  gl.uniform2f(uniform("uRes"), state.width, state.height);
  gl.uniform1f(uniform("uTime"), step.time);
  gl.uniform1f(uniform("uAmt"), pass.amt);
  gl.uniform1f(uniform("uBurst"), 0);
  for (const [name, value] of Object.entries(pass.uniforms)) gl.uniform1f(uniform(name), value);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (pass.isFeedback) {
    copy(state, step.write, targets.feedbackNext);
    [targets.feedbackPrev, targets.feedbackNext] = [targets.feedbackNext, targets.feedbackPrev];
  }
}

function draw(state: State, frame: Frame): void {
  const { gl, targets } = state;
  // Always resized before the first frame; this only narrows the type.
  if (targets === undefined) return;
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  drawSource(state, frame, targets.frameA);
  // Each pass reads the last one's output and writes the other target.
  let read = targets.frameA;
  let write = targets.frameB;
  for (const pass of frame.passes) {
    drawPass(state, targets, pass, { read, write, time: frame.time });
    [read, write] = [write, read];
  }
  copy(state, read, null);
}

/**
 * Compiles the source, copy and every effect's program, in that order, and
 * the full-screen triangle they share. Call `resize` before the first `draw`.
 *
 * @throws {Error} When a shader fails to compile or link.
 */
export function createRenderer(
  gl: WebGLRenderingContext,
  effects: readonly PlannedEffect[],
): Renderer {
  const sourceProgram = program(gl, SRC_FS);
  const copyProgram = program(gl, COPY_FS);
  const effectPrograms = new Map<string, WebGLProgram>();
  for (const effect of effects) effectPrograms.set(effect.id, program(gl, effect.frag));

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const state: State = {
    gl,
    quad,
    sourceProgram,
    copyProgram,
    effectPrograms,
    width: 1,
    height: 1,
    targets: undefined,
  };
  return {
    resize: (width, height) => resize(state, width, height),
    draw: (frame) => draw(state, frame),
  };
}
