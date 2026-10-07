import type { MutableRefObject, Ref, RefCallback } from "react";

/* ============================================================================
   @nexus-cyberdeck/react — ref merging

   A handful of overlays (Drawer, CommandPalette) already point an internal
   ref at their DOM node — useFocusTrap needs it to find focusable
   descendants. Forwarding a ref to a consumer means that same node now has
   two owners, and the `ref` prop only accepts one value. This is the one
   spelling for combining them, instead of each overlay growing its own
   callback.
   ========================================================================== */

/**
 * Combines several refs into one callback ref that writes the node to each of
 * them. Accepts callback refs, ref objects, `null` and `undefined` so it can
 * be called directly with a forwarded ref, which is any of those.
 */
export function mergeRefs<T>(...refs: ReadonlyArray<Ref<T> | undefined | null>): RefCallback<T> {
  return (node: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    }
  };
}
