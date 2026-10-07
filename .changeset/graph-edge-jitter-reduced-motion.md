---
"@nexus-cyberdeck/graph": minor
---

Two fixes to `<GraphCanvas>`.

The edge jitter — the small travelling sine that shivers an edge at 11 rad/s —
was the one motion source `prefers-reduced-motion` did not reach. It is now
scaled away by `uReduced` along with the glitch, grain, roll bar and trails, so
under `reduce` an edge sits on its true path. Nothing changes when the
preference is off. `EDGE_VS` gains the `uReduced` float uniform the other
programs already have; anyone compiling it into their own renderer can supply
it, and leaving it unset reads as 0, which keeps the old motion.

Booting the canvas no longer logs `THREE.BufferGeometry.computeBoundingSphere():
Computed radius is NaN` to the console, three or four times per mount. Three
depth-sorts the scene while projecting it and reads each geometry's bounding
sphere, and computes it from the `position` attribute when it is missing — which
for these 2-component, vertex-shader-positioned geometries gave NaN. The four
meshes now carry a hand-set unbounded sphere. Draw order is unchanged: it comes
from `renderOrder`, with depth testing off.
