import { afterEach, describe, expect, it, vi } from "vitest";
import type { FakeAudio } from "./fakes.js";
import { createFakeAudioContext } from "./fakes.js";
import type { GlitchAudio } from "./index.js";
import { createAudio } from "./index.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Installs a fake as the page's `AudioContext` and builds the graph on it. */
function open(): { fake: FakeAudio; audio: GlitchAudio } {
  const fake = createFakeAudioContext();
  vi.stubGlobal("window", {
    AudioContext: function FakeAudioContext() {
      return fake.ctx;
    },
  });
  const audio = createAudio();
  if (!audio) throw new Error("createAudio returned null with an AudioContext");
  return { fake, audio };
}

describe("createAudio", () => {
  it("returns null without an AudioContext", () => {
    vi.stubGlobal("window", {});
    expect(createAudio()).toBeNull();
  });

  it("falls back to the prefixed constructor", () => {
    const fake = createFakeAudioContext();
    vi.stubGlobal("window", {
      webkitAudioContext: function FakeAudioContext() {
        return fake.ctx;
      },
    });
    expect(createAudio()?.ctx).toBe(fake.ctx);
  });

  it("routes a master gain of 0.5 through a limiter to the destination", () => {
    const { fake } = open();
    expect(fake.log).toContainEqual(["gain#1.gain", "value", 0.5]);
    expect(fake.log).toContainEqual(["gain#1", "connect", "compressor#2"]);
    expect(fake.log).toContainEqual(["compressor#2", "connect", "destination"]);
  });

  it("fills a two-second noise table in [-1, 1)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const { fake } = open();
    expect(fake.buffers[0]).toEqual(new Float32Array(16).fill(0.5));
  });
});

describe("fire", () => {
  it("schedules the voice 10 ms after now", () => {
    const { fake, audio } = open();
    fake.setTime(4);
    fake.log.length = 0;
    audio.fire("degauss");
    expect(fake.log).toContainEqual(["oscillator#3.frequency", "setValueAtTime", 150, 4 + 0.01]);
  });

  it("ignores an id with no voice", () => {
    const { fake, audio } = open();
    fake.log.length = 0;
    audio.fire("no-such-event");
    expect(fake.log).toEqual([]);
  });
});

describe("setBed", () => {
  it("stops and disconnects everything the bed started", () => {
    const { fake, audio } = open();
    const before = fake.nodes.length;
    audio.setBed(true);
    audio.setBed(false);
    for (const node of fake.nodes.slice(before)) {
      expect(node.isStopped || node.isDisconnected, node.id).toBe(true);
    }
  });

  it("replaces a running bed rather than stacking a second", () => {
    const { fake, audio } = open();
    const before = fake.nodes.length;
    audio.setBed(true);
    const first = fake.nodes.slice(before);
    audio.setBed(true);
    expect(first.every((node) => node.isStopped || node.isDisconnected)).toBe(true);
    expect(fake.nodes.slice(before + first.length).some((node) => node.isStopped)).toBe(false);
  });

  it("fades out under the new call's fade before tearing down", () => {
    vi.useFakeTimers();
    const { fake, audio } = open();
    const before = fake.nodes.length;
    audio.setBed(true);
    const bedNodes = fake.nodes.slice(before);
    audio.setBed(false, { fade: 0.5 });
    vi.advanceTimersByTime(549);
    expect(bedNodes.some((node) => node.isStopped || node.isDisconnected)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(bedNodes.every((node) => node.isStopped || node.isDisconnected)).toBe(true);
  });
});

describe("dispose", () => {
  it("stops the bed and closes the context", () => {
    const { fake, audio } = open();
    audio.setBed(true);
    audio.dispose();
    expect(fake.log[fake.log.length - 1]).toEqual(["ctx", "close"]);
    expect(fake.nodes.filter((node) => node.isStarted).every((node) => node.isStopped)).toBe(true);
  });
});

describe("setVolume", () => {
  it("eases the master gain over 20 ms", () => {
    const { fake, audio } = open();
    fake.setTime(1);
    audio.setVolume(0.2);
    expect(fake.log[fake.log.length - 1]).toEqual(["gain#1.gain", "setTargetAtTime", 0.2, 1, 0.02]);
  });
});
