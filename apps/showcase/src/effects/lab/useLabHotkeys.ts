import { useEffect, useEffectEvent } from "react";
import { EVENTS } from "../glitch/data/events/index.js";
import { isTextEntry } from "../glitch/lab/keys.js";

export interface LabHotkeyActions {
  /** Fires and opens an event, by id; the event's own key was pressed. */
  readonly fireAndShow: (id: string) => void;
  /** Space was pressed. */
  readonly fireRandom: () => void;
}

/** Each event's key fires and opens it; space fires a random one. Ignored while typing. */
export function useLabHotkeys({ fireAndShow, fireRandom }: LabHotkeyActions): void {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isTextEntry(event.target)) return;
    const pressed = EVENTS.find((candidate) => candidate.key === event.key);
    if (pressed) {
      event.preventDefault();
      fireAndShow(pressed.id);
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      fireRandom();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
