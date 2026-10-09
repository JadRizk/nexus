---
"@nexus-cyberdeck/graph": minor
---

`<GraphCanvas>` lays out the same graph the same way on every visit, and can give a layout structure.

- **Stable by default.** A new `seed` prop seeds the layout's random scatter and the per-node and per-edge shader seeds. Leave it out and the seed is derived from the node ids, so the same data draws the same picture every time, and screenshots are reproducible. Pass a number to pin a specific layout, or `seed={null}` for the old behaviour of a different layout on every mount. Positions also follow the order of `nodes`, so keep that order stable if you want a stable picture. **This changes what you see by default**: a graph that used to come up differently on each load now comes up the same way.
- **Arms and rings.** `NodeCategory.sectorAngle` pulls a category's nodes toward an angle from the origin, and `NodeCategory.radiusTarget` toward a distance from it. They are switched on with the new `physics.sectorForce` and `physics.radiusForce`, both defaulting to `0`. With both at `0` the solver steps exactly as before, which a test pins against a recorded 1.x run. Both are required fields on `PhysicsConfig` and `PhysicsParams`: if you build either object yourself, add them (or spread `DEFAULT_PHYSICS`).
- **Per-node overrides.** `GraphNode.size`, `sectorAngle` and `radiusTarget` override the category's value for one node, so a per-instance size no longer needs its own category.
- **`controller.reseed()`** re-scatters the nodes and restarts the layout without rebuilding the scene.
