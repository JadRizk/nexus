import { useMemo } from "react";
import { describeGraph } from "@nexus-cyberdeck/graph";
import { GraphOutline, Panel } from "@nexus-cyberdeck/react";
import { CONSOLE_WIDTH, PANEL_GAP } from "./controls.js";
import { LINK_CATEGORIES, NODE_CATEGORIES } from "./taxonomy.js";

export interface OutlinePanelProps {
  nodes: Parameters<typeof describeGraph>[0]["nodes"];
  edges: Parameters<typeof describeGraph>[0]["edges"];
  hiddenNodeCategories: readonly string[];
  hiddenLinkCategories: readonly string[];
  isolateId: number | null;
  selectedId: string | number | null;
  rightInset: number;
  onSelect: (id: string | number) => void;
}

/** The list view: GraphOutline over the canvas, filtered like the canvas. */
export function OutlinePanel({
  nodes,
  edges,
  hiddenNodeCategories,
  hiddenLinkCategories,
  isolateId,
  selectedId,
  rightInset,
  onSelect,
}: OutlinePanelProps) {
  const outline = useMemo(
    () =>
      describeGraph({
        nodes,
        edges,
        nodeCategories: NODE_CATEGORIES,
        linkCategories: LINK_CATEGORIES,
        hiddenNodeCategories,
        hiddenLinkCategories,
        isolateId,
      }),
    [nodes, edges, hiddenNodeCategories, hiddenLinkCategories, isolateId],
  );
  return (
    <Panel
      style={{
        position: "absolute",
        top: "var(--nx-space-5)",
        bottom: "var(--nx-space-5)",
        left: PANEL_GAP + CONSOLE_WIDTH + PANEL_GAP,
        right: rightInset,
        overflowY: "auto",
        zIndex: 6,
      }}
    >
      <GraphOutline
        data={outline}
        label="Sample graph as a list"
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </Panel>
  );
}
