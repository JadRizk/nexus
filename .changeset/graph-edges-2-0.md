---
"@nexus-cyberdeck/graph": major
---

A new edge renderer for `<GraphCanvas>`. Graphs look different after this change: edges are thinner, crossings no longer flare white, and hovering or selecting changes brightness only, never width.

See **Migrating from 1.x** in the package README for every breaking change in 2.0, in order of how likely it is to affect you.

**Breaking**

- **`LinkCategory.arrow` is removed.** Direction is drawn by the edge's end pads instead: a filled bar at the source end and an open bracket at the target end. They stay readable with motion turned off. Set `directed: false` on a category with no direction (it then gets a bar at both ends). Delete `arrow` from your categories, and use `directed: false` where it was `false`.
- **`LinkCategory.dash` is now a period in screen pixels**, the same at any zoom. Values written for 1.x (around 1–3) need to grow to roughly 4–8.
- **New default optics**, tuned for the new shader: `edgeWidth` 2.4 → 1.3, `edgeOpacity` 0.5 → 0.4, `aberr` 1.0 → 0.5. `edgeWidth` is now a half-width the shader scales up, so keeping 2.4 draws edges about twice as heavy. If you copied the old defaults into your own controls, use the new `DEFAULT_OPTICS` and `DEFAULT_PHYSICS` exports instead.

**New**

- `LinkCategory.routing`: `"straight"` (default), `"arc"` (bowed by `curve`) or `"etched"` (axis, 45°, axis, like a circuit trace).
- `LinkCategory.gain`: brightness at rest, so a structural scaffold and a meaningful link can share a width.
- `GraphEdge.absentEnd`: the trace frays out toward a declared endpoint that has nothing behind it.
- Hovering or selecting a node now lights up three tiers: edges touching it, edges inside its two-hop neighbourhood, and everything else, dimmed. Edges between two neighbours used to be dimmed as if unrelated.
- Resting edges are drawn with normal compositing and live edges additively, so a dense graph stays readable where many edges cross.
- Under `prefers-reduced-motion: reduce`, edge jitter, flow packets and sync marks hold still.
- A click on a node selects it without grabbing it. Dragging starts after the pointer moves a few pixels, so selecting no longer reheats the layout.
