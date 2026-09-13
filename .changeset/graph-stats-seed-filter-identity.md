---
"@nexus-cyberdeck/graph": major
---

**Breaking:** `GraphStats` no longer carries `vertexAttribs` or `webglVersion`.
Both were constants of the host's GL context rather than per-frame telemetry —
they never changed over a canvas's life — and were left over from bringing the
edge program up. If you were displaying them, read them from your own context:
`renderer.getContext().getParameter(gl.MAX_VERTEX_ATTRIBS)`. Every other field
of `onStats` is unchanged.

`createPhysics(graph, { seed })` takes an optional seed. With one, the initial
scatter and the coincident-node nudge come from a small deterministic PRNG, so
the same graph and the same seed lay out identically every run — enough to pin
a layout in a test or a screenshot. Without one it is `Math.random`, exactly as
before; this is a PRNG swap and nothing else, and the stepping numerics are
untouched.

`hiddenNodeCategories` and `hiddenLinkCategories` are compared by content
instead of by reference. Written inline — `hiddenNodeCategories={["note"]}` —
they were a new array every render, which refiltered the scene and fired the
glitch kick on renders that had nothing to do with the graph. The README now
also says which props *do* need a stable reference (`nodes`, `edges`,
`nodeCategories`, `linkCategories`: a new reference rebuilds the whole scene),
and documents that category colours are handed to the GPU as linear-sRGB, so a
hex on the canvas does not match the same hex in CSS.

Label placement no longer allocates per frame — its candidate and collision
buffers are allocated once and refilled — and the device pixel ratio is
re-read on resize, so dragging the canvas to a display with a different density
no longer leaves it rendering at the old one until something remounts it.
