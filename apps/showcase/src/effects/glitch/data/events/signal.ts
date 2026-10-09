import type { EventDef } from "./types.js";

export const SIGNAL_EVENT = {
  id: "signal",
  label: "SIGNAL LOSS",
  key: "2",
  dur: 0.95,
  chaos: 0.5,
  cause:
    "The antenna gets knocked. Vertical sync goes first, the picture rolls, multipath ghosting doubles up, and it wobbles back rather than snapping back.",
  tracks: [
    {
      fx: "roll",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.04, 1],
        [0.45, 0.9],
        [0.75, 0.35],
        [1, 0],
      ],
    },
    {
      fx: "roll",
      param: "speed",
      mode: "set",
      keys: [
        [0, 1.3],
        [0.5, 0.6],
        [1, 0.1],
      ],
    },
    {
      fx: "jitter",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.02, 1],
        [0.6, 0.55],
        [1, 0],
      ],
    },
    {
      fx: "jitter",
      param: "amp",
      mode: "set",
      keys: [
        [0, 0.03],
        [1, 0.004],
      ],
    },
    // ghost arrives late — offset from the sync failure, not simultaneous
    {
      fx: "ghost",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.12, 0],
        [0.2, 0.9],
        [0.85, 0.3],
        [1, 0],
      ],
    },
    {
      fx: "crt",
      param: "grain",
      mode: "add",
      keys: [
        [0, 0],
        [0.1, 0.9],
        [0.7, 0.35],
        [1, 0],
      ],
    },
  ],
} as const satisfies EventDef;
