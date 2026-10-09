import type { EventId } from "./events/index.js";

/** Fire `event`, `delay` seconds after the chain starts. */
export type ChainStep = readonly [delay: number, event: EventId];

export interface ChainDef {
  readonly id: string;
  readonly label: string;
  readonly steps: readonly ChainStep[];
}

/* Chains: an event is one fault, a chain is a failure cascading. The delays
   are what sell it — a second fault landing while the first is still decaying
   reads as a system coming apart, not as two effects. */
export const CHAINS = [
  {
    id: "cascade",
    label: "CASCADE",
    steps: [
      [0, "dropout"],
      [0.12, "corrupt"],
      [0.34, "signal"],
    ],
  },
  {
    id: "collapse",
    label: "COLLAPSE",
    steps: [
      [0, "corrupt"],
      [0.08, "crash"],
      [0.5, "signal"],
      [1.1, "boot"],
    ],
  },
  {
    id: "wake",
    label: "WAKE",
    steps: [
      [0, "boot"],
      [0.9, "degauss"],
    ],
  },
  {
    id: "hunt",
    label: "HUNT",
    steps: [
      [0, "scrub"],
      [0.3, "dropout"],
      [0.55, "scrub"],
      [0.9, "interference"],
    ],
  },
] as const satisfies readonly ChainDef[];

export type ChainId = (typeof CHAINS)[number]["id"];
