import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeAudioContext } from "./fakeAudio.js";
import type { NoiseOptions, ToneOptions } from "./synth.js";
import { createSynth, SILENT } from "./synth.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A synth on a fake context, with the log cleared of its own setup. */
function setUp() {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const fake = createFakeAudioContext();
  const master = fake.ctx.createGain();
  const noiseBuffer = fake.ctx.createBuffer(1, 16, 8);
  const synth = createSynth(fake.ctx, master, noiseBuffer);
  fake.log.length = 0;
  return { fake, synth };
}

/** The id of the first node of `kind` created since `setUp`. */
function firstOf(fake: ReturnType<typeof setUp>["fake"], kind: string): string {
  const node = fake.nodes.find((record) => record.kind === kind && record.id !== "gain#1");
  if (!node) throw new Error(`no ${kind} node`);
  return node.id;
}

// Sweeps that cross the frequency floors, so the clamps show in the log.
const NOISES: Record<string, NoiseOptions> = {
  exp: { f0: 10, f1: 3000, q: 2, gain: 0.3, attack: 0.002, curve: "exp" },
  linear: { f0: 900, f1: 5, type: "highpass", gain: 0.2, curve: "linear" },
};

const TONES: Record<string, ToneOptions> = {
  "without lp": { f0: 4, f1: 400, type: "square", gain: 0.2, attack: 0.001 },
  "with lp": { f0: 150, f1: 5, type: "sawtooth", gain: 0.3, lp: 600, q: 4 },
};

describe("noise", () => {
  it.each(Object.entries(NOISES))(
    "with the %s curve schedules the same graph",
    (_name, options) => {
      const { fake, synth } = setUp();
      synth.noise(2, 0.5, options);
      fake.end(firstOf(fake, "bufferSource"));
      expect(fake.log).toMatchSnapshot();
    },
  );
});

describe("tone", () => {
  it.each(Object.entries(TONES))("%s schedules the same graph", (_name, options) => {
    const { fake, synth } = setUp();
    synth.tone(2, 0.5, options);
    fake.end(firstOf(fake, "oscillator"));
    expect(fake.log).toMatchSnapshot();
  });
});

describe("envelopes", () => {
  // AUDIO.md: an exponential ramp to 0 is silent NaN in Chrome.
  it("never ramp exponentially to 0", () => {
    const { fake, synth } = setUp();
    for (const options of Object.values(NOISES)) synth.noise(0, 0.3, options);
    for (const options of Object.values(TONES)) synth.tone(0, 0.3, options);
    const targets = fake.log
      .filter(([, action]) => action === "exponentialRampToValueAtTime")
      .map(([, , value]) => value);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets).not.toContain(0);
    expect(fake.log).toContainEqual([
      expect.stringMatching(/\.gain$/),
      "exponentialRampToValueAtTime",
      SILENT,
      0.3,
    ]);
  });
});
