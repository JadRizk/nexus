---
"@nexus-cyberdeck/graph": patch
---

`onSelect`, `onStats` and `onFatal` now always fire the current callback,
not the one that was passed on the render that first mounted the scene.
`<GraphCanvas>` builds its WebGL scene in a mount effect that intentionally
does not re-run when these props change (rebuilding on every render would
reallocate every GPU buffer), so a handler that closed over state — an
`onSelect` reading from a `useState` value, say — saw whatever that state
was on the first render, forever. The three callbacks are now read through
refs kept current in their own effect, the same pattern already used for
`optics`, `running`, `labelMode` and the hidden/isolate props.

No behavior change if your callbacks were stable (memoized or defined
outside the component); if they closed over changing state, they now
receive it.
