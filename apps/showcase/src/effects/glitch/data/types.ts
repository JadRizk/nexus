/** One knob of an effect. The engine binds it to the uniform `u_<key>`. */
export type Param = readonly [key: string, min: number, max: number, initial: number];

/** A stage of the signal path, in the order the picture passes through them. */
export type EffectGroup = "TAPE" | "SIGNAL" | "DIGITAL" | "DISPLAY" | "GLASS";

export interface EffectDef {
  readonly id: string;
  readonly group: EffectGroup;
  readonly label: string;
  readonly note: string;
  readonly params: readonly Param[];
  /** Uniforms the shader declares besides its params, such as `uPrev` for the last frame. */
  readonly extra?: readonly string[];
  /**
   * The fragment shader. It sits beside `params` because each param needs a
   * matching `uniform float u_<key>` line here, so the two change together.
   */
  readonly frag: string;
}

/** An effect pinned to one stage, so a file of `G` effects rejects one from another stage. */
export type EffectOf<G extends EffectGroup> = EffectDef & { readonly group: G };

/**
 * A keyframe: at `at` (0–1 through the event) the track reads `value`. A
 * "step" key holds the previous value until `at`, then jumps.
 */
export type Key = readonly [at: number, value: number, interpolation?: "step"];

/**
 * How an event's value combines with the resting value of its knob:
 * - `max`: the greater of the two (for mix)
 * - `set`: replaces the resting value
 * - `add`: offsets the resting value
 */
export type TrackMode = "max" | "set" | "add";
