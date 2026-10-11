import type { EventDef } from "./types.js";

export const SCRUB_EVENT = {
  id: "scrub",
  label: "SCRUB",
  key: "6",
  dur: 0.7,
  chaos: 0.3,
  cause:
    "Shuttle search. The tape moves faster than playback speed, so the tracking band sweeps through rapidly and the head-switch point wanders up the frame.",
  tracks: [
    {
      fx: "tracking",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.05, 1],
        [0.85, 0.9],
        [1, 0],
      ],
    },
    {
      fx: "tracking",
      param: "speed",
      mode: "set",
      keys: [
        [0, 1.4],
        [0.6, 0.9],
        [1, 0.18],
      ],
    },
    {
      fx: "tracking",
      param: "height",
      mode: "set",
      keys: [
        [0, 0.3],
        [1, 0.12],
      ],
    },
    {
      fx: "headswitch",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.08, 0.9],
        [0.85, 0.5],
        [1, 0],
      ],
    },
    {
      fx: "headswitch",
      param: "lines",
      mode: "set",
      keys: [
        [0, 26],
        [1, 7],
      ],
    },
    {
      fx: "interlace",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.1, 0.8],
        [0.9, 0.3],
        [1, 0],
      ],
    },
  ],
} as const satisfies EventDef;
