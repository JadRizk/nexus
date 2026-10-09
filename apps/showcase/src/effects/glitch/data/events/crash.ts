import type { EventDef } from "./types.js";

export const CRASH_EVENT = {
  id: "crash",
  label: "HEAD CRASH",
  key: "4",
  dur: 0.55,
  chaos: 0.8,
  cause:
    "Mechanical failure. Everything at once, with the head-switch region swelling from six scanlines to most of the frame. The chaos term is high, so it stutters rather than fades.",
  tracks: [
    {
      fx: "headswitch",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.02, 1, "step"],
        [0.6, 0.8],
        [1, 0],
      ],
    },
    {
      fx: "headswitch",
      param: "lines",
      mode: "set",
      keys: [
        [0, 90],
        [0.5, 40],
        [1, 7],
      ],
    },
    {
      fx: "headswitch",
      param: "skew",
      mode: "set",
      keys: [
        [0, 0.18],
        [1, 0.06],
      ],
    },
    {
      fx: "tracking",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.05, 1],
        [0.7, 0.5],
        [1, 0],
      ],
    },
    {
      fx: "tracking",
      param: "shift",
      mode: "set",
      keys: [
        [0, 0.13],
        [1, 0.04],
      ],
    },
    {
      fx: "jitter",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.03, 1],
        [0.8, 0.4],
        [1, 0],
      ],
    },
    {
      fx: "dropout",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.06, 1],
        [0.75, 0.5],
        [1, 0],
      ],
    },
    {
      fx: "blocks",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.1, 0.7, "step"],
        [0.6, 0.3, "step"],
        [1, 0, "step"],
      ],
    },
  ],
} as const satisfies EventDef;
