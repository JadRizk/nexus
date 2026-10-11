import type { EffectId, EffectParam } from "./effects/index.js";

/** Knob values for the effect `Id`: its params, plus `on` (0 or 1) and `amt` (its mix). */
export type PresetKnobs<Id extends EffectId> = Readonly<
  Partial<Record<EffectParam<Id> | "on" | "amt", number>>
>;

/** The effects a preset changes. A knob it leaves out keeps its default. */
export type PresetDef = { readonly [Id in EffectId]?: PresetKnobs<Id> };

/** The base looks Glitch Lab starts from, by name. */
export const PRESETS = {
  CLEAN: { crt: { on: 1, amt: 0.35, curve: 0.3, scan: 0.3, aberr: 0.4, grain: 0.15 } },
  "VHS 1987": {
    chroma: { on: 1, amt: 0.85, width: 11, lag: 5 },
    dotcrawl: { on: 1, amt: 0.6, freq: 190, gain: 0.5 },
    headswitch: { on: 1, amt: 1, lines: 8, skew: 0.07 },
    crt: { on: 1, amt: 0.9, curve: 0.6, scan: 0.55, aberr: 0.8, grain: 0.5 },
  },
  BROADCAST: {
    chroma: { on: 1, amt: 0.5, width: 7, lag: 3 },
    ghost: { on: 1, amt: 0.35, delay: 0.022, decay: 0.35 },
    crt: { on: 1, amt: 0.85, curve: 0.5, scan: 0.5, aberr: 1.0, grain: 0.4 },
  },
  HOLOTABLE: {
    holo: { on: 1, amt: 0.9, bands: 200, lift: 1.0, flicker: 0.35 },
    chroma: { on: 1, amt: 0.4, width: 6, lag: 3 },
    interlace: { on: 1, amt: 0.5, offset: 0.004 },
    crt: { on: 1, amt: 0.7, curve: 0.35, scan: 0.35, aberr: 1.8, grain: 0.25 },
  },
  TERMINAL: {
    crush: { on: 1, amt: 0.6, bits: 3, dither: 0.85 },
    crt: { on: 1, amt: 1, curve: 0.8, scan: 0.7, aberr: 0.6, grain: 0.55 },
  },
} as const satisfies Readonly<Record<string, PresetDef>>;

export type PresetId = keyof typeof PRESETS;
