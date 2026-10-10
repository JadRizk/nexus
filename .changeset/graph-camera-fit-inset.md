---
"@nexus-cyberdeck/graph": minor
---

The `<GraphCanvas>` camera keeps the graph in view while it settles, stays clear of chrome that floats over the canvas, and leaves the view to the reader once they take it.

- **The intro tracks the layout.** The camera now opens on the measured bounds of the graph, sweeps out to them, and keeps framing the layout as it spreads, instead of landing on a fixed density guess. It stops the moment the reader pans or zooms. Dragging a node doesn't count.
- **`fitInset`** names the edges covered by your own floating panels, in CSS pixels. The canvas stays full-bleed, but every framing the camera picks (the intro, `fit()`, `focus()`, following a selection) lands in the space that's left. Changing it re-frames, but only while the camera hasn't been taken over by hand.
- **`followSelection`** (default `true`) keeps 1.x behaviour: selecting frames the node and its neighbours, and clearing the selection frames the whole graph. The camera now also rides along with the selected node while the layout is still settling. Pass `false` to drive the camera yourself with `focus()` and `fit()`.
- **`focus(id)`** centres the node in the free space and follows it until the layout settles. **`fit()`** hands the camera back to the auto-fit.
- **`reseed()`** replays the intro sweep only if the reader never took the camera. Otherwise it re-fits in place.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the intro sweep is skipped and every camera move lands at once instead of gliding.
