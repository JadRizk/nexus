import { afterEach, describe, expect, it, vi } from "vitest";
import { startBed, stopBed } from "./bed.js";
import { createFakeAudioContext } from "./fakes.js";

afterEach(() => {
  vi.useRealTimers();
});

function setUp() {
  const fake = createFakeAudioContext();
  const master = fake.ctx.createGain();
  const noiseBuffer = fake.ctx.createBuffer(1, 16, 8);
  const before = fake.nodes.length;
  const target = { ctx: fake.ctx, master, noiseBuffer };
  /** Only the nodes the bed made. */
  const bedNodes = () => fake.nodes.slice(before);
  return { fake, target, bedNodes };
}

const SOURCE_KINDS = new Set(["oscillator", "bufferSource"]);

describe("startBed", () => {
  it("starts hiss, two hum partials, the whine and its drift", () => {
    const { target, bedNodes } = setUp();
    const bed = startBed(target);
    expect(bed.sources).toHaveLength(5);
    expect(bed.chain).toHaveLength(9);
    expect(
      bedNodes()
        .filter((node) => SOURCE_KINDS.has(node.kind))
        .every((node) => node.isStarted),
    ).toBe(true);
  });

  it("fades in through its own gain when given a fade", () => {
    const { fake, target, bedNodes } = setUp();
    fake.setTime(3);
    startBed(target, { fade: 0.4 });
    const outId = bedNodes()[0]?.id;
    expect(fake.log).toContainEqual([`${outId}.gain`, "setValueAtTime", 0, 3]);
    expect(fake.log).toContainEqual([`${outId}.gain`, "setTargetAtTime", 1, 3, 0.1]);
  });
});

describe("stopBed", () => {
  it("stops every source and disconnects every other node", () => {
    const { fake, target, bedNodes } = setUp();
    stopBed(fake.ctx, startBed(target));
    for (const node of bedNodes()) {
      if (SOURCE_KINDS.has(node.kind)) expect(node, node.id).toMatchObject({ isStopped: true });
      else expect(node, node.id).toMatchObject({ isDisconnected: true });
    }
  });

  it("with a fade, eases out and tears down fade + 50 ms later", () => {
    vi.useFakeTimers();
    const { fake, target, bedNodes } = setUp();
    const bed = startBed(target);
    fake.setTime(5);
    stopBed(fake.ctx, bed, 0.25);
    const outId = bedNodes()[0]?.id;
    expect(fake.log[fake.log.length - 1]).toEqual([
      `${outId}.gain`,
      "setTargetAtTime",
      0,
      5,
      0.0625,
    ]);

    vi.advanceTimersByTime(299);
    expect(bedNodes().some((node) => node.isStopped || node.isDisconnected)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(bedNodes().every((node) => node.isStopped || node.isDisconnected)).toBe(true);
  });

  it("tears down the rest when a source is already stopped", () => {
    const { fake, target, bedNodes } = setUp();
    const bed = startBed(target);
    const [hiss] = bed.sources;
    if (!hiss) throw new Error("no hiss source");
    vi.spyOn(hiss, "stop").mockImplementation(() => {
      throw new Error("InvalidStateError");
    });
    expect(() => {
      stopBed(fake.ctx, bed);
    }).not.toThrow();
    const others = bedNodes().filter((node) => node.kind !== "bufferSource");
    expect(others.every((node) => node.isStopped || node.isDisconnected)).toBe(true);
  });
});
