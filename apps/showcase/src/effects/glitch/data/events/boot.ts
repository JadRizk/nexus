import type { EventDef } from "./types.js";

export const BOOT_EVENT = {
  id: "boot",
  label: "COLD BOOT",
  key: "8",
  dur: 1.5,
  chaos: 0.25,
  cause:
    "Power-on. Sync has not locked yet so the picture rolls, then catches. Useful as a route transition — the screen is genuinely arriving rather than fading in.",
  tracks: [
    {
      fx: "roll",
      param: "amt",
      mode: "max",
      keys: [
        [0, 1],
        [0.35, 0.9],
        [0.6, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "roll",
      param: "speed",
      mode: "set",
      keys: [
        [0, 1.5],
        [0.5, 0.5],
        [1, 0.05],
      ],
    },
    {
      fx: "roll",
      param: "bar",
      mode: "set",
      keys: [
        [0, 0.16],
        [1, 0.04],
      ],
    },
    {
      fx: "crush",
      param: "amt",
      mode: "max",
      keys: [
        [0, 1],
        [0.25, 0.6, "step"],
        [0.5, 0, "step"],
        [1, 0, "step"],
      ],
    },
    {
      fx: "crush",
      param: "bits",
      mode: "set",
      keys: [
        [0, 1],
        [0.4, 4, "step"],
        [1, 8, "step"],
      ],
    },
    {
      fx: "jitter",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0.9],
        [0.4, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "crt",
      param: "grain",
      mode: "add",
      keys: [
        [0, 1.0],
        [0.5, 0.3],
        [1, 0],
      ],
    },
    {
      fx: "crt",
      param: "scan",
      mode: "add",
      keys: [
        [0, 0.4],
        [0.6, 0.1],
        [1, 0],
      ],
    },
  ],
} as const satisfies EventDef;
