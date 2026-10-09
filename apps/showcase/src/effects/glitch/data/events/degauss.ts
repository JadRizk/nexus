import type { EventDef } from "./types.js";

export const DEGAUSS_EVENT = {
  id: "degauss",
  label: "DEGAUSS",
  key: "5",
  dur: 1.2,
  chaos: 0.05,
  cause:
    "The degauss coil fires on power-up. Purely smooth — a magnetic field settling, not a signal failing. No chaos, no stepping, sine decay.",
  tracks: [
    {
      fx: "chroma",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.06, 1],
        [0.5, 0.6],
        [1, 0],
      ],
    },
    {
      fx: "chroma",
      param: "width",
      mode: "set",
      keys: [
        [0, 24],
        [0.5, 14],
        [1, 9],
      ],
    },
    {
      fx: "chroma",
      param: "lag",
      mode: "set",
      keys: [
        [0, 11],
        [0.4, -5],
        [0.7, 6],
        [1, 4],
      ],
    },
    {
      fx: "crt",
      param: "aberr",
      mode: "add",
      keys: [
        [0, 0],
        [0.08, 3.2],
        [0.4, 1.2],
        [0.65, 2.0],
        [1, 0],
      ],
    },
    {
      fx: "crt",
      param: "curve",
      mode: "add",
      keys: [
        [0, 0],
        [0.12, 0.5],
        [0.5, 0.15],
        [1, 0],
      ],
    },
    {
      fx: "holo",
      param: "amt",
      mode: "max",
      keys: [
        [0, 0],
        [0.15, 0.35],
        [0.6, 0.15],
        [1, 0],
      ],
    },
  ],
} as const satisfies EventDef;
