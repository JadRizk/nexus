import { VERTEX_SHADER } from "../shaders/vertex.js";

/**
 * Compiles one shader stage.
 *
 * @param type `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.
 * @throws {Error} With the driver's log, when it fails to compile.
 */
export function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  // Null only on a lost context. Passed on unchecked, as it always has been:
  // the next call then throws, and the engine reports that.
  const shader = gl.createShader(type) as WebGLShader;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "shader compile failed");
  }
  return shader;
}

/**
 * Links `fragment` with the shared full-screen vertex shader.
 *
 * @throws {Error} When either stage fails to compile or the program fails to link.
 */
export function program(gl: WebGLRenderingContext, fragment: string): WebGLProgram {
  // As in `compile`: null only on a lost context, and left to throw below.
  const linked = gl.createProgram() as WebGLProgram;
  const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(linked, vertexShader);
  gl.attachShader(linked, fragmentShader);
  gl.linkProgram(linked);
  if (!gl.getProgramParameter(linked, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(linked) || "link failed");
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return linked;
}
