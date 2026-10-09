import { COMMON } from "./common.js";

/** Draws `uTex` as it is, opaque: the feedback copy and the final pass to the screen. */
export const COPY_FS = `${COMMON}\nvoid main(){ gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }`;
