import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type {
  GraphController,
  GraphNode,
  GraphNodeSnapshot,
  SelectSource,
} from "@nexus-cyberdeck/graph";

/** The selected node, how it was selected, the isolation around it and the walk history. */
export function useGraphSelection(controllerRef: RefObject<GraphController | null>) {
  const [selected, setSelected] = useState<GraphNodeSnapshot | null>(null);
  const [isKeyboardSelection, setIsKeyboardSelection] = useState(false);
  const [isolate, setIsolate] = useState<number | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const syncCanGoBack = useCallback(
    () => setCanGoBack(controllerRef.current?.canGoBack ?? false),
    [controllerRef],
  );
  // An effect, not derived: the history lives in the controller and is current only after GraphCanvas's effects.
  useEffect(() => {
    setCanGoBack(controllerRef.current?.canGoBack ?? false);
  }, [controllerRef, selected]);

  const select = useCallback((node: GraphNodeSnapshot | null, source: SelectSource) => {
    setSelected(node);
    setIsKeyboardSelection(source === "keyboard");
  }, []);

  const selectById = useCallback(
    (id: GraphNode["id"]) => {
      setSelected(controllerRef.current?.getNode(id) ?? null);
      setIsKeyboardSelection(false);
    },
    [controllerRef],
  );

  const clearSelection = useCallback(() => {
    setSelected(null);
    setIsolate(null);
  }, []);

  const goTo = useCallback(
    (id: number) => {
      const node = controllerRef.current?.getNode(id);
      if (!node) return;
      setSelected(node);
      setIsKeyboardSelection(false);
      controllerRef.current?.focus(id);
      // An isolation follows the walk, or the node just reached couldn't be expanded.
      setIsolate((previous) => (previous !== null ? id : previous));
    },
    [controllerRef],
  );

  const toggleIsolate = useCallback(() => {
    if (!selected) return;
    const id = selected.id as number;
    setIsolate((previous) => (previous === id ? null : id));
  }, [selected]);

  return {
    selected,
    isKeyboardSelection,
    isolate,
    canGoBack,
    syncCanGoBack,
    select,
    selectById,
    clearSelection,
    goTo,
    toggleIsolate,
  };
}
