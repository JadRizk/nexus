/* The two primitives every voice is built from: a filtered noise burst and an
   enveloped oscillator. Each schedules its nodes at a context time and
   disconnects them when the source ends. */

/** A filtered burst of the shared noise table. */
export interface NoiseOptions {
  /** Filter frequency at the start, Hz. Floored at 20. Default 2000. */
  readonly f0?: number;
  /** Filter frequency at the end, Hz, reached exponentially. Default `f0`. */
  readonly f1?: number;
  /** Filter Q. Default 1. */
  readonly q?: number;
  /** Default `"bandpass"`. */
  readonly type?: BiquadFilterType;
  /** Peak level, linear gain. Default 0.4. */
  readonly gain?: number;
  /** Rise to the peak, seconds. Default 0.003. */
  readonly attack?: number;
  /** How the level falls to silence. Default `"exp"`. */
  readonly curve?: "exp" | "linear";
}

/** An oscillator with an attack and an exponential decay. */
export interface ToneOptions {
  /** Pitch at the start, Hz. Floored at 10. Default 200. */
  readonly f0?: number;
  /** Pitch at the end, Hz, reached exponentially. Default `f0`. */
  readonly f1?: number;
  /** Default `"sine"`. */
  readonly type?: OscillatorType;
  /** Peak level, linear gain. Default 0.25. */
  readonly gain?: number;
  /** Rise to the peak, seconds. Default 0.004. */
  readonly attack?: number;
  /** Low-pass cutoff, Hz; 0, the default, means no filter. */
  readonly lp?: number;
  /** Q of the low-pass filter. Default 1. */
  readonly q?: number;
}

export interface Synth {
  /** Schedules a noise burst at context time `start` (s), lasting `duration` (s). */
  noise(start: number, duration: number, options?: NoiseOptions): void;
  /** Schedules a tone at context time `start` (s), lasting `duration` (s). */
  tone(start: number, duration: number, options?: ToneOptions): void;
}

/** Envelopes fall to this rather than 0: an exponential ramp to 0 is silent NaN in Chrome. */
export const SILENT = 0.0001;

/** A uniform random number in [min, max). */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Runs `action`, ignoring the error a node throws when it is already stopped or disconnected. */
export function ignoringErrors(action: () => void): void {
  try {
    action();
  } catch {
    /* the node was already gone */
  }
}

/** Where the primitives play: the context, the bus they feed and the noise table they read. */
interface SynthTarget {
  readonly ctx: BaseAudioContext;
  readonly master: AudioNode;
  readonly noiseBuffer: AudioBuffer;
}

function playNoise(
  { ctx, master, noiseBuffer }: SynthTarget,
  start: number,
  duration: number,
  options: NoiseOptions = {},
): void {
  const {
    f0 = 2000,
    f1 = f0,
    q = 1,
    type = "bandpass",
    gain = 0.4,
    attack = 0.003,
    curve = "exp",
  } = options;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  // Re-pitched per burst so two bursts never sound alike.
  source.playbackRate.value = randomBetween(0.7, 1.4);
  source.playbackRate.setValueAtTime(source.playbackRate.value, start);

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(20, f0), start);
  if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + duration);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENT, start);
  envelope.gain.linearRampToValueAtTime(gain, start + attack);
  if (curve === "exp") envelope.gain.exponentialRampToValueAtTime(SILENT, start + duration);
  else envelope.gain.linearRampToValueAtTime(SILENT, start + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(master);
  source.start(start);
  source.stop(start + duration + 0.06);
  source.onended = () => {
    ignoringErrors(() => {
      envelope.disconnect();
      filter.disconnect();
    });
  };
}

function playTone(
  { ctx, master }: SynthTarget,
  start: number,
  duration: number,
  options: ToneOptions = {},
): void {
  const { f0 = 200, f1 = f0, type = "sine", gain = 0.25, attack = 0.004, lp = 0, q = 1 } = options;
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(10, f0), start);
  if (f1 !== f0)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, f1), start + duration);

  let output: AudioNode = oscillator;
  let filter: BiquadFilterNode | null = null;
  if (lp) {
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lp, start);
    filter.Q.value = q;
    oscillator.connect(filter);
    output = filter;
  }
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(SILENT, start);
  envelope.gain.linearRampToValueAtTime(gain, start + attack);
  envelope.gain.exponentialRampToValueAtTime(SILENT, start + duration);
  output.connect(envelope);
  envelope.connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
  oscillator.onended = () => {
    ignoringErrors(() => {
      envelope.disconnect();
      filter?.disconnect();
    });
  };
}

/** Creates the voice primitives, each routed into `master` and reading `noiseBuffer`. */
export function createSynth(
  ctx: BaseAudioContext,
  master: AudioNode,
  noiseBuffer: AudioBuffer,
): Synth {
  const target: SynthTarget = { ctx, master, noiseBuffer };
  return {
    noise: (start, duration, options) => playNoise(target, start, duration, options),
    tone: (start, duration, options) => playTone(target, start, duration, options),
  };
}
