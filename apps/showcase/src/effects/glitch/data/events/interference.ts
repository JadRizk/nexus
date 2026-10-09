import type { EventDef } from "./types.js";

export const INTERFERENCE_EVENT = {
  id: "interference",
  label: "INTERFERENCE",
  key: "7",
  dur: 2.0,
  chaos: 0.15,
  cause:
    "Something periodic nearby — a motor, a transmitter. Low amplitude, long duration, and it pulses rather than decays. The kind of fault you live with rather than notice.",
  tracks: [
    {
      fx: "ghost",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.1, 0.5],
        [0.3, 0.15],
        [0.5, 0.6],
        [0.7, 0.2],
        [0.9, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "ghost",
      param: "delay",
      mode: "set",
      keys: [
        [0, 0.02],
        [0.5, 0.06],
        [1, 0.03],
      ],
    },
    {
      fx: "jitter",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.15, 0.35],
        [0.55, 0.2],
        [0.8, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "dotcrawl",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.2, 0.8],
        [1, 0],
      ],
    },
  ],
} as const satisfies EventDef;
