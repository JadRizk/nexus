/* ============================================================================
   GLITCH ENGINE
   Glitch Lab's signal path, apart from its UI. It now lives in ./glitch:
   data/ and shaders/ hold what it runs, core/ the pure steps of the loop,
   gl/ the WebGL layer, frameLoop.ts one frame, and useGlitchEngine.ts the
   hook that mounts it. This file re-exports them for Glitch Lab and the
   characterisation suite until #90 points them at ./glitch directly.

   The pipeline is ordered as a real signal path — see GlitchLab.jsx:

     SOURCE → TAPE → COMPOSITE SIGNAL → DIGITAL → DISPLAY → GLASS
   ========================================================================== */

export { CHAINS } from "./glitch/data/chains.js";
export { EFFECTS } from "./glitch/data/effects/index.js";
export { EV_BY_ID, EVENTS } from "./glitch/data/events/index.js";
export { PRESETS } from "./glitch/data/presets.js";
export { COMMON } from "./glitch/shaders/common.js";
export { SRC_FS } from "./glitch/shaders/source.js";
export { chaosEnv } from "./glitch/core/chaosEnv.js";
export { configFor } from "./glitch/core/config.js";
export { fireEvent, shuffleSeed } from "./glitch/core/events.js";
export { hashf } from "./glitch/core/hash.js";
export { sampleKeys } from "./glitch/core/sampleKeys.js";
export { program } from "./glitch/gl/program.js";
export { useGlitchEngine } from "./glitch/useGlitchEngine.js";
