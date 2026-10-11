import { EFFECTS } from "../data/effects/index.js";
import type { EffectId } from "../data/effects/index.js";
import { PRESETS } from "../data/presets.js";
import type { PresetDef } from "../data/presets.js";
import type { EffectDef } from "../data/types.js";
import { entriesOf } from "./entries.js";

/** A full effect config: effect id → its knobs (its params, plus `on` and `amt`). */
export type Config = Record<EffectId, Record<string, number>>;

// Widened so a name from the UI can be looked up and checked.
const PRESETS_BY_NAME: Readonly<Partial<Record<string, PresetDef>>> = PRESETS;

function restingKnobs(effect: EffectDef): Record<string, number> {
  // EffectDef has no field for a default `on`, so the one effect that is on
  // at rest is named here rather than giving every effect's data a new field.
  const knobs: Record<string, number> = { on: effect.id === "crt" ? 1 : 0, amt: 1 };
  for (const [key, , , initial] of effect.params) knobs[key] = initial;
  return knobs;
}

/**
 * A full effect config: every effect at its parameter defaults (only the CRT
 * on), with the named preset applied over it. A fresh object each call.
 *
 * @param preset A key of `PRESETS`.
 * @throws {TypeError} When `preset` names no preset.
 */
export function configFor(preset: string): Config {
  const presetKnobs = PRESETS_BY_NAME[preset];
  if (presetKnobs === undefined) throw new TypeError(`Unknown preset: ${preset}`);
  // Built from EFFECTS, so it has an entry for every EffectId.
  const config = Object.fromEntries(
    EFFECTS.map((effect) => [effect.id, restingKnobs(effect)]),
  ) as Config;
  for (const [effectId, knobs] of entriesOf(presetKnobs)) Object.assign(config[effectId], knobs);
  return config;
}
