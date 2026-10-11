import { useSyncExternalStore } from "react";

/* ============================================================================
   showcase — the phone breakpoint, for script
   The same width as every `@media (width < 640px)` rule in showcase.css: below
   it the header drops to one compact row, the docs sidebar folds away, and the
   labs (docked desktop consoles) are not offered.
   ========================================================================== */

export const PHONE_QUERY = "(width < 640px)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

/** Whether the window is phone-width, followed live. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches);
}
