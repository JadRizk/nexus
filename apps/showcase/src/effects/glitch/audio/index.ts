/* Glitch Lab's synthesiser, apart from its UI, so Home's hero can voice the
   same faults the same way. Synthesised, not sampled — AUDIO.md has why.
   Nothing starts without a user gesture: browsers block it, and autoplaying
   audio is hostile regardless. */

import type { Bed, BedOptions } from "./bed.js";
import { startBed, stopBed } from "./bed.js";
import { createSynth, ignoringErrors } from "./synth.js";
import type { Voice } from "./voices.js";
import { VOICES } from "./voices.js";

export type { BedOptions } from "./bed.js";

/** The audio graph `createAudio` returns. */
export interface GlitchAudio {
  readonly ctx: AudioContext;
  /** Resumes the context; call from a user gesture. */
  resume(): Promise<void>;
  /** Plays event `id`'s voice now. An id with no voice is ignored. */
  fire(id: string): void;
  /** Eases the master level to `volume` (linear gain) over about 20 ms. */
  setVolume(volume: number): void;
  /** Starts or stops the ambient bed; a bed already running is replaced. */
  setBed(isOn: boolean, options?: BedOptions): void;
  /** Stops the bed and closes the context. */
  dispose(): void;
}

/** Scheduling latency, seconds, so a voice's first sample is not clipped. */
const FIRE_LATENCY = 0.01;

/** Master gain into a limiter, so stacked events cannot clip. */
function createMasterBus(ctx: AudioContext): GainNode {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  // Glitch audio has extreme crest factors: an unlimited noise burst on top
  // of a thunk will square off.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return master;
}

/** Two seconds of white noise, shared by every voice and re-pitched per use. */
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Voices by any id, since callers pass ids from the keyboard and the queue. */
const VOICE_BY_ID: Readonly<Partial<Record<string, Voice>>> = VOICES;

/** Where a browser may keep its Web Audio constructor; older Safari prefixes it. */
interface AudioWindow {
  readonly AudioContext?: typeof AudioContext;
  readonly webkitAudioContext?: typeof AudioContext;
}

/** Builds the audio graph, or returns null where the browser has no Web Audio. */
export function createAudio(): GlitchAudio | null {
  const audioWindow: AudioWindow = window;
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const master = createMasterBus(ctx);
  const noiseBuffer = createNoiseBuffer(ctx);
  const synth = createSynth(ctx, master, noiseBuffer);

  let bed: Bed | null = null;
  function setBed(isOn: boolean, options: BedOptions = {}): void {
    if (bed) {
      const running = bed;
      bed = null;
      stopBed(ctx, running, options.fade);
    }
    if (isOn) bed = startBed({ ctx, master, noiseBuffer }, options);
  }

  return {
    ctx,
    resume: () => ctx.resume(),
    fire(id) {
      VOICE_BY_ID[id]?.(synth, ctx.currentTime + FIRE_LATENCY);
    },
    setVolume: (volume) => {
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    },
    setBed,
    dispose() {
      setBed(false);
      ignoringErrors(() => {
        void ctx.close();
      });
    },
  };
}
