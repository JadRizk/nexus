import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Focus trap, focus restoration and Escape dismissal for a modal surface.
 *
 * This is the single most-often-botched part of a design system, so both
 * Drawer and CommandPalette share this one implementation rather than each
 * growing their own. Returns a ref to spread onto the modal container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onDismiss?: () => void,
): RefObject<T> {
  const ref = useRef<T>(null);
  const restoreTo = useRef<Element | null>(null);
  const onDismissRef = useRef(onDismiss);
  // Written in an effect, not during render: React may render a component and
  // throw the result away, and a ref mutated on that discarded pass keeps the
  // stale value. The point of the ref is unchanged — it lets Escape reach the
  // latest onDismiss without re-running (and so re-arming) the trap effect.
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return undefined;
    restoreTo.current = document.activeElement;

    const node = ref.current;
    const SEL =
      "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const focusables = (): HTMLElement[] =>
      Array.from(node?.querySelectorAll<HTMLElement>(SEL) ?? []).filter(
        (el) => el.offsetParent !== null,
      );

    (focusables()[0] ?? node)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismissRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
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
      node?.removeEventListener("keydown", onKey);
      const el = restoreTo.current as HTMLElement | null;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [active]);

  return ref;
}
