/** How three objects read in a recording: by shader export and constant name. */
import type * as Three from "three";
import * as shaders from "../shaders.js";

/** Shader source → its export name, so a mesh reads as `EDGE`, not as GLSL. */
const SHADER_NAMES = new Map<unknown, string>(
  Object.entries(shaders).map(([name, source]) => [source, name] as const),
);

/**
 * Both stages, so swapping either one reads as a rename: `EDGE` for
 * `EDGE_VS` + `EDGE_FS`, `POST/BLUR` for `POST_VS` + `BLUR_FS`.
 */
export function shaderName(material: Three.Material): string {
  if (!("fragmentShader" in material && "vertexShader" in material)) return material.type;
  const vertex = (SHADER_NAMES.get(material.vertexShader) ?? "?").replace(/_VS$/, "");
  const fragment = (SHADER_NAMES.get(material.fragmentShader) ?? "?").replace(/_FS$/, "");
  return vertex === fragment ? vertex : `${vertex}/${fragment}`;
}

/** three's numeric constants, so a filter of `1006` reads as `Linear`. */
const constants: [string, unknown][] = [];

/** Called by `mockThree` with the real module, which this file cannot import. */
export function nameConstants(actual: object) {
  if (constants.length > 0) return;
  constants.push(...Object.entries(actual).filter(([, value]) => typeof value === "number"));
}

function constantName(value: unknown, suffix: string): string {
  const entry = constants.find(([name, known]) => known === value && name.endsWith(suffix));
  return entry ? entry[0].slice(0, -suffix.length) : String(value);
}

/** Blend, face and depth state: what a draw does with the fragments its shader returns. */
export function describeMaterial(material: Three.Material): string {
  const factors = [
    constantName(material.blendSrc, "Factor"),
    constantName(material.blendDst, "Factor"),
    constantName(material.blendEquation, "Equation"),
  ];
  return [
    `blend=${constantName(material.blending, "Blending")}(${factors.join(",")})`,
    `premultiplied=${material.premultipliedAlpha}`,
    `side=${constantName(material.side, "Side")}`,
    `transparent=${material.transparent}`,
    `depthTest=${material.depthTest}`,
    `depthWrite=${material.depthWrite}`,
  ].join(" ");
}

export function describeTarget(target: Three.WebGLRenderTarget): string {
  const { minFilter, magFilter, format, type } = target.texture;
  return [
    `min=${constantName(minFilter, "Filter")}`,
    `mag=${constantName(magFilter, "Filter")}`,
    `format=${constantName(format, "Format")}`,
    `type=${constantName(type, "Type")}`,
    `depth=${target.depthBuffer}`,
    `stencil=${target.stencilBuffer}`,
  ].join(" ");
}
