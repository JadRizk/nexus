---
"@nexus-cyberdeck/graph": minor
---

**`describeGraph(input)`** returns the graph as a structured outline: a summary, then each category's nodes (sorted by label), each with its connections read from that node's side ("cites ARCHIVE-343, source"). It ranks connections and words nodes the same way the keyboard navigation does, and accepts the same `hiddenNodeCategories`, `hiddenLinkCategories`, `invalidEdges`, `rankConnections` and `describeNode` as `<GraphCanvas>`, so the outline matches what's on screen. Render it with `<GraphOutline>` from `@nexus-cyberdeck/react`, or your own markup. Its types (`GraphOutlineData`, `OutlineGroup`, `OutlineNode`, `OutlineConnection`, `DescribeGraphInput`) are exported.
