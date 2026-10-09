/* Compile-time checks only: tsc fails if any of these mistakes stops being an error.
   Each bad case differs from the good case above it in one value. */
import type { ChainDef } from "./chains.js";
import type { Track } from "./events/types.js";
import type { PresetDef } from "./presets.js";

export const goodTrack = { fx: "chroma", param: "width", mode: "set", keys: [] } satisfies Track;
// @ts-expect-error "smear" is not an effect id.
export const unknownFx = { fx: "smear", param: "width", mode: "set", keys: [] } satisfies Track;
// @ts-expect-error "bits" belongs to crush, not chroma.
export const unknownParam = { fx: "chroma", param: "bits", mode: "set", keys: [] } satisfies Track;

export const goodChain = { id: "x", label: "X", steps: [[0, "boot"]] } satisfies ChainDef;
// @ts-expect-error "meltdown" is not an event id.
export const unknownEvent = { id: "x", label: "X", steps: [[0, "meltdown"]] } satisfies ChainDef;

export const goodPreset = { crush: { on: 1, bits: 3 } } satisfies PresetDef;
// @ts-expect-error "smear" is not an effect id.
export const unknownPresetFx = { smear: { on: 1, bits: 3 } } satisfies PresetDef;
// @ts-expect-error "curve" belongs to crt, not crush.
export const unknownKnob = { crush: { on: 1, curve: 3 } } satisfies PresetDef;
