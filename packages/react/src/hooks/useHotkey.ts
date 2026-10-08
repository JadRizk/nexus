import { useEffect, useRef } from "react";

// The modifier keywords a combo string may use, plus the trailing key itself
// (never checked against this set — whatever survives after the modifiers is
// taken as-is). Anything else is a typo the caller needs to hear about now,
// not a hotkey that silently degrades to its bare, unmodified key.
const MODIFIER_KEYWORDS = new Set(["mod", "shift", "ctrl", "alt", "meta"]);

// Whether `mod` means Cmd here. `userAgentData` is the supported source where
// it exists; `navigator.platform` is deprecated but is still the only answer in
// Safari and Firefox. iPadOS reports "MacIntel", which is the right answer for
// it too: its hardware keyboards use Cmd. Read when a listener is armed, never
// during render, so nothing a server rendered can depend on it.
function usesCmdAsMod(): boolean {
  if (typeof navigator === "undefined") return false;
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return /mac|iphone|ipad|ipod/i.test(hinted?.platform || navigator.platform || "");
}

/**
 * Global shortcut. `"mod+k"` is Cmd+K on Apple platforms and Ctrl+K
 * everywhere else, and only that one: Ctrl+K on a Mac (kill-line in a native
 * text field) and the Windows or Super key elsewhere do not match it.
 *
 * Every modifier is matched exactly against its own `KeyboardEvent` flag, so
 * `shift+k` does not fire for Shift+Alt+K. `ctrl`, `alt` and `meta` name a
 * specific key; `mod` names whichever of Cmd/Ctrl is the platform's. Because
 * `mod` already is one of Cmd and Ctrl, combining it with `ctrl` or `meta`
 * is contradictory and throws; write `meta+ctrl+k` to require both. `mod+alt`
 * and `mod+shift` are fine.
 *
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
  useEffect(() => {
    handlerRef.current = handler;
  });

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

  // `mod` is one of Cmd and Ctrl by definition, so asking for it alongside an
  // explicit `ctrl` or `meta` has no single meaning: "both", "the platform's
  // key and also Ctrl" (which is just `ctrl` on most machines) and "Cmd on a
  // Mac" are all defensible readings. Silently picking one is how `mod+ctrl+k`
  // ended up firing on Cmd alone, so it is an error instead. Throwing is also
  // the reversible choice: it can become a feature later without breaking a
  // caller, whereas the reverse would.
  if (wantMod && (wantCtrl || wantMeta)) {
    throw new Error(
      `useHotkey: "mod" cannot be combined with "${wantCtrl ? "ctrl" : "meta"}" in "${combo}". ` +
        `"mod" already means Cmd on Apple platforms and Ctrl elsewhere. Use one or the other, ` +
        `or write "meta+ctrl+${key}" to require both keys.`,
    );
  }

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (wantShift !== e.shiftKey) return;
      if (wantAlt !== e.altKey) return;

      // `mod` resolves to exactly one of the two keys for this platform, and
      // from there Ctrl and Meta are matched the same way as every other
      // modifier: each flag must equal what was asked for, so `mod+k` is not
      // satisfied by the other key, and a plain `k` does not fire while
      // either is held. (`wantMod` never coexists with `wantCtrl`/`wantMeta`;
      // that combination throws above.)
      const cmdIsMod = wantMod && usesCmdAsMod();
      if ((wantCtrl || (wantMod && !cmdIsMod)) !== e.ctrlKey) return;
      if ((wantMeta || cmdIsMod) !== e.metaKey) return;

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
        const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
        if (typing) return;
      }

      e.preventDefault();
      handlerRef.current(e);
    };

    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [combo, key, wantMod, wantShift, wantCtrl, wantAlt, wantMeta]);
}
