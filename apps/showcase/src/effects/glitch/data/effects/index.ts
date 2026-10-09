import type { EffectDef } from "../types.js";
import { DIGITAL_EFFECTS } from "./digital.js";
import { DISPLAY_EFFECTS } from "./display.js";
import { GLASS_EFFECTS } from "./glass.js";
import { SIGNAL_EFFECTS } from "./signal.js";
import { TAPE_EFFECTS } from "./tape.js";

/** Every effect, in signal-path order: the order the engine renders them in. */
export const EFFECTS = [
  ...TAPE_EFFECTS,
  ...SIGNAL_EFFECTS,
  ...DIGITAL_EFFECTS,
  ...DISPLAY_EFFECTS,
  ...GLASS_EFFECTS,
] as const satisfies readonly EffectDef[];

type Effect = (typeof EFFECTS)[number];

export type EffectId = Effect["id"];

export type EffectParam<Id extends EffectId> = Extract<Effect, { id: Id }>["params"][number][0];
