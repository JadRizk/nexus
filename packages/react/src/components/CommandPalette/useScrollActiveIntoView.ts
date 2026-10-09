import { useEffect, useRef } from "react";

/**
 * A ref for the results list that scrolls its `activeIndex`th child into view,
 * without moving focus off the input.
 */
export function useScrollActiveIntoView(activeIndex: number) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);
  return listRef;
}
