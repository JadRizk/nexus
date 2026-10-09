# @nexus-cyberdeck/graph

A force-directed WebGL graph canvas for React, built on Three.js, that can be
read and travelled by keyboard and screen reader as well as by pointer.

Nodes are SDF-rendered glyphs in six silhouettes. Edges carry their kind in
form as well as colour (straight, arc or etched routing, dash rhythm, and
brightness at rest) and their direction in their end pads, so neither depends
on colour or motion. The whole frame can pass through a CRT post-process
(bloom, barrel distortion, chromatic aberration, scanlines, grain).

It is a companion to the [Nexus Cyberdeck](https://github.com/JadRizk/nexus#readme)
design system and shares its visual language, but has no dependency on it. The
canvas is domain-agnostic: you supply the node and link categories.

Coming from 1.x? See [Migrating from 1.x](#migrating-from-1x).

## Install

```bash
npm install @nexus-cyberdeck/graph three
```

> Not published yet: the package is held `"private": true` until its first
> publish, so install from `npm pack` output in the meantime — see the
> [getting-started guide](https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md).

React 18.3 or 19 and Three.js 0.170 or later are peer dependencies.

The floor is checked: CI compiles this package against three@0.170.0 on every
pull request. The upper bound is optimistic — three ships breaking changes in
minor releases, and this package is developed against 0.185, so a much newer
release may need a fix here. It is left open deliberately, because a narrow
upper bound turns into an install-time `ERESOLVE` failure for everyone on a
newer three rather than a warning. If a release does break the canvas, please
open an issue.

## Use

```tsx
import { useRef, useState } from "react";
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import type {
  GraphController,
  GraphNodeSnapshot,
  NodeCategory,
  LinkCategory,
} from "@nexus-cyberdeck/graph";

const nodeCategories: Record<string, NodeCategory> = {
  topic: {
    label: "TOPIC",
    code: "TOP",
    tier: 0,
    shape: 1,
    color: "#C6F135",
    size: 3.2,
    charge: 3,
    mass: 3,
  },
  note: {
    label: "NOTE",
    code: "NDE",
    tier: 3,
    shape: 0,
    color: "#17E2E5",
    size: 1.7,
    charge: 1,
    mass: 1,
  },
  person: {
    label: "PERSON",
    code: "PER",
    tier: 2,
    shape: 3,
    color: "#9D7BFF",
    size: 2.2,
    charge: 1.5,
    mass: 1.5,
  },
};

const linkCategories: Record<string, LinkCategory> = {
  refs: {
    label: "LINK",
    color: "#3AC6D4",
    width: 1,
    dist: 1,
    strength: 0.55,
    routing: "etched",
    gain: 0.6,
    verb: "links to",
    inverseVerb: "linked from",
  },
  wrote: {
    label: "WROTE",
    color: "#9D7BFF",
    width: 1,
    dist: 1.1,
    strength: 0.3,
    routing: "arc",
    dash: 6,
    verb: "wrote",
    inverseVerb: "written by",
  },
};

const nodes = [
  { id: "t1", categoryId: "topic", label: "THRESHOLD//ATLAS" },
  { id: "n1", categoryId: "note", label: "liminal grammar" },
  { id: "p1", categoryId: "person", label: "OKONKWO" },
];
const edges = [
  { a: "t1", b: "n1", categoryId: "refs" },
  { a: "p1", b: "n1", categoryId: "wrote" },
];

export function Graph() {
  const controller = useRef<GraphController>(null);
  const [selected, setSelected] = useState<GraphNodeSnapshot | null>(null);

  return (
    <div style={{ position: "relative", width: "100%", height: 600 }}>
      <GraphCanvas
        ref={controller}
        ariaLabel="Notes and the people who wrote them"
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
      <button onClick={() => controller.current?.fit()}>Fit</button>
      <button onClick={() => controller.current?.back()}>Back</button>
    </div>
  );
}
```

The canvas fills its parent, so the parent needs a definite height. Always
pass `ariaLabel`: it names the graph for screen readers, and a development
build warns without it.

### Props that must keep a stable reference

`nodes`, `edges`, `nodeCategories` and `linkCategories` are compared by
identity, and a new reference tears the whole WebGL scene down and rebuilds it:
buffers, materials, render targets, the solver and its layout. Define them
outside the component or wrap them in `useMemo`, as the example above does by
putting them at module scope. Passing a literal inline (`nodes={[...]}`)
remounts the scene on every render, and the graph appears to reset itself
constantly.

Everything else is safe to pass inline. `hiddenNodeCategories`,
`hiddenLinkCategories`, `selectionScopedLinkCategories`, `fitInset` and the
`physics` and `optics` objects are compared by content, and every callback is
read through a ref.

## Data model

- **`GraphNode`**: `id`, `categoryId`, `label`, optional `state` (0 dormant,
  1 stable, 2 hot, 3 orphan), optional per-node `size`, `sectorAngle` and
  `radiusTarget` (overriding the category's), and an opaque `data` payload
  that comes back as `data` on the `GraphNodeSnapshot` that `onSelect` and
  `getNode` return — the same reference, never read internally. A node with
  no edges is always drawn as an orphan.
- **`GraphEdge`**: `a`, `b`, `categoryId`, optional `absentEnd` (`"a"` or
  `"b"`: a declared endpoint with nothing behind it, drawn as a trace that
  frays out and lands on no pad) and `data`.
- **`NodeCategory`**: how a category looks and behaves. `shape` is an index into
  the six glyph silhouettes (circle, hexagon, diamond, ring, square, triangle),
  `color` is a real hex because it is bound to the GPU, `tier` is the zoom level
  at which labels appear, and `size`, `charge`, `mass` feed the solver.
  Optional `sectorAngle` and `radiusTarget` give the category an arm and a ring
  to settle on (see [Layout](#layout)).
- **`LinkCategory`**: `color`, `width` (a half-width, scaled by
  `optics.edgeWidth`), rest distance (`dist`, a multiplier of
  `physics.linkDistance`) and `strength`. Optional:
  - `routing`: `"straight"` (default), `"arc"` (bowed by `curve`) or `"etched"`
    (axis, 45°, axis, like a circuit trace).
  - `gain`: brightness at rest (default 1), so a structural scaffold and a
    meaningful link can share a width.
  - `dash`: dash period in screen pixels, the same at any zoom.
  - `directed`: default true. A directed edge ends in a filled bar at `a` and an
    open bracket at `b`; an undirected one gets a bar at both ends.
  - `verb` / `inverseVerb`: how a screen reader reads the relation from each
    end, e.g. `"cites"` / `"cited by"`.
  - `flow`: packet speed along the edge (negative reverses; 0 is none), and
    `jit` for an unstable-looking edge (a travelling sine at 11 rad/s, scaled
    to zero under `prefers-reduced-motion`).

## Props

Everything is a controlled prop: the canvas notifies and the consumer owns
state.

| Prop                                           | Purpose                                                                                                                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes`, `edges`                               | the graph                                                                                                                                                                                                                               |
| `nodeCategories`, `linkCategories`             | per-category appearance and physics                                                                                                                                                                                                     |
| `ariaLabel`                                    | the graph's accessible name. Pass it                                                                                                                                                                                                    |
| `physics`                                      | partial `PhysicsConfig`: `repulsion`, `linkDistance`, `gravity`, `damping`, `cursorForce`, `sectorForce`, `radiusForce`, `settle`                                                                                                       |
| `optics`                                       | partial `OpticsConfig`: `glow`, `trails`, `edgeOpacity`, `edgeWidth`, `flowSpeed`, `scan`, `aberr`, `curve`, `grain`, `bloom`, `glitch`. `DEFAULT_OPTICS` and `DEFAULT_PHYSICS` are exported for your own controls                      |
| `labelMode`                                    | `"auto"` (by tier and zoom), `"key"`, `"all"`, `"off"`                                                                                                                                                                                  |
| `hiddenNodeCategories`, `hiddenLinkCategories` | category ids to hide                                                                                                                                                                                                                    |
| `selectionScopedLinkCategories`                | link categories drawn only on edges touching the selected node                                                                                                                                                                          |
| `isolateId`                                    | show only this node and its neighbours                                                                                                                                                                                                  |
| `selectedId`                                   | the selected node; update it from `onSelect`                                                                                                                                                                                            |
| `followSelection`                              | default `true`: selecting frames the node and its neighbours, clearing frames everything. `false` leaves the camera to you                                                                                                              |
| `fitInset`                                     | `{ top, right, bottom, left }` in CSS px covered by your own floating panels; every framing lands in the space left                                                                                                                     |
| `seed`                                         | layout seed. Default: derived from the node ids, so the same graph draws the same way every visit. `null` for a random layout per mount                                                                                                 |
| `running`                                      | run the physics solver; `false` pauses it (dragging still works). Default `true`                                                                                                                                                        |
| `invalidEdges`                                 | `"error"` (default) fails on an edge to an unknown node; `"drop"` leaves it out and reports it through `onWarning`                                                                                                                      |
| `keyboardNavigation`                           | default `true`; see [Keyboard and screen readers](#keyboard-and-screen-readers)                                                                                                                                                         |
| `keyHints`                                     | default `true`: show the one-line key hint while focus is in the graph                                                                                                                                                                  |
| `describeNode`, `rankConnections`              | your own wording for a node, and your own order for its connections                                                                                                                                                                     |
| `onSelect`, `onStats`, `onFatal`, `onWarning`  | selection, stats about twice a second, WebGL setup failure or context loss, recoverable problems. A lost context is terminal: three asks the browser to restore it, but the canvas does not resume when it does — remount it to recover |
| `onNavigate`                                   | after every keyboard or screen-reader step                                                                                                                                                                                              |
| `onFrame`                                      | every frame, with live node positions and the camera, for syncing your own DOM. The arrays are reused, so read them during the call                                                                                                     |

### Controller

The `ref` exposes a `GraphController`:

```ts
controller.current?.fit(); // frame every visible node and resume the auto-fit
controller.current?.focus(id); // centre one node, zoomed in, following it while it settles
controller.current?.focusNode(id); // put the keyboard on a node and move focus into the graph
controller.current?.back(); // undo the last move: a followed connection, a click, a cleared selection
controller.current?.canGoBack; // whether back() has anywhere to go
controller.current?.reheat(); // nudge the solver back above rest
controller.current?.reseed(); // re-scatter and lay out again, without rebuilding the scene
controller.current?.getNode(id); // GraphNodeSnapshot with degree, adjacency and your data
```

`GraphCanvasProps`, `GraphController` and `GraphNodeSnapshot` take the payload
type as a parameter (`unknown` by default). `<GraphCanvas>` infers it from
`nodes`, so `GraphNode<Ticket>[]` hands `onSelect` a
`GraphNodeSnapshot<Ticket>` — but the ref is an inference site too, so type it
`useRef<GraphController<Ticket>>(null)`; an untyped `useRef<GraphController>`
widens the payload back to `unknown` for `onSelect` as well as `getNode`.
`describeNode`, `rankConnections` and `onNavigate` see the same `T`.

## Keyboard and screen readers

The graph is a single Tab stop, a named group. Tabbing in speaks a summary
("Graph, 120 nodes, 340 connections in 4 kinds.") and the node you land on.
From there you travel along connections rather than tabbing node by node,
because a graph has no reading order to tab through:

| Key       | Does                                                                   |
| --------- | ---------------------------------------------------------------------- |
| ← →       | browse the current node's connections, strongest first, without moving |
| ↑ ↓       | show all, outgoing or incoming connections                             |
| Enter     | follow the connection under the cursor                                 |
| Backspace | go back the way you came                                               |
| Home      | return to where you entered                                            |
| Space     | select or deselect the node (through `onSelect`)                       |
| D         | describe the node in detail                                            |
| ?         | list the keys                                                          |
| Escape    | clear the selection, then dismiss the tooltip, then leave the graph    |

Each step is spoken through a polite live region, as relation, far node, kind
and position: "cites ARCHIVE-343, source. 1 of 6, strongest". Name your
relations with `verb` and `inverseVerb` so they read well. Visually, the
focused node gets a ring drawn in the canvas, the connection Enter would follow
stays bright while the node's other edges dim, a one-line key hint appears, and
the camera pans to keep the focused node in view.

History is shared with the pointer: clicking a node or clearing the selection
is a step `back()` can undo, the same as Backspace, so a Back button in your
own UI behaves like the key.

`onSelect`'s second argument says where a selection came from: `"pointer"`,
`"keyboard"` (a key inside the graph) or `"controller"` (`back()`). A detail
panel that opens on selection should stay non-modal for `"keyboard"`, so focus
stays in the graph and the reader keeps their place, and take focus for the
others. The showcase's drawer does exactly that.

Pass `keyboardNavigation={false}` to turn it off, and the root becomes a named
`role="img"` instead.

### A text alternative

`describeGraph()` returns the whole graph as an outline, worded and ranked the
same way: a summary, then each category's nodes with their connections. Pass it
the same filters you pass the canvas (the hidden categories and `isolateId`),
and render it with `<GraphOutline>` from
`@nexus-cyberdeck/react`, or your own markup:

```tsx
import { describeGraph } from "@nexus-cyberdeck/graph";
import { GraphOutline } from "@nexus-cyberdeck/react";

const outline = useMemo(
  () => describeGraph({ nodes, edges, nodeCategories, linkCategories, hiddenNodeCategories }),
  [nodes, edges, hiddenNodeCategories],
);

<GraphOutline data={outline} selectedId={selected?.id ?? null} onSelect={selectById} />;
```

It is the better tool for questions node-link diagrams answer badly, like what
two nodes have in common, and for readers who would rather not travel the
canvas at all. Offering it beside the canvas, behind a "View as list" toggle,
is what the showcase does.

## Layout

The layout is a force-directed solver, seeded so the same nodes in the same
order land in the same places on every visit. Readers learn where things are,
and screenshots are reproducible. `controller.reseed()` re-scatters on demand.

To give a layout structure, set `sectorAngle` (radians) and `radiusTarget`
(world units) on a category, or on individual nodes, and turn on
`physics.sectorForce` and `physics.radiusForce`. Nodes then settle on their
arm and ring instead of wherever repulsion leaves them. Both forces default to
0, and with both at 0 the solver steps exactly as 1.x did.

## Camera

On mount the camera sweeps out to the graph and keeps framing it as the layout
spreads, until the reader pans or zooms; dragging a node doesn't count.
`fitInset` keeps that framing, and every other, clear of panels that float over
the canvas. Selecting a node frames it and its neighbours (`followSelection`),
and `focus()` and keyboard focus follow a node while the layout settles.

## Reduced motion

The canvas reads `prefers-reduced-motion` itself — its CRT pass is WebGL, so
no stylesheet rule can reach it — and listens for the setting to change while
it is mounted, so flipping it in the OS takes effect on the next frame without
a remount. The split is the one the CSS CRT layer in `@nexus-cyberdeck/react`
makes, motion versus texture:

- **Goes to zero**: the glitch bands (15 Hz), the grain (re-rolled at 24 Hz),
  the rolling refresh bar, the trails, edge jitter, the intro sweep, and the
  pulse of the selection brackets.
- **Held still**: flow packets and the sync marks on live edges keep their
  place, so a live edge still reads as live.
- **Lands at once**: every camera move, instead of gliding.
- **Clamped**: the HOT-node flicker re-rolls at 0.94 Hz instead of 9 Hz,
  the same cap the tokens layer puts on its blink and under the 3 Hz flash
  threshold in WCAG 2.3.1, and its trough is lifted so a node blinks rather
  than strobes.
- **Unchanged**: the static scanlines, aperture grille, barrel curve,
  chromatic aberration and vignette, since they are texture, not motion; and
  the physics solver, which lays the graph out.

Direction never depends on motion: it is drawn by the end pads, and the flow
packet only reinforces it.

The `optics` values you pass are left as they are, gated on the GPU by a
`uReduced` uniform rather than overwritten, so nothing needs restoring when the
preference is switched off again. The current state is mirrored onto the
`<canvas>` as `data-nx-reduced-motion="true"` or `"false"` for tests and
styling hooks. Where `window.matchMedia` does not exist (jsdom, server
rendering) the canvas behaves as though the preference is off.

## Migrating from 1.x

2.0 changes how edges look and how the graph is reached. In order of how likely
each is to affect you:

1. **`LinkCategory.arrow` is gone.** Direction is drawn by the end pads. Delete
   `arrow`, and set `directed: false` where it was `false`.
2. **`LinkCategory.dash` is in screen pixels.** 1.x values of about 1–3 need to
   grow to about 4–8.
3. **Default optics changed** for the new edge shader: `edgeWidth` 2.4 → 1.3,
   `edgeOpacity` 0.5 → 0.4, `aberr` 1.0 → 0.5. `edgeWidth` is now a half-width
   the shader scales up, so keeping 2.4 draws edges about twice as heavy. If
   you copied the old defaults into your own controls, use `DEFAULT_OPTICS`.
4. **The root is a named `role="group"`, not `role="img"`**, because the
   keyboard's focus target lives inside it. Tests that find the graph with
   `getByRole("img")` should use `getByRole("group", { name })`, or pass
   `keyboardNavigation={false}` to keep the image role.
5. **The layout is the same every visit by default.** The seed is derived from
   the node ids. Pass `seed={null}` for 1.x's random layout per mount.
6. **The intro and selection camera behave differently.** The intro tracks the
   settling layout instead of landing on a fixed guess; selection framing
   follows the node while it settles, and respects `fitInset`. Pass
   `followSelection={false}` to drive the camera yourself.
7. **A click selects without grabbing.** Dragging starts after a few pixels of
   movement, so selecting no longer reheats the layout.
8. **`GraphStats` gained `drawnNodes`**, required if you construct one.

Everything else is additive. See the [CHANGELOG](./CHANGELOG.md) for the full
list.

## Notes

- Set `optics.curve` to `0` to disable the barrel warp entirely. That removes
  the warp, not the cost: the CRT pipeline is three offscreen render targets
  and four passes per frame (render to texture, a thresholded horizontal blur,
  a vertical blur, then the full-screen composite), all of which run regardless
  of `curve`. It is meant for a hero canvas, not a thumbnail.
- The physics solver, camera maths, framing and shader sources are exported too
  (`createPhysics`, `project`, `fitBounds`, `NODE_FS`, …) for anyone who wants
  to build a different renderer on the same engine.

## License

MIT
