/* Test doubles for the audio modules. Node has no Web Audio, so these record
   what the code asks of the graph instead of making sound. */

import type { NoiseOptions, Synth, ToneOptions } from "./synth.js";

/** One call or property write on a fake node, in the order it happened. */
export type AudioLogEntry = readonly [target: string, action: string, ...args: unknown[]];

/** What the fake knows about one node it created. */
export interface FakeNodeRecord {
  readonly id: string;
  readonly kind: string;
  isStarted: boolean;
  isStopped: boolean;
  isDisconnected: boolean;
}

export interface FakeAudio {
  /** Pass where an `AudioContext` is expected. */
  readonly ctx: AudioContext;
  readonly log: AudioLogEntry[];
  readonly nodes: FakeNodeRecord[];
  /** The sample data of every buffer created, in creation order. */
  readonly buffers: Float32Array[];
  /** Moves `ctx.currentTime` to `seconds`. */
  setTime(seconds: number): void;
}

const ID = Symbol("fake audio id");
const PARAM_NAMES = new Set([
  "gain",
  "frequency",
  "detune",
  "Q",
  "playbackRate",
  "threshold",
  "knee",
  "ratio",
  "attack",
  "release",
]);

type Labelled = Record<PropertyKey, unknown>;

/** How a value appears in the log: fakes by id, functions as a marker. */
function label(value: unknown): unknown {
  if (typeof value === "function") return "<function>";
  if (typeof value === "object" && value !== null && ID in value) return (value as Labelled)[ID];
  return value;
}

function createParam(id: string, log: AudioLogEntry[]): Labelled {
  let current = 0;
  const automate =
    (action: string) =>
    (...args: unknown[]): Labelled => {
      log.push([id, action, ...args]);
      return param;
    };
  const param: Labelled = {
    [ID]: id,
    get value() {
      return current;
    },
    set value(next: number) {
      log.push([id, "value", next]);
      current = next;
    },
    setValueAtTime: automate("setValueAtTime"),
    linearRampToValueAtTime: automate("linearRampToValueAtTime"),
    exponentialRampToValueAtTime: automate("exponentialRampToValueAtTime"),
    setTargetAtTime: automate("setTargetAtTime"),
  };
  return param;
}

function nodeMethods(record: FakeNodeRecord, log: AudioLogEntry[]): Labelled {
  const { id } = record;
  return {
    [ID]: id,
    connect(destination: unknown) {
      log.push([id, "connect", label(destination)]);
    },
    disconnect() {
      record.isDisconnected = true;
      log.push([id, "disconnect"]);
    },
    start(...args: unknown[]) {
      record.isStarted = true;
      log.push([id, "start", ...args]);
    },
    stop(...args: unknown[]) {
      record.isStopped = true;
      log.push([id, "stop", ...args]);
    },
  };
}

/** A node whose audio params appear on first read and whose property writes are logged. */
function createNode(record: FakeNodeRecord, log: AudioLogEntry[]): unknown {
  const params = new Map<string, Labelled>();
  return new Proxy(nodeMethods(record, log), {
    get(target, key) {
      if (typeof key !== "string" || !PARAM_NAMES.has(key)) return target[key];
      let param = params.get(key);
      if (!param) {
        param = createParam(`${record.id}.${key}`, log);
        params.set(key, param);
      }
      return param;
    },
    set(target, key, value) {
      log.push([record.id, `=${String(key)}`, label(value)]);
      target[key] = value;
      return true;
    },
  });
}

/**
 * A fake `AudioContext` that logs every node it creates and everything done to
 * them. `sampleRate` is small by default so the noise table stays short.
 */
export function createFakeAudioContext(sampleRate = 8): FakeAudio {
  const log: AudioLogEntry[] = [];
  const nodes: FakeNodeRecord[] = [];
  const buffers: Float32Array[] = [];
  const make = (kind: string) => () => {
    const record = {
      id: `${kind}#${nodes.length + 1}`,
      kind,
      isStarted: false,
      isStopped: false,
      isDisconnected: false,
    };
    nodes.push(record);
    log.push(["ctx", `create:${kind}`, record.id]);
    return createNode(record, log);
  };
  const ctx = {
    sampleRate,
    currentTime: 0,
    destination: { [ID]: "destination" },
    createGain: make("gain"),
    createDynamicsCompressor: make("compressor"),
    createBiquadFilter: make("filter"),
    createOscillator: make("oscillator"),
    createBufferSource: make("bufferSource"),
    createBuffer(channels: number, length: number, rate: number) {
      const data = new Float32Array(length);
      buffers.push(data);
      log.push(["ctx", "createBuffer", channels, length, rate]);
      return { [ID]: `buffer#${buffers.length}`, length, getChannelData: () => data };
    },
    resume() {
      log.push(["ctx", "resume"]);
      return Promise.resolve();
    },
    close() {
      log.push(["ctx", "close"]);
      return Promise.resolve();
    },
  };
  const setTime = (seconds: number) => {
    ctx.currentTime = seconds;
  };
  return { ctx: ctx as unknown as AudioContext, log, nodes, buffers, setTime };
}

/** One call a voice made on the synth. */
export type SynthCall =
  | readonly ["noise", time: number, duration: number, options: NoiseOptions | undefined]
  | readonly ["tone", time: number, duration: number, options: ToneOptions | undefined];

/** A synth that plays nothing and records every call, for snapshotting voices. */
export function createRecordingSynth(): { synth: Synth; calls: SynthCall[] } {
  const calls: SynthCall[] = [];
  const synth: Synth = {
    noise: (time, duration, options) => {
      calls.push(["noise", time, duration, options]);
    },
    tone: (time, duration, options) => {
      calls.push(["tone", time, duration, options]);
    },
  };
  return { synth, calls };
}

/** `Math.random` replacement that walks `values` in order, cycling. */
export function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index++;
    return value;
  };
}
