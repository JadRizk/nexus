---
"@nexus-cyberdeck/graph": minor
---

`<GraphCanvas>` can be read and travelled by keyboard and screen reader, on by default.

- **One Tab stop.** Tabbing into the graph speaks a summary ("Graph, 200 nodes, 621 connections in 5 kinds.") and the node you land on. Inside, ← → browse the node's connections without moving, ↑ ↓ narrow them to outgoing or incoming, Enter follows one, Backspace goes back, Home returns to where you entered, Space selects, D describes the node in detail, and ? lists the keys. Escape clears the selection, then dismisses the tooltip, then leaves the graph. Each step is spoken through a polite live region.
- **Visible too.** The focused node gets a ring drawn in the canvas, the connection Enter would follow stays bright while the node's other edges dim, a one-line key hint shows while focus is inside the graph, and the camera pans to keep the focused node in view.
- **The root is now a named `role="group"`** (with `aria-roledescription="graph"`) instead of `role="img"`, because the focus target inside it has to be reachable. If your own tests query the graph with `getByRole("img")`, query `getByRole("group", { name })` instead, or pass `keyboardNavigation={false}` to keep the 1.x image role. A development build warns when `ariaLabel` is missing.
- **New props:** `keyboardNavigation` (default true), `keyHints` (default true), `describeNode(node, ctx)` for your own wording, `rankConnections(a, b)` for your own connection order, and `onNavigate(event)` after every step.
- **New controller method:** `focusNode(id)` puts the reader on a node and moves focus into the graph, for example from a search box.
- The hover tooltip now sits beside the node, on the side fewer of its edges leave from, instead of under the pointer. Escape dismisses it.
- Under `prefers-reduced-motion: reduce`, the selection brackets no longer pulse.
