/* The ambient bed: the hiss, hum and whine you stop hearing after ten seconds
   and immediately miss when it cuts. Off by default; the CRT whine especially
   is not for everyone. */

import type { AudioTarget } from "./synth.js";
import { ignoringErrors } from "./synth.js";
import { MAINS, NTSC_SCAN } from "./tuning.js";

/** Levels for the bed's layers, each linear gain scaled by its own trim. */
export interface BedOptions {
  /** Tape hiss level. Default 0.35. */
  readonly hiss?: number;
  /** Mains hum level. Default 0.3. */
  readonly hum?: number;
  /** Flyback whine level. Default 0.25. */
  readonly whine?: number;
  /**
   * Seconds to ease in or out through the bed's own gain, so it can follow
   * something as quick as a hover without clicking. 0, the default, is a hard switch.
   */
  readonly fade?: number;
}

/** A running bed: the sources to stop and every other node to disconnect. */
export interface Bed {
  readonly sources: AudioScheduledSourceNode[];
  readonly chain: AudioNode[];
  /** The bed's output gain, into the master bus. */
  readonly out: GainNode;
}

/** Where a layer goes: the context, the time it starts at (s) and the bed it joins. */
interface LayerTarget {
  readonly ctx: BaseAudioContext;
  readonly start: number;
  readonly bed: Bed;
}

function addHiss(target: LayerTarget, noiseBuffer: AudioBuffer, level: number): void {
  const { ctx, start, bed } = target;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 3200;
  const gain = ctx.createGain();
  gain.gain.value = level * 0.035;
  source.connect(highpass);
  highpass.connect(gain);
  gain.connect(bed.out);
  source.start(start);
  bed.sources.push(source);
  bed.chain.push(highpass, gain);
}

/** Mains hum plus its second harmonic. */
function addHum(target: LayerTarget, level: number): void {
  const { ctx, start, bed } = target;
  [MAINS, MAINS * 2].forEach((frequency, harmonic) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = harmonic ? "sine" : "sawtooth";
    oscillator.frequency.value = frequency;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 260;
    const gain = ctx.createGain();
    gain.gain.value = level * (harmonic ? 0.012 : 0.022);
    oscillator.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(bed.out);
    oscillator.start(start);
    bed.sources.push(oscillator);
    bed.chain.push(lowpass, gain);
  });
}

/** The flyback whine at the scan rate; it keeps its own level (see AUDIO.md). */
function addWhine(target: LayerTarget, level: number): void {
  const { ctx, start, bed } = target;
  const whine = ctx.createOscillator();
  whine.type = "sine";
  whine.frequency.value = NTSC_SCAN;
  const gain = ctx.createGain();
  gain.gain.value = level * 0.01;
  const drift = ctx.createOscillator();
  drift.frequency.value = 0.23; // slow drift, so it feels alive
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = 6;
  drift.connect(driftDepth);
  driftDepth.connect(whine.frequency);
  whine.connect(gain);
  gain.connect(bed.out);
  whine.start(start);
  drift.start(start);
  bed.sources.push(whine, drift);
  bed.chain.push(gain, driftDepth);
}

/** Starts a bed now, fading in over `options.fade` seconds if set. */
export function startBed({ ctx, master, noiseBuffer }: AudioTarget, options: BedOptions = {}): Bed {
  const { hiss = 0.35, hum = 0.3, whine = 0.25, fade = 0 } = options;
  const start = ctx.currentTime;
  const out = ctx.createGain();
  out.connect(master);
  if (fade > 0) {
    out.gain.setValueAtTime(0, start);
    out.gain.setTargetAtTime(1, start, fade / 4);
  }
  const bed: Bed = { sources: [], chain: [out], out };
  const target = { ctx, start, bed };
  addHiss(target, noiseBuffer, hiss);
  addHum(target, hum);
  addWhine(target, whine);
  return bed;
}

/**
 * Stops `bed`'s sources and disconnects the nodes behind them, or the graph
 * gathers orphans on every toggle. With `fade` (s) it eases out first and
 * tears down `fade` + 50 ms later.
 */
export function stopBed(ctx: BaseAudioContext, bed: Bed, fade = 0): void {
  const tearDown = () => {
    bed.sources.forEach((source) => {
      ignoringErrors(() => {
        source.stop();
      });
    });
    bed.chain.forEach((node) => {
      ignoringErrors(() => {
        node.disconnect();
      });
    });
  };
  if (fade > 0) {
    bed.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 4);
    setTimeout(tearDown, fade * 1000 + 50);
  } else tearDown();
}
