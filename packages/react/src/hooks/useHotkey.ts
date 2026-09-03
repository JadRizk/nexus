import { useEffect, useRef } from "react";

/**
 * Global shortcut. `"mod+k"` maps to Cmd on macOS and Ctrl elsewhere.
 * Unmodified keys are ignored while the user is typing in a field, so `/`
 * can open a palette without hijacking every text input on the page.
 * A modified combo is not subject to that, because nobody types Cmd+K.
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void): void {
  // `useCallback(handler, [handler])` returned `handler` unchanged, so the
  // effect below re-attached its window listener on every render whenever the
  // caller passed an inline arrow — which is every ordinary call site. A ref
  // keeps the handler current while the listener is armed exactly once.
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1] ?? "";
    const wantMod = parts.includes("mod");
    const wantShift = parts.includes("shift");

    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (wantMod !== mod) return;
      if (wantShift !== e.shiftKey) return;
      if (e.key.toLowerCase() !== key) return;

      // Only an *unmodified* combo yields to text entry. Applying this to
      // every combo made `mod+k` unreachable from any focused field — and
      // fatally so for the case it exists for: CommandPalette keeps focus in
      // its own input for its entire life (the ARIA combobox pattern), so the
      // shortcut that opened the palette could never close it again.
      //
      // Shift alone still counts as unmodified, because Shift+letter is
      // exactly what typing a capital letter is.
      if (!wantMod) {
        const t = e.target as HTMLElement | null;
        const typing =
          !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
        if (typing) return;
      }

      e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [combo]);
}
