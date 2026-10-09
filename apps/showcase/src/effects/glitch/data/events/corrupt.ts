import type { EventDef } from "./types.js";

export const CORRUPT_EVENT = {
  id: "corrupt",
  label: "DATA CORRUPT",
  key: "3",
  dur: 0.38,
  chaos: 0.2,
  cause:
    "Packet loss. Motion vectors point at garbage, so macroblocks copy from the wrong place and hold there until the next keyframe. Everything steps — codecs quantise, they do not ease.",
  tracks: [
    {
      fx: "blocks",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.02, 1, "step"],
        [0.45, 1, "step"],
        [0.75, 0.6, "step"],
        [1, 0, "step"],
      ],
    },
    {
      fx: "blocks",
      param: "rate",
      mode: "set",
      keys: [
        [0, 0.7],
        [0.5, 0.45, "step"],
        [1, 0.2, "step"],
      ],
    },
    {
      fx: "blocks",
      param: "push",
      mode: "set",
      keys: [
        [0, 0.26],
        [1, 0.08, "step"],
      ],
    },
    {
      fx: "streak",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.14, 0.8, "step"],
        [0.7, 0.4, "step"],
        [1, 0, "step"],
      ],
    },
    {
      fx: "crush",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.08, 0.9, "step"],
        [0.6, 0.5, "step"],
        [1, 0, "step"],
      ],
    },
    {
      fx: "crush",
      param: "bits",
      mode: "set",
      keys: [
        [0, 2],
        [1, 5, "step"],
      ],
    },
  ],
} as const satisfies EventDef;
