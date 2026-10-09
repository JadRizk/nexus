import type { EffectId } from "../data/effects/index.js";
import type { EffectDef } from "../data/types.js";
import type { Config } from "../core/config.js";
import type { Overrides } from "../core/resolveEvents.js";

/** An effect the renderer can draw: one with an entry in a `Config`. */
export type PlannedEffect = EffectDef & { readonly id: EffectId };

/** One effect's draw in a frame. */
export interface Pass {
  readonly effect: PlannedEffect;
  /** The effect's mix, `uAmt`: above 0.001, or it would not have a pass. */
  readonly amt: number;
  /** `u_<key>` → value for each of the effect's params, in `params` order, clamped to its range. */
  readonly uniforms: Readonly<Record<string, number>>;
  /** Whether the pass reads the last frame (`uPrev`) and keeps its own output for the next. */
  readonly isFeedback: boolean;
}

// Below this mix an effect is invisible, so it costs no draw.
const MIN_AMT = 0.001;

/**
 * The frame's effect passes: `effects` in their order, each at its resting
 * knobs in `config` with the running events' `overrides` laid over them.
 *
 * - The mix is the resting `amt` when the effect is `on` (else 0), raised to
 *   an override's `amt` when one is higher. An event can only add an effect.
 * - An effect whose mix is at or under 0.001 is left out.
 * - Any other overridden knob replaces the resting one, then every param is
 *   clamped to its `[min, max]`.
 * - A knob missing from the config reads as NaN, as it always has.
 */
export function planPasses(
  effects: readonly PlannedEffect[],
  config: Config,
  overrides: Overrides,
): Pass[] {
  const passes: Pass[] = [];
  for (const effect of effects) {
    const knobs = config[effect.id];
    const override = overrides[effect.id];
    const restAmt = knobs.on ? (knobs.amt ?? Number.NaN) : 0;
    const amt = override?.amt !== undefined ? Math.max(restAmt, override.amt) : restAmt;
    if (amt <= MIN_AMT) continue;
    const uniforms: Record<string, number> = {};
    for (const [key, min, max] of effect.params) {
      const value = override?.[key] ?? knobs[key] ?? Number.NaN;
      uniforms[`u_${key}`] = Math.min(max, Math.max(min, value));
    }
    passes.push({ effect, amt, uniforms, isFeedback: effect.id === "feedback" });
  }
  return passes;
}
