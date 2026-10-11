---
"@nexus-cyberdeck/graph": minor
---

New `<GraphCanvas>` props for consumers building around the canvas, and a way to render data whose edges have gone stale.

- **`invalidEdges`**: `"error"` (default, unchanged) fails the mount when an edge's endpoint matches no node. `"drop"` leaves those edges out, draws the rest, and reports them through the new **`onWarning(message, { dropped })`** callback, or `console.warn` if you don't pass one. Duplicate node ids and missing categories still always fail.
- **`selectionScopedLinkCategories`**: link categories drawn only on edges touching the selected node, and hidden otherwise. Useful for a dense computed layer that answers a question about one node.
- **`onFrame(geometry)`**: fires every frame with node ids, positions, radii, hidden flags, the camera and the viewport, for syncing your own DOM to the canvas. The arrays are reused, so read them during the call.
- **`GraphStats.drawnNodes`**: the number of nodes left on screen after hidden categories and isolation. If you construct a `GraphStats` yourself, add the field.
- `NEARBY_DEPTH`, `TIER_NEARBY`, `DroppedEdge` and `InvalidEdgePolicy` are now exported.
