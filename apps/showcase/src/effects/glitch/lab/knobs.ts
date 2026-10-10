import type { Config } from "../core/config.js";
import type { EffectId } from "../data/effects/index.js";

/** `config` with one knob of one effect set to `value`; the other effects keep their objects. */
export function withKnob(config: Config, effectId: EffectId, knob: string, value: number): Config {
  return { ...config, [effectId]: { ...config[effectId], [knob]: value } };
}
