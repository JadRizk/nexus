import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTS } from "../data/events/index.js";
import { createRecordingSynth, sequence } from "./fakeAudio.js";
import { VOICES } from "./voices.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Two walks through [0, 1) so each voice's random branches go both ways.
const RANDOM = {
  rising: [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95],
  falling: [0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.05],
};

function schedule(id: keyof typeof VOICES, random: readonly number[], time = 2) {
  vi.spyOn(Math, "random").mockImplementation(sequence(random));
  const { synth, calls } = createRecordingSynth();
  VOICES[id](synth, time);
  return calls;
}

describe("VOICES", () => {
  it("has a voice for every event, and no others", () => {
    expect(Object.keys(VOICES).sort()).toEqual(EVENTS.map((event) => event.id).sort());
  });

  // Recorded from the pre-TypeScript glitchAudio.js; a change here changes the sound.
  describe.each(Object.entries(RANDOM))("with Math.random %s", (_name, random) => {
    it.each(EVENTS.map((event) => event.id))("%s schedules the same calls", (id) => {
      expect(schedule(id, random)).toMatchSnapshot();
    });
  });

  it("varies between shots", () => {
    const first = createRecordingSynth();
    const second = createRecordingSynth();
    VOICES.dropout(first.synth, 0);
    VOICES.dropout(second.synth, 0);
    expect(second.calls[0]).not.toEqual(first.calls[0]);
  });

  it("ends boot with a degauss 0.55 s in", () => {
    const boot = schedule("boot", RANDOM.rising);
    expect(boot.slice(3)).toEqual(schedule("degauss", RANDOM.rising, 2 + 0.55));
  });
});
