import type { EventDef } from "./types.js";

export const DROPOUT_EVENT = {
  id: "dropout",
  label: "DROPOUT",
  key: "1",
  dur: 0.22,
  chaos: 0.35,
  cause:
    "A flaw in the oxide passes under the head. Signal is gone for a few scanlines, the AGC over-corrects, and colour drops out before luma does.",
  tracks: [
    {
      fx: "dropout",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.03, 1, "step"],
        [0.55, 0.7],
        [1, 0],
      ],
    },
    {
      fx: "dropout",
      param: "rate",
      mode: "set",
      keys: [
        [0, 0.9],
        [1, 0.5],
      ],
    },
    {
      fx: "tracking",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.1, 0.8],
        [0.7, 0.2],
        [1, 0],
      ],
    },
    // chroma dies before luma — colour loss is the tell
    {
      fx: "chroma",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.06, 1, "step"],
        [0.8, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "chroma",
      param: "width",
      mode: "set",
      keys: [
        [0, 22],
        [1, 9],
      ],
    },
  ],
} as const satisfies EventDef;
