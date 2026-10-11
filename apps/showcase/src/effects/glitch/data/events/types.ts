import type { EffectId, EffectParam } from "../effects/index.js";
import type { Key, TrackMode } from "../types.js";

/** A keyframed curve on one knob of the effect `Id`; `amt` is the effect's mix. */
export interface TrackFor<Id extends EffectId> {
  readonly fx: Id;
  readonly param: EffectParam<Id> | "amt";
  readonly mode: TrackMode;
  readonly keys: readonly Key[];
}

/** A track on any effect. A union over the effects, so `param` is checked against `fx`. */
export type Track = { [Id in EffectId]: TrackFor<Id> }[EffectId];

/**
 * A transient glitch. It lives or dies on its envelope, not its effects, and
 * the keyframes of every event follow three rules:
 *
 * 1. Attack is near-instant — one or two frames. Anything slower reads as an
 *    animation rather than a fault.
 * 2. Sustain is jagged and non-monotonic. A real signal fights to recover, so
 *    it partially comes back and fails again. `chaos` adds per-frame dropouts
 *    on top of the curve.
 * 3. Effects inside one event are correlated but OFFSET. Perfectly
 *    synchronised ramps look synthetic; a 40ms stagger looks causal.
 *
 * Digital faults use "step" keys (hold, then jump) because codecs quantise.
 * Analogue faults interpolate. That single distinction is most of what makes
 * DATA CORRUPT feel different from SIGNAL LOSS.
 */
export interface EventDef {
  readonly id: string;
  readonly label: string;
  /** The keyboard key that fires it in Glitch Lab. */
  readonly key: string;
  /** Length in seconds. */
  readonly dur: number;
  /** 0–1: how deep the per-frame dropouts cut into the envelope. */
  readonly chaos: number;
  readonly cause: string;
  readonly tracks: readonly Track[];
}
