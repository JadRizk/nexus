import { useEffect, useRef } from "react";

/** A ref whose element is focused on the frame after `isOpen` turns true. */
export function useFocusOnOpen<E extends HTMLElement>(isOpen: boolean) {
  const ref = useRef<E>(null);
  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => ref.current?.focus());
  }, [isOpen]);
  return ref;
}
