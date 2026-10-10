import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { EventVoice, QueuedEvent } from "../glitch/core/bus.js";
import { fireEvent } from "../glitch/core/events.js";
import type { ActiveEvent } from "../glitch/core/events.js";
import type { ChainDef } from "../glitch/data/chains.js";
import { EVENTS } from "../glitch/data/events/index.js";
import { randomEventIndex } from "../glitch/lab/events.js";

export interface EventBus {
  /** Events running now, for the engine. */
  readonly activeRef: RefObject<ActiveEvent[]>;
  /** Events waiting to start, for the engine. */
  readonly queueRef: RefObject<QueuedEvent[]>;
  /** Starts the event `id` now and voices it; an unknown id does nothing. */
  readonly fire: (id: string) => void;
  /** Starts a random event. */
  readonly fireRandom: () => void;
  /** Queues each step of `chain`, timed from now. */
  readonly fireChain: (chain: ChainDef) => void;
}

/** The lab's event bus: what is running and queued, and the ways to start events. */
export function useEventBus(audioRef: RefObject<EventVoice | null>): EventBus {
  const activeRef = useRef<ActiveEvent[]>([]);
  const queueRef = useRef<QueuedEvent[]>([]);

  const fire = useCallback(
    (id: string) => {
      if (fireEvent(activeRef, id)) audioRef.current?.fire(id);
    },
    [audioRef],
  );

  const fireRandom = useCallback(() => {
    const event = EVENTS[randomEventIndex(Math.random(), EVENTS.length)];
    if (event) fire(event.id);
  }, [fire]);

  const fireChain = useCallback((chain: ChainDef) => {
    const now = performance.now() / 1000;
    for (const [delay, id] of chain.steps) queueRef.current.push({ at: now + delay, id });
  }, []);

  return { activeRef, queueRef, fire, fireRandom, fireChain };
}
