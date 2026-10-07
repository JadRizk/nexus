---
"@nexus-cyberdeck/graph": patch
---

`<GraphCanvas>` now validates the graph before it touches WebGL, and gives the
GL context back when it unmounts.

An edge whose `a`/`b` is not a node id, a duplicate node id, or a `categoryId`
missing from `nodeCategories`/`linkCategories` used to fail deep inside setup
as an opaque `TypeError` (`Cannot read properties of undefined`) — after the
renderer, its canvas, the label pool and a `ResizeObserver` had been created
and with nothing to release them. Each now fails up front with a message
naming the offending entry (for example
`GraphCanvas: edges[0].b references unknown node id "zzz"`), before a
`WebGLRenderer` exists, and anything setup does create before a later throw
is torn down on the way to the halt panel. If you were catching the old
`TypeError` text in `onFatal`, match on the new messages instead.

On unmount the renderer now calls `forceContextLoss()` after `dispose()`, so
the context is freed immediately rather than at garbage collection — under
React StrictMode, HMR, or a list of graphs that could previously exhaust the
browser's WebGL context limit. A lost context (`webglcontextlost`) now stops
the frame loop and reports through `onFatal` and the halt panel instead of
spinning against a dead context; nothing changes for consumers that do not
lose contexts.
