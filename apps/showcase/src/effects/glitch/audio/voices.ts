/* Per-event voicing. Each voice is written from the same physical story as
   its event's shader; AUDIO.md has the table. */

import type { EventId } from "../data/events/index.js";
import type { Synth } from "./synth.js";
import { randomBetween } from "./synth.js";
import { MAINS, NTSC_SCAN } from "./tuning.js";

/** Schedules one event's sound on `synth`, starting at context time `time` (s). */
export type Voice = (synth: Synth, time: number) => void;

/** The quantised pitches packet loss blips on, Hz. */
const CORRUPT_PITCHES = [110, 220, 330, 440, 587, 880, 1320] as const;

function randomCorruptPitch(): number {
  const index = (Math.random() * CORRUPT_PITCHES.length) | 0;
  return CORRUPT_PITCHES[index] ?? CORRUPT_PITCHES[0];
}

/** Every event's voice. Typed by `EventId`, so an event without one does not compile. */
export const VOICES: Record<EventId, Voice> = {
  dropout({ noise }, time) {
    noise(time, 0.045, { f0: randomBetween(2600, 4200), q: 0.8, gain: 0.55, attack: 0.001 });
    noise(time + 0.012, 0.14, { f0: randomBetween(900, 1400), f1: 400, q: 2.5, gain: 0.22 });
    if (Math.random() > 0.5) noise(time + randomBetween(0.05, 0.1), 0.03, { f0: 5200, gain: 0.3 });
  },

  signal({ noise, tone }, time) {
    tone(time, 0.55, { f0: MAINS, f1: MAINS * 0.45, type: "sawtooth", gain: 0.16, lp: 800, q: 6 });
    noise(time + 0.02, 0.85, {
      f0: 1200,
      f1: 5000,
      q: 0.4,
      type: "highpass",
      gain: 0.3,
      attack: 0.06,
    });
    noise(time + 0.3, 0.5, { f0: 300, q: 1.2, gain: 0.14 });
    tone(time + 0.62, 0.28, { f0: MAINS * 0.5, f1: MAINS, type: "square", gain: 0.1, lp: 500 });
  },

  // Blips step on a fixed grid of quantised pitches — a grid, not a glissando.
  corrupt({ noise, tone }, time) {
    const blipCount = 7 + ((Math.random() * 5) | 0);
    for (let i = 0; i < blipCount; i++) {
      const blipAt = time + i * 0.028;
      tone(blipAt, 0.024, { f0: randomCorruptPitch(), type: "square", gain: 0.14, attack: 0.0005 });
      if (Math.random() > 0.6) {
        noise(blipAt, 0.02, { f0: randomBetween(3000, 7000), gain: 0.18, attack: 0.0005 });
      }
    }
    noise(time, 0.05, { f0: 180, q: 3, gain: 0.35, attack: 0.001 });
  },

  crash({ noise, tone }, time) {
    tone(time, 0.35, { f0: 90, f1: 32, type: "sine", gain: 0.5, attack: 0.001, lp: 300 });
    noise(time, 0.42, { f0: 400, f1: 2600, q: 0.6, gain: 0.42, attack: 0.002 });
    tone(time + 0.04, 0.3, { f0: 700, f1: 4200, type: "sawtooth", gain: 0.12, lp: 5000, q: 8 });
    noise(time + 0.18, 0.3, { f0: 6000, f1: 900, q: 1.5, gain: 0.25 });
  },

  degauss({ noise, tone }, time) {
    tone(time, 0.85, { f0: 150, f1: 38, type: "sine", gain: 0.55, attack: 0.006, lp: 420, q: 9 });
    tone(time + 0.01, 0.6, { f0: 300, f1: 76, type: "triangle", gain: 0.16, lp: 600, q: 4 });
    noise(time, 0.2, { f0: 120, f1: 60, q: 4, gain: 0.1, attack: 0.01 });
  },

  scrub({ noise, tone }, time) {
    noise(time, 0.55, { f0: 500, f1: 2400, q: 3.5, gain: 0.28, attack: 0.01 });
    noise(time + 0.1, 0.45, { f0: 2200, f1: 700, q: 3.0, gain: 0.2, attack: 0.01 });
    tone(time, 0.5, { f0: 240, f1: 900, type: "sawtooth", gain: 0.07, lp: 2500, q: 5 });
  },

  interference({ noise, tone }, time) {
    tone(time, 1.7, { f0: MAINS, type: "sawtooth", gain: 0.1, lp: 400, q: 3, attack: 0.15 });
    // 1.5 Hz off the second harmonic, so the two beat.
    tone(time + 0.05, 1.5, { f0: MAINS * 2 + 1.5, type: "sine", gain: 0.06, attack: 0.2 });
    for (let i = 0; i < 4; i++) {
      noise(time + 0.15 + i * 0.42, 0.12, { f0: randomBetween(1800, 3400), q: 2, gain: 0.1 });
    }
  },

  boot(synth, time) {
    const { noise, tone } = synth;
    noise(time, 0.02, { f0: 3000, q: 0.5, gain: 0.5, attack: 0.0005 }); // relay
    tone(time + 0.05, 0.9, { f0: 400, f1: NTSC_SCAN, type: "sine", gain: 0.05, attack: 0.2 });
    noise(time + 0.06, 0.7, { f0: 200, f1: 1800, q: 0.8, gain: 0.18, attack: 0.1 });
    VOICES.degauss(synth, time + 0.55);
  },
};
