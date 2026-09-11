import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Every trap that is currently active, oldest first. Only the most recently
// activated one enforces the document-level focus guard below: when a palette
// opens over a drawer, both traps are active, and if each pulled focus back
// into its own node they would hand it back and forth from inside their own
// focusin handlers until the call stack overflowed. The newest surface owns
// focus; when it deactivates, the one beneath it takes over again.
const activeTraps: object[] = [];

/**
 * Focus trap, focus restoration and Escape dismissal for a modal surface.
 *
 * This is the single most-often-botched part of a design system, so both
 * Drawer and CommandPalette share this one implementation rather than each
 * growing their own. Returns a ref to spread onto the modal container.
 *
 * Tab and Shift+Tab wrap within the container. Focus that leaves it by any
 * other route — a pointer click on the page behind, a script calling
 * `focus()` elsewhere — is pulled straight back to wherever it last was
 * inside, so the keyboard never ends up on a surface the user cannot see and
 * Escape keeps reaching the trap. A pointer click on a non-focusable outside
 * element is the one route this cannot cover, because focus moves to `body`
 * without a focusin event; the modal's scrim has to prevent that by refusing
 * the mousedown, which Drawer's does.
 *
 * The return type is `RefObject<T | null>`, not `RefObject<T>`: that is what
 * `useRef<T>(null)` actually produces, and it is the only annotation that
 * reads correctly for both halves of the declared peer range. @types/react
 * 18 bakes `| null` into `RefObject<T>`'s own `current` field, so consumers
 * there never notice the difference; @types/react 19 made `RefObject<T>`
 * exact (`current: T`, no null), so a consumer on 19 reading the old
 * `RefObject<T>` annotation off this package's shipped `.d.ts` would believe
 * `current` can never be null, which is false the instant the modal closes
 * and focus restoration runs. See scripts/check-react19-types.mjs, which
 * typechecks this package's source against @types/react 19 in CI so this
 * cannot regress silently the way it arrived silently (CI only ever
 * typechecked against the @types/react 18 pinned in devDependencies).
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onDismiss?: () => void,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const restoreTo = useRef<Element | null>(null);
  const onDismissRef = useRef(onDismiss);
  // Written in an effect, not during render: React may render a component and
  // throw the result away, and a ref mutated on that discarded pass keeps the
  // stale value. The point of the ref is unchanged — it lets Escape reach the
  // latest onDismiss without re-running (and so re-arming) the trap effect.
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    if (!active) return undefined;
    restoreTo.current = document.activeElement;

    const node = ref.current;
    const token = {};
    activeTraps.push(token);

    const SEL =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const focusables = (): HTMLElement[] =>
      Array.from(node?.querySelectorAll<HTMLElement>(SEL) ?? [])
        .filter((el) => el.offsetParent !== null);

    // The element inside the trap that most recently held focus. That is
    // where focus goes back to when it escapes, rather than the first
    // focusable: a user three fields into a form who clicks the scrim by
    // accident should not be sent back to the top of it.
    let lastInside: HTMLElement | null = null;

    const onFocusIn = (e: FocusEvent) => {
      if (activeTraps[activeTraps.length - 1] !== token) return;
      const target = e.target as HTMLElement | null;
      if (!node || !(target instanceof Element)) return;
      if (node.contains(target)) { lastInside = target; return; }
      const back = lastInside?.isConnected ? lastInside : (focusables()[0] ?? node);
      back.focus();
    };

    // Registered before the initial focus() so that call is what seeds
    // lastInside, the same way every later move inside the trap does.
    document.addEventListener("focusin", onFocusIn);
    (focusables()[0] ?? node)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismissRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        list[list.length - 1]?.focus();
      } else if (!e.shiftKey && i === list.length - 1) {
        e.preventDefault();
        list[0]?.focus();
      }
    };

    node?.addEventListener("keydown", onKey);
    return () => {
      // The guard comes off before focus is restored, so restoring to an
      // opener outside the trap is not itself read as an escape.
      document.removeEventListener("focusin", onFocusIn);
      const i = activeTraps.indexOf(token);
      if (i !== -1) activeTraps.splice(i, 1);
      node?.removeEventListener("keydown", onKey);
      const el = restoreTo.current as HTMLElement | null;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [active]);

  return ref;
}
