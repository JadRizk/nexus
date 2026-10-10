import { useEffect } from "react";

/** Calls `clear` on an Escape anywhere on the page that nothing else has handled. */
export function useEscapeToClear(clear: () => void) {
  useEffect(() => {
    // Skip an Escape the graph already handled: it steps out one stage at a time.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clear();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [clear]);
}
