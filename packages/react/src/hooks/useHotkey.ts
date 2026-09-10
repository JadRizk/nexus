import { useEffect, useRef } from "react";

// The modifier keywords a combo string may use, plus the trailing key itself
// (never checked against this set — whatever survives after the modifiers is
// taken as-is). Anything else is a typo the caller needs to hear about now,
// not a hotkey that silently degrades to its bare, unmodified key.
const MODIFIER_KEYWORDS = new Set(["mod", "shift", "ctrl", "alt", "meta"]);

/**
 * Global shortcut. `"mod+k"` maps to Cmd on macOS and Ctrl elsewhere.
 * `ctrl`, `alt` and `meta` match their `KeyboardEvent` counterpart exactly —
 * unlike `mod`, they are not satisfied by whichever of Cmd/Ctrl is down.
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

  // Parsed (and validated) on every render, not just inside the effect below,
  // so a bad combo throws synchronously from the render that introduced it
  // rather than surfacing later as a silently-ignored shortcut.
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1] ?? "";
  const modifierParts = parts.slice(0, -1);

  for (const part of modifierParts) {
    if (!MODIFIER_KEYWORDS.has(part)) {
      throw new Error(
        `useHotkey: unrecognised combo part "${part}" in "${combo}". Expected ` +
          `one of mod, shift, ctrl, alt, meta before the trailing key.`,
      );
    }
  }

  const wantMod = modifierParts.includes("mod");
  const wantShift = modifierParts.includes("shift");
  const wantCtrl = modifierParts.includes("ctrl");
  const wantAlt = modifierParts.includes("alt");
  const wantMeta = modifierParts.includes("meta");

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (wantShift !== e.shiftKey) return;
      if (wantAlt !== e.altKey) return;

      // `mod` is satisfied by either Cmd or Ctrl, so once it is requested we
      // stop checking `ctrlKey`/`metaKey` individually — either one being
      // down (and the other not being requested on its own) is exactly what
      // `mod` means. Without `mod`, `ctrl` and `meta` are distinct: each must
      // match its own `KeyboardEvent` flag exactly, so `ctrl+k` does not fire
      // for Cmd, and a plain `k` does not fire while either is held.
      if (wantMod) {
        if (!(e.metaKey || e.ctrlKey)) return;
      } else {
        if (wantCtrl !== e.ctrlKey) return;
        if (wantMeta !== e.metaKey) return;
      }

      if (e.key.toLowerCase() !== key) return;

      // Only a combo asking for no modifier beyond Shift yields to text
      // entry. Applying this to every combo made `mod+k` unreachable from any
      // focused field — and fatally so for the case it exists for:
      // CommandPalette keeps focus in its own input for its entire life (the
      // ARIA combobox pattern), so the shortcut that opened the palette could
      // never close it again. The same reasoning covers `ctrl`, `alt` and
      // `meta`: nobody types Ctrl+K either.
      //
      // Shift alone still counts as unmodified, because Shift+letter is
      // exactly what typing a capital letter is.
      if (!wantMod && !wantCtrl && !wantAlt && !wantMeta) {
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
  }, [combo, key, wantMod, wantShift, wantCtrl, wantAlt, wantMeta]);
}
