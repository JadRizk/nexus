// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAINS } from "../glitch/data/chains.js";
import { EV_BY_ID, EVENTS } from "../glitch/data/events/index.js";
import { useEventBus } from "./useEventBus.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBus() {
  const voice = { fire: vi.fn() };
  const { result } = renderHook(() => useEventBus({ current: voice }));
  return { bus: result.current, voice };
}

describe("useEventBus", () => {
  it("fire reads the clock, then the seed, then voices the event", () => {
    const { bus, voice } = renderBus();
    const now = vi.spyOn(performance, "now").mockReturnValue(1500);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25);

    bus.fire("crash");

    expect(bus.activeRef.current).toEqual([{ def: EV_BY_ID.crash, t0: 1.5, seed: 250 }]);
    expect(voice.fire).toHaveBeenCalledWith("crash");
    const [clockAt] = now.mock.invocationCallOrder;
    const [seedAt] = random.mock.invocationCallOrder;
    const [voiceAt] = voice.fire.mock.invocationCallOrder;
    expect(clockAt).toBeLessThan(seedAt ?? 0);
    expect(seedAt).toBeLessThan(voiceAt ?? 0);
  });

  it("fire ignores an unknown id, without a sound", () => {
    const { bus, voice } = renderBus();
    bus.fire("no-such-event");
    expect(bus.activeRef.current).toEqual([]);
    expect(voice.fire).not.toHaveBeenCalled();
  });

  it("fireRandom picks the event with its first Math.random, then seeds it with the next", () => {
    const { bus, voice } = renderBus();
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.999999).mockReturnValueOnce(0.5);

    bus.fireRandom();

    const last = EVENTS[EVENTS.length - 1];
    expect(bus.activeRef.current).toEqual([{ def: last, t0: 0, seed: 500 }]);
    expect(voice.fire).toHaveBeenCalledWith(last?.id);
  });

  it("fireChain queues each step, timed from now in seconds, without starting or voicing any", () => {
    const { bus, voice } = renderBus();
    vi.spyOn(performance, "now").mockReturnValue(2000);
    const cascade = CHAINS[0];

    bus.fireChain(cascade);

    expect(bus.queueRef.current).toEqual(
      cascade.steps.map(([delay, id]) => ({ at: 2 + delay, id })),
    );
    expect(bus.activeRef.current).toEqual([]);
    expect(voice.fire).not.toHaveBeenCalled();
  });
});
