import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * A ref holding `value` as of the last commit, for the engine's frame loop,
 * which reads refs rather than props.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  // Assigned after commit, not during render: a render React throws away
  // under concurrent rendering must not leak its values to the loop.
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
