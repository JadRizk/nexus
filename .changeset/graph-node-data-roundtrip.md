---
"@nexus-cyberdeck/graph": minor
---

`GraphNodeSnapshot` now carries the node's `data`, so the payload you put on a
`GraphNode` comes back from `onSelect` and `controller.getNode(id)` as
`snapshot.data`: the same reference, not a copy, and `undefined` for a node
without one. The README and the `GraphNode.data` docs always said the payload
was round-tripped, but the snapshot had no such field, so you got `undefined`.
If you kept a parallel `id → data` map to look the payload up after a
selection, you can drop it.

The payload is typed too. `GraphNodeSnapshot`, `GraphController` and
`GraphCanvasProps` take an optional type parameter for the `data` type, and
`<GraphCanvas>` infers it from `nodes`: pass `GraphNode<Ticket>[]` and
`onSelect` receives a `GraphNodeSnapshot<Ticket>`; type the ref as
`useRef<GraphController<Ticket>>(null)` and `getNode` returns one as well. The
parameter defaults to `unknown`, so code that never names it compiles as
before. The one other type-level difference is `GraphCanvas` itself, which is
now declared as a generic function component rather than a
`ForwardRefExoticComponent`. That matters only if you read `$$typeof`,
`propTypes` or `defaultProps` off its type. The component is the same at
runtime and still forwards its ref.
