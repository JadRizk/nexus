# Spec: bring the qrntn graph back into `@nexus-cyberdeck/graph`

|           |                                                                                    |
| --------- | ---------------------------------------------------------------------------------- |
| Status    | Approved, phase 1 in progress                                                      |
| Date      | 2026-10-09                                                                         |
| Target    | `packages/graph` → `@nexus-cyberdeck/graph@2.0.0`                                  |
| Source    | `JadRizk/qrntn` @ `da0823b`, directory `nexus/packages/graph` (+ `nexus/src/a11y`) |
| Fork base | Nexus `84f8eca` (2026-08-25, "Extract graph engine into @nexus/graph")             |
| Research  | [`graph-usability-research.md`](./graph-usability-research.md) (R1–R12)            |

## 1. Summary

qrntn vendored this package on 2026-08-25 and has since rebuilt most of it. It
rewrote the edge renderer and added routing, terminal pads, fray and two-pass
blending. It added structural layout forces, auto-fit camera tracking, a fit
inset and a per-frame geometry hook. It split the engine into pure modules,
and in its app layer it added a keyboard and screen-reader overlay. Nexus kept
moving too: callback refs, pre-WebGL validation, context loss,
`prefers-reduced-motion`, seeded physics, `ariaLabel`, a contrast fix and a DPR
fix all landed after the fork.

So this is a **two-way merge, not a copy.** qrntn's version becomes the base.
Every hardening fix Nexus made since the fork is re-applied on top of it.

The usability research turned the merge into a **combination of the two
graphs**:

- From qrntn: rendering, relating, the camera and the layout structure.
- From Nexus: robustness, motion safety, and a static way to read edge
  direction.
- New, because neither graph has it: navigation. That covers keyboard and
  screen-reader traversal along a node's connections, a history stack, visible
  key hints, and a text alternative.

qrntn's overlay supplies the mechanism (a DOM layer synced to the canvas). Its
navigation model, one Tab stop per node, is replaced, because that is the
pattern the research found disorienting.

Size of the drift, after both sides are run through Prettier:

| File                                                         |    base → qrntn | base → Nexus |
| ------------------------------------------------------------ | --------------: | -----------: |
| `GraphCanvas.tsx`                                            |             949 |          377 |
| `shaders.ts`                                                 |             377 |           49 |
| `physics.ts`                                                 |             172 |           54 |
| `types.ts`                                                   |              96 |           25 |
| `camera.ts`                                                  |               0 |            2 |
| new: `labels.ts`, `neighbourhood.ts`, `picking.ts` (+ tests) | 281 + 293 tests |            — |

## 2. Goals and non-goals

**Goals**

1. qrntn's graph becomes the default and only graph in this library. No second
   engine and no feature flag that keeps the old edge renderer alive.
2. No Nexus hardening fix regresses. Every item in §4.1 is covered by a test
   after the merge.
3. A keyboard or screen-reader user can do the core graph tasks, using only
   the package and no app code. The core tasks are adjacency ("what is X
   connected to, and how"), following a path, going back, and selecting
   (research §1.1, R3).
4. Every relationship can be read without colour and without motion: type by
   form, direction by a static cue (R1, R2).
5. The same data draws the same picture on every visit (R6).
6. The API stays generic. Nothing from qrntn's domain (skills, ghosts, vendors,
   `KIND_ORDER`) enters the package.
7. qrntn can drop its vendored copy afterwards and depend on the published
   package (§9).

**Non-goals**

- An outline-fill node shape (qrntn's "authored vs acquired" gap). This needs a
  new shader axis and gets its own ticket.
- qrntn's app chrome (`ControlsPanel`, `StatsPanel`, `TypeLegend`,
  `DetailsDrawer`, `ReadingPane`). Some of it could become `@nexus-cyberdeck/react`
  components later, but it is not part of this migration.
- Performance work beyond what §6.6 requires.
- Expand on demand and grouping nodes into combos (R10). The API must not rule
  them out, but they are not built here.
- Sonification. QUARTZ uses it, but nothing in this package needs it to meet
  the goals above.

## 3. What qrntn changed (the incoming side)

### 3.1 Module split (behaviour-preserving)

The following code came out of `GraphCanvas.tsx` verbatim, as pure functions
with unit tests:

- **`labels.ts`**: `createLabelPlacer({ poolSize, labelHeight, measure })` →
  `place(view, out)`. This is the placement decision only: which nodes earn a
  label, the collision boxes, and opacity. The DOM pool stays in
  `GraphCanvas`. Text measurement is injected, so tests can stub it. It is
  allocation-free per frame and uses scratch buffers that are only resized
  when the node count changes. Equal scores sort stably, and a test pins that.
- **`neighbourhood.ts`**: `computeNeighbourhood(graph, idx, outDepth,
outTier)` runs a BFS to depth 3 and assigns three edge tiers: incident `1`,
  nearby `TIER_NEARBY = 0.45` (both ends at depth `<= NEARBY_DEPTH = 2`), and
  `0` for everything else. **There is a real behaviour change here:** the base
  only had incident and "other", so edges between two neighbours were dimmed.
- **`picking.ts`**: `pickNode(x, y, count, pos, radii, hidden, zoom)`.

### 3.2 Physics

- `NodeCategory.sectorAngle` (radians) adds a tangential pull toward an arm.
  `NodeCategory.radiusTarget` adds a radial spring toward a ring, which
  _replaces_ gravity for that node.
- `PhysicsConfig.sectorForce` and `radiusForce` both default to `0`, which
  turns the feature off and leaves existing behaviour unchanged.
- A separate annealing schedule, `structAlpha`, decays 6× slower than `alpha`
  so that constraint forces don't die before a node arrives.
- The radial spring gets a critical-damping term, clamped at ≥ 0, so it never
  overshoots at high `damping`.
- `seedPositions()` seeds a targeted node _near_ its polar target
  (±20° and ±35 units) instead of on the generic spiral.
- `Physics.reseed()` and `GraphController.reseed()` re-scatter the nodes and
  restart the layout without remounting the scene.

### 3.3 Edge rendering: a rewrite

`EDGE_VS` and `EDGE_FS` are new. `NODE_*`, `FADE_*`, `POST_VS`, `BLUR_FS` and
`COMPOSITE_FS` are unchanged from the base.

- **Three separate channels:** TRACE (routing, width, pads), SIGNAL (packets,
  sync marks) and STATE (alpha and blend mode only). **Hover and selection no
  longer change geometry.** Width is constant.
- **`LinkCategory.routing`**: `"straight" | "arc" | "etched"`. Etched edges run
  axis, then 45°, then axis, with no 90° corner and no popping. Routing shares
  the `curve` float through a single encoder, `encodeRouting()`, with
  `ROUTE_ETCHED = -1000` as a magnitude sentinel. That sentinel fixes a bug
  where odd-indexed arcs rendered as etched edges.
- **`LinkCategory.gain`** is a per-category intensity multiplier. It separates
  "scaffold" edges from "claim" edges at the same width.
- **`GraphEdge.absentEnd`** (`"a" | "b"`): the trace frays out toward a
  declared but empty endpoint, and no pad is drawn there.
- **Terminal pads**: `PAD_VS` and `PAD_FS` draw two quads per edge. They share
  the edge instance buffers and evaluate the same `ROUTE_GLSL`.
- **Two passes**: resting edges composite with premultiplied alpha, so
  crossings don't sum to white. Live (incident) edges stay additive. `uPass`
  makes each pass discard the other pass's instances. Render order is
  fade -10 < edges 0 < pads 1 < live edges 2 < nodes 3.
- **Dash periods are in screen pixels**, so they no longer turn solid when you
  zoom out.
- Hovered and incident edges always carry a packet, even with `flow: 0`, plus
  sync marks. Both are gated by a new `uSignal` uniform.
- Edges use `side: DoubleSide`. Without it, curved edges with flipped winding
  were silently culled.
- **`LinkCategory.arrow` is removed.** Its attribute slot now carries `gain`,
  and the flow packet carries direction instead. `ARROW_T` is gone.
- Endpoint trim is symmetric (`EDGE_END_TRIM = 1.15`).
- `EDGE_ATTRS` describes the attribute layout. Buffers are sized from it, and
  the program stays at 7 attribute slots (the WebGL1 floor is 8).
- **New default optics** (calibrated for the new shader): `edgeOpacity` 0.5 →
  0.4, `edgeWidth` 2.4 → 1.3, `aberr` 1.0 → 0.5.

### 3.4 Camera

- **Auto-fit tracking.** The intro is now a sweep. `camZoom` starts
  `INTRO_ZOOM_MULTIPLIER = 6`× tighter than a real `fitToView()`, and from
  there `camT` follows _low-pass-filtered_ graph bounds for as long as the
  solver is unsettled. Panning or wheeling hands the camera over (`autoFit =
false`). Dragging a node does not.
- **Follow.** `focus(id)` rides the node until the layout settles or the user
  takes the camera.
- **`fitInset`** (`Partial<FitInset>`) is chrome that floats over the canvas.
  `fit()`, auto-fit and `focus()` all frame into the free box. Changing the
  inset re-frames, but only while auto-fit still owns the camera.
- **Select-to-zoom was removed from the engine** (`cameraFollowSelection`).
  qrntn's app does it with `focus()` and `fit()` instead.

### 3.5 Props, controller and stats

- `selectionScopedLinkCategories`: link categories drawn only on edges that
  touch `selectedId`.
- `onFrame(geometry: FrameGeometry)` fires every frame with ids, positions,
  hidden flags, radii, camera and viewport. The arrays are reused, so read
  them synchronously.
- `GraphStats.drawnNodes` is the number of nodes still visible after filters
  and isolation.
- `DEFAULT_PHYSICS` and `DEFAULT_OPTICS` are exported.
- `physicsParamsOf()` is a single list of forwarded fields, used both on mount
  and by the update effect.
- The disposer list is filled as `boot()` goes, and torn down on a throw.
- `unbounded()` gives every geometry a bounding sphere (the NaN-radius log).
- An edge with an unknown endpoint is **dropped with a `console.warn`**.

### 3.6 Accessibility overlay (qrntn app layer, `src/a11y/domOverlay.ts`)

- There is one `<button>` per structurally visible node. It is positioned over
  the glyph every frame through `onFrame`, using `project()` and
  `glyphRadiusPx()`.
- Visibility is _structural_ (filters and isolate), not label decluttering.
  That way a keyboard user can reach everything a mouse user can, without
  zooming first.
- Tab order follows the legend's category order, then id. Arrow keys cycle
  through graph neighbours. Enter and Space select. Escape on the container
  clears selection.
- `pointer-events: none` is always set, so canvas picking still owns the
  mouse.
- Focus is blurred when its node is hidden.
- The labels are domain-specific (`ariaLabelFor`) and spoken mid-sentence, so
  they are lowercase and spelled out.

## 4. What Nexus changed since the fork (must survive)

### 4.1 Re-apply on top of qrntn's code

| #   | Nexus change                                                                                                             | Where it lands after the merge                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| N1  | `onSelect`, `onStats` and `onFatal` are read through refs (#38)                                                          | qrntn only did `onStats`/`onFrame`. Also route `onSelect` (`onClick`) and `onFatal` through refs.                   |
| N2  | Graph validated **before** WebGL: unknown edge endpoint, duplicate node id, missing category, with a named message (#40) | Keep the validator. It conflicts with qrntn's drop-and-warn. See D1.                                                |
| N3  | `forceContextLoss()` after `dispose()`; `webglcontextlost` stops the loop and reports through `onFatal` (#40)            | Add both to qrntn's renderer disposer.                                                                              |
| N4  | `prefers-reduced-motion`, tracked live and mirrored as `data-nx-reduced-motion` (#39, #46)                               | Node flicker, fade and composite carry over unchanged. **The edge shader must be re-gated from scratch**, see §6.4. |
| N5  | Seeded PRNG in physics (`mulberry32`, `PhysicsOptions.seed`) (#43)                                                       | qrntn's `seedPositions()` and `reseed()` must draw from `random()`, not `Math.random`. See §6.2.                    |
| N6  | `ariaLabel` prop, `role="img"` only when named, label pool and tooltip `aria-hidden` (#14)                               | Kept, but the role changes once the overlay exists. See §6.5.                                                       |
| N7  | Tooltip secondary text `#6F8465` (AA, 4.52:1 worst case)                                                                 | Carry over. `GraphCanvas.contrast.test.ts` keeps guarding it.                                                       |
| N8  | DPR re-read on every resize                                                                                              | Carry over into qrntn's `resize()`.                                                                                 |
| N9  | `vertexAttribs` and `webglVersion` removed from `GraphStats`                                                             | Keep removed. qrntn still emits them, so drop them.                                                                 |
| N10 | Initial physics prop applied, gravity and damping forwarded (#15)                                                        | Already subsumed by qrntn's `physicsParamsOf()`.                                                                    |
| N11 | Glitch intro `kick(0.8)` gated on `!reduced`                                                                             | qrntn deleted the kick. Keep it, gated (it rides the sweep).                                                        |

### 4.2 Already converged (take either side, verify once)

- The disposer list collected during `boot()` (Nexus `disposables`, qrntn
  `disposers`).
- `unbounded()` bounding spheres (NX-45).

### 4.3 Nexus-only test suites to keep green

`GraphCanvas.a11y`, `.callbacks`, `.contrast`, `.physics` and
`.reduced-motion`, plus `camera` and `physics`. qrntn's `labels`,
`neighbourhood`, `picking`, `shaders`, `camera` and `physics` suites come in
alongside them.

## 5. Decisions

Each decision has a recommendation. **D1–D3 were decided on 2026-10-09: the
recommended option for each.**

**D1 ✓ Edges with an unknown endpoint.** Nexus throws before WebGL (released
in a changeset). qrntn drops them and warns, because real data goes stale.
_Recommendation:_ add `invalidEdges?: "error" | "drop"`, defaulting to
`"error"`. `"drop"` keeps qrntn's behaviour and reports the dropped edges
through a new `onWarning` callback instead of `console.warn`. Duplicate ids and
missing categories still always throw.

**D2 ✓ Select-to-zoom.** Nexus 1.x zooms to the neighbourhood when a node is
selected. qrntn removed that from the engine and drives it from the app.
_Recommendation:_ add `followSelection?: boolean`, defaulting to `true`. Build
it on qrntn's `focus()`/`fit()`/`follow`, so the inset and the unsettled layout
are handled correctly. qrntn passes `false`, or deletes its effect and uses
the default.

**D3 ✓ Where navigation lives, and which model it uses.**
_Recommendation:_ inside `GraphCanvas`, on by default, using the
connection-traversal model in §6.5 (research R3–R5, R7), not qrntn's tab stop
per node. Navigation is the headline reason for this migration, and opt-in
accessibility is rarely turned on.

**D4 Arrowheads and direction.** Remove `arrow` with no compatibility shim. Its
attribute slot is now `gain`. Direction stays readable without motion through
**asymmetric terminal pads** (§6.4.1, R2): a filled pad at the source and an
open bracket at the target. Without that, direction would be shown only by the
flow packet, which freezes under reduced motion. Removing `arrow` is breaking,
so it goes in the 2.0.0 notes. The showcase's sample data moves to `flow`.

**D5 Default optics.** Adopt qrntn's values. The new shader treats `edgeWidth`
as a register half-width, multiplied by `EDGE_SPAN = 2.6`, so the old value
2.4 would draw edges about 2× too heavy. This is not optional.

**D6 Per-node layout overrides (new, small).** qrntn creates one category per
node because `size`, `sectorAngle` and `radiusTarget` only exist per category.
That inflates the category maps and breaks "hide this kind" filters without a
helper. _Recommendation:_ add optional `GraphNode.size`, `sectorAngle` and
`radiusTarget`, which override the category value. This is additive, so qrntn
can collapse to one category per kind afterwards.

**D7 Expose the seed.** Add `seed?: number` to `GraphCanvasProps`. It feeds the
physics PRNG _and_ the per-node and per-edge shader seeds (`nSeed`, `eP1.y`),
which are `Math.random` on both sides today. With it, browser screenshot
baselines are deterministic, provided the showcase sample-data generator
(`apps/showcase/src/graph/sampleData.ts`, also `Math.random`) takes the same
seed. `reseed()` keeps advancing the same PRNG, so a seeded reseed sequence is
reproducible as well. **When `seed` is omitted, it defaults to a stable hash of
the sorted node ids** rather than `Math.random`. The same data then draws the
same picture on every visit, which preserves the reader's mental map (R6). Pass
`seed={null}` to opt back into a random layout.

**D9 History is an engine feature.** The package keeps a back stack of focus
and selection, and exposes `controller.back()` and `canGoBack`. Keyboard users
reach it with Backspace. A mouse user can reach it through a Back button in
the consumer's chrome (R5).

**D10 A text alternative ships with the package.** The headless
`describeGraph()` lives in `@nexus-cyberdeck/graph`. An optional
`<GraphOutline>` component in `@nexus-cyberdeck/react` renders it as a
navigable list behind a "view as list" toggle (R8). The graph itself still
names its connections through §6.5. The outline is for skimming and for
common-neighbour tasks, where node-link diagrams are weakest.

**D8 Version.** `@nexus-cyberdeck/graph@2.0.0`. It removes `arrow`, changes the
default optics, changes the edge look, changes the root role, and adds tiered
hover. The pending 1.x changesets ship first as 1.2.0 if a release is cut
before this lands. Otherwise they fold into 2.0.0.

## 6. Target design

### 6.1 Module layout (`packages/graph/src`)

```
camera.ts            + fitBounds / insetOffset / FitInset (framing maths)
camera-rig.ts        new: who owns the camera — reader, focus, auto-fit — and its easing (pure)
physics.ts           qrntn + seeded PRNG + per-node overrides
neighbourhood.ts     new (qrntn)
picking.ts           new (qrntn)
labels.ts            new (qrntn)
shaders.ts           qrntn edge/pad + Nexus uReduced everywhere
validate.ts          new: Nexus's pre-WebGL validator, extracted (pure, testable)
describe.ts          new: describeGraph / describeNode — phrasing for announcements and the outline (pure)
a11y/navigator.ts    new: navigation state machine — current node, browse cursor, direction filter, history (pure, no DOM)
a11y/overlay.ts      new: DOM layer from qrntn's domOverlay — focus element, live region, key hints (imperative)
a11y/adjacency.ts    new: ranked connection lists per node, generic
GraphCanvas.tsx      qrntn shell + §4.1 re-applications
types.ts             merged, §6.3
index.ts             + DEFAULT_PHYSICS, DEFAULT_OPTICS, encodeRouting, EDGE_ATTRS, NEARBY_DEPTH, TIER_NEARBY
```

The goal is for `GraphCanvas.tsx` to shrink toward wiring code. Anything with
logic that can be tested without WebGL lives in its own module.

### 6.2 Physics merge

```ts
createPhysics(graph, { seed })      // random = seed === undefined ? Math.random : mulberry32(seed)
seedPositions()                     // every Math.random → random()
reseed()                            // continues the same stream; no re-seeding of the PRNG
PhysicsNode.{sectorAngle,radiusTarget} ← node override ?? category value   (D6)
```

The `physics.test.ts` determinism test ("same seed gives byte-identical
positions") must still pass, and must also cover a graph that uses
`sectorAngle`/`radiusTarget` and a `reseed()`.

### 6.3 Public API delta (`types.ts`)

```ts
// GraphNode<T>
size?: number; sectorAngle?: number; radiusTarget?: number;          // D6, new

// GraphEdge<T>
absentEnd?: "a" | "b";                                               // qrntn

// NodeCategory
sectorAngle?: number; radiusTarget?: number;                         // qrntn

// LinkCategory
- arrow?: boolean                                                    // removed (D4)
+ gain?: number; routing?: LinkRouting;                              // qrntn
export type LinkRouting = "straight" | "arc" | "etched";

// PhysicsConfig
sectorForce: number; radiusForce: number;                            // qrntn, default 0

// GraphStats
drawnNodes: number;                                                  // qrntn
// (no vertexAttribs / webglVersion — Nexus N9)

export interface FrameGeometry { … }                                 // qrntn
export interface FitInset { top; right; bottom; left }               // qrntn

// GraphController
reseed(): void;                                                      // qrntn

// GraphCanvasProps
selectionScopedLinkCategories?: readonly string[];                   // qrntn
fitInset?: Partial<FitInset>;                                        // qrntn
onFrame?: (g: FrameGeometry) => void;                                // qrntn
seed?: number | null;               // default: hash of node ids     // D7, R6
followSelection?: boolean;          // default true                  // D2
invalidEdges?: "error" | "drop";    // default "error"               // D1
onWarning?: (message: string, detail?: unknown) => void;             // D1
ariaLabel?: string;                                                  // Nexus, kept; required when navigation is on
keyboardNavigation?: boolean;       // default true                  // §6.5
keyHints?: boolean;                 // default true                  // R7
describeNode?: (node: GraphNode, ctx: DescribeContext) => string;    // §6.5; default "<label>, <category label>"
rankConnections?: (a: Connection, b: Connection) => number;          // §6.5; default: strength, then category order, then label
onNavigate?: (event: NavigateEvent) => void;                         // §6.5; fires on focus/follow/back

// LinkCategory (announcement phrasing)
verb?: string;        // "uses" — forward reading, a → b                // §6.5
inverseVerb?: string; // "used by" — backward reading, b → a           // §6.5
directed?: boolean;   // default true; false = symmetric ("overlaps")  // §6.5, §6.4.1

// GraphController
back(): void;                                                        // D9
readonly canGoBack: boolean;                                         // D9
focusNode(id: GraphNode["id"]): void;  // keyboard focus, not selection; also moves the camera (R4)

// Exports
describeGraph(input): GraphOutlineData;                              // D10
export type { Connection, DescribeContext, NavigateEvent, GraphOutlineData };
```

`Connection` is `{ edge, other, category, direction: "out" | "in" | "both",
strength }`. `strength` is the category's `gain × strength`, so it ranks with
no extra data. A consumer that has real edge weights can pass them through
`GraphEdge.data` and a custom `rankConnections`.

The package is built with `tsconfig.base.json` (`strict`). qrntn's code was
written under `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
`noPropertyAccessFromIndexSignature`, which are stricter. It compiles under
the looser config without changes. Keep qrntn's conditional-spread idiom for
optional keys, because physics distinguishes "absent" from `undefined`.

### 6.4 Reduced motion in the new edge shader

qrntn's edge shader has more motion than the one Nexus gated. Under
`uReduced = 1`:

| Effect                                  | Treatment                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Jitter (`iJit`, 11 rad/s)               | Scale by `(1.0 - uReduced)`, same as Nexus's fix                                                                            |
| Flow packets (`flow ≠ 0`)               | Freeze: `head` uses `uTime * (1.0 - uReduced)`                                                                              |
| Hover packet and sync marks             | Hold them static rather than removing them. Incident edges keep their meaning through the tier gain alone                   |
| Scanline raster lock (`gl_FragCoord.y`) | Keep. It is static texture                                                                                                  |
| Intro sweep (6× zoom pull-back)         | **Skip it.** Start `camZoom` at `camT.zoom`. A full-screen zoom is exactly the vestibular trigger the preference exists for |
| Auto-fit tracking and follow            | Keep, but snap instead of easing (`sp = 1`)                                                                                 |
| Intro sweep on `reseed()`               | Don't replay it once the camera is user-owned (`autoFit === false`), in any motion mode. Re-fit in place instead (R12)      |
| Keyboard-driven camera moves (R4)       | Ease normally; snap under reduced motion                                                                                    |

`GraphCanvas.reduced-motion.test.tsx` gains assertions on `EDGE_VS`/`EDGE_FS`
and `PAD_VS` source (that `uReduced` is declared and used), plus the
intro-skip.

The motion budget, regardless of the preference: motion is allowed when it
explains a change (camera eases, the neighbourhood fading in, a packet on a
live edge). Ambient motion (glitch, flicker, grain) stays decoration that the
consumer can turn off with `optics`.

#### 6.4.1 Static direction cue (R2)

Each edge has two pads (`aPad.z` 0 = a-end, 1 = b-end). For a category with
`directed !== false`:

- **Source pad (a-end):** a filled bar across the trace, as qrntn draws it.
- **Target pad (b-end):** an open bracket that faces the node. Draw it in
  `PAD_FS` by discarding the inner quad (`abs(aPad.xy) < 0.55` along the
  tangent axis). It costs no new attribute, because `directed` packs into the
  sign of `iP0.w` (gain is never negative, so the sign is free).
- **Undirected categories** draw two filled pads.
- **Frayed ends** (`absentEnd`) draw no pad, as qrntn already does. Direction
  then reads from the surviving pad's shape.

This keeps qrntn's decision against arrowheads (they read as busy) while
meeting WCAG 1.4.1 and 2.3.3. Phase 4 must check legibility at fit zoom on the
showcase graph. If the bracket is unreadable below some zoom, the pads scale
with the label tiers instead of getting larger everywhere.

### 6.5 Navigation: keyboard, screen reader and history

This replaces qrntn's per-node tab stops. The model is research R3–R5 and R7.
It follows QUARTZ's finding that navigation must follow the topology, and
Zong et al.'s structure/navigation/description split. There are three layers,
and only the last one touches the DOM:

| Layer       | Module              | Owns                                                                                                                                           |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure   | `a11y/adjacency.ts` | Ranked `Connection[]` per node, built once per graph and filtered by visibility on read                                                        |
| Navigation  | `a11y/navigator.ts` | `current`, `cursor` (index into current's connections), `direction` filter, `history` stack. Pure reducer: `(state, action) → state + effects` |
| Description | `describe.ts`       | Every spoken string: graph summary, node, connection, detail                                                                                   |
| DOM         | `a11y/overlay.ts`   | The focus element, live region and key hints, positioned through the internal frame hook                                                       |

The navigator is a pure reducer so the whole key map can be unit-tested
without a browser. The overlay only translates key events into actions and
effects into DOM.

#### 6.5.1 Key map

| Key       | Action                  | State change                                                                         | Announced (polite live region)                                                                              |
| --------- | ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Tab (in)  | Enter the graph         | `current` = selected ?? last focused ?? top-ranked node                              | Graph summary, then the node: "Graph, 120 nodes, 340 connections in 4 kinds. animate, skill, 6 connections" |
| ← / →     | Browse connections      | `cursor` ± 1 (wraps). **Camera doesn't move. Nothing is selected**                   | "uses → motion-tokens, skill. 2 of 6"                                                                       |
| ↑ / ↓     | Change direction filter | `direction` cycles all → outgoing → incoming. `cursor` = 0                           | "Outgoing, 4 connections"                                                                                   |
| Enter     | Follow                  | Push `current` to history. `current` = `cursor.other`, `cursor` = 0                  | The new node                                                                                                |
| Space     | Select / deselect       | `onSelect(current \| null)`                                                          | "Selected" / "Deselected"                                                                                   |
| Backspace | Back                    | Pop history into `current`                                                           | "Back to animate". At an empty stack: "Start of path"                                                       |
| Home      | Start node              | `current` = the node Tab entered on. History is kept                                 | The node                                                                                                    |
| `D`       | Describe in detail      | No change                                                                            | Category, degree, connection counts by kind, selected state                                                 |
| `?`       | Key help                | No change                                                                            | The key map, short form                                                                                     |
| Escape    | Step out                | 1st press: deselect if selected. 2nd: dismiss tooltip. 3rd: focus leaves to the root | "Deselected" / nothing / nothing                                                                            |
| Tab (out) | Leave                   | Focus moves to the next focusable after the canvas                                   | —                                                                                                           |

Notes:

- **The browse/follow split is deliberate.** It lets a user survey a
  neighbourhood without losing their place, which is the QUARTZ finding.
- **Connection phrasing** comes from `LinkCategory.verb` / `inverseVerb`,
  falling back to the category label: "uses → X" for outgoing, "used by ← X"
  for incoming, and "overlaps ↔ X" when `directed: false`. Strongest first,
  per `rankConnections`. Arrows are spoken as words by the default
  `describe.ts` ("to", "from"); the glyphs above are for the visual hints only.
- **Single-key shortcuts** (`D`, `?`) only fire while focus is inside the
  graph, and `keyHints` lists them visibly. That covers WCAG 2.1.4 (they're
  scoped to the focused component).

#### 6.5.2 DOM and ARIA

- **Root:** `role="group"`, `aria-label={ariaLabel}`,
  `aria-roledescription="graph"`. Children of `role="img"` are presentational,
  so `img` is only kept when `keyboardNavigation={false}`. Don't use
  `role="application"`: QUARTZ used it, but it disables screen reader browse
  mode, and the paper itself reports inconsistent behaviour across readers.
  Development builds warn when `ariaLabel` is missing.
- **One focus element** is a `<button>` that represents `current`. It is moved
  and relabelled as `current` changes, using `aria-pressed` for selection.
  It's one element, not one per node, which is the roving tabindex pattern
  taken to its limit (Data Navigator does the same). DOM cost is O(1), and the
  §6.6 overlay performance risk goes away. The full structure is available
  non-visually through navigation plus the outline (D10).
- **The browse cursor** is shown visually (R4) and spoken through the live
  region. It isn't a second focus target.
- **One `aria-live="polite"` region** carries announcements. Repeated
  identical announcements are de-duplicated by toggling a zero-width suffix,
  so screen readers re-read them.
- **Pointer events:** the focus element keeps `pointer-events: none`, so
  canvas picking still owns the mouse (qrntn behaviour).
- **Hidden nodes:** when filters or isolation hide `current`, the navigator
  moves it to the nearest visible history entry, then the selected node, then
  the top-ranked node, and announces it. Focus never drops to `<body>`.
- **Labels and tooltip:** stay `aria-hidden` (N6), because everything they
  show is reachable through the navigator.

#### 6.5.3 What sighted users see (R4, R7)

- **Focused node:** gets the same neighbourhood highlight as hover
  (`hoverIdx` = `current`), plus a focus ring drawn in the canvas with the
  token focus colour. It's drawn in the canvas, not as DOM, so it follows the
  CRT curve exactly.
- **Browse cursor edge:** rendered in the live pass, and its far node gets a
  secondary ring. A sighted keyboard user sees which connection Enter will
  follow.
- **Camera:** following, going back or `focusNode()` onto a node outside the
  free box (inside `fitInset`) calls the existing `focus()` path with follow.
  Browsing moves the camera only when the cursor's far node is off-screen.
  That gives keyboard users panning without dragging (WCAG 2.5.7), and keeps
  focus from being obscured (2.4.11).
- **Key hints:** while focus is inside the graph and `keyHints` is on, a
  one-line strip shows at the bottom of the free box: "←→ connections · ↑↓
  direction · Enter follow · ⌫ back · Space select · ? help". It is
  `aria-hidden`, because `?` speaks the same thing. It's styled with
  `@nexus-cyberdeck/tokens` variables, not hard-coded colours.

#### 6.5.4 Mouse and pointer parity

- **History** (D9) records every selection made by clicking too, so
  `controller.back()` behind a consumer's Back button behaves the same as
  Backspace.
- **Tooltip (R9):** Escape dismisses it. Its placement avoids the hovered
  node's glyph rect and the first 24 px of each incident edge. It flips side
  when it would overlap.
- **Hit target (WCAG 2.5.8):** this is already met. `pickNode` uses `radius +
max(5, 12 / zoom)` world units, which is never less than 12 screen px of
  radius (≥ 24 px target) at any zoom. A unit test pins it so a later tweak
  can't regress it.

### 6.6 Performance guardrails

- The navigator adds one DOM element in total (§6.5.2), so there's no
  per-node DOM cost.
- `a11y/adjacency.ts` builds ranked connection lists once per graph mount,
  in O(m log d).
- Measure two-pass edges plus pads on a 2,000-node graph built with the
  showcase generator. Frame time at 2.0 must stay within 15% of 1.x at the
  same seed.
- `computeNeighbourhood` runs per hover or focus change and is O(m). That's
  fine as it is.

## 7. Implementation plan (PR-sized)

Each phase ends with typecheck, lint, all unit tests, `test:browser`, and
`check-consumer` green. Visual baselines are only refreshed in the phases
marked 📸.

1. **Extract, no behaviour change.** Move `picking`, `labels` and
   `neighbourhood` into Nexus's _current_ `GraphCanvas`, with qrntn's tests.
   `computeNeighbourhood` already computes the two-hop `TIER_NEARBY` (0.45),
   but the current edge shader multiplies by `active` directly (width,
   brightness and dimming), so `highlight()` collapses the tier to 1 or 0
   until phase 4's shader reads it. Extract `validate.ts`. Add the hit-target
   test (§6.5.4). ✓ Done 2026-10-09.
2. **Physics and stable layout.** Add sector and radius forces,
   `structAlpha`, `reseed()` and per-node overrides (D6), merged with the
   seeded PRNG. Add the `seed` prop with the id-hash default (D7, R6), and a
   seeded showcase sample generator. With both forces at 0, stepping matches a
   recorded 1.x run float for float. ✓ Done 2026-10-09. There were no graph
   pixel baselines to refresh: the visual suite covers only token and
   component pages. Deterministic seeds make graph baselines possible; they're
   added in phase 4, once the new edge shader settles the look and glitch
   timing is pinned.
3. **Camera.** Auto-fit sweep, follow, `fitInset`, `reframe`, the
   `followSelection` prop (D2), the reduced-motion intro skip, and no replayed
   sweep on a user-owned reseed (R12). ✓ Done 2026-10-09. Camera ownership
   (reader, focus, auto-fit) moved into a pure `camera-rig.ts` with its own
   tests, and the framing maths into `fitBounds()`/`insetOffset()` in
   `camera.ts`. Under reduced motion every camera move lands at once. The
   showcase passes its floating console and details drawer as `fitInset`.
4. **Edges and direction.** Routing, gain, pads, fray, two-pass, screen-space
   dash, the new default optics, removal of `arrow`, the `uReduced` gating in
   §6.4, `DoubleSide`, the **asymmetric pads** (§6.4.1, R2), and
   `LinkCategory.directed`. Migrate the showcase sample data. Measure edge
   contrast per tier (R11). 📸 ✓ Done 2026-10-09. Notes:
   - Direction is a filled bar at the source end and an open bracket ("⊏") at
     the target end, packed into the sign of `iP0.w` by `encodeGain()`.
   - `DEFAULT_PHYSICS`/`DEFAULT_OPTICS` exports moved up from phase 5: the
     showcase kept its own stale copy of the optics and drew every edge
     twice as heavy.
   - A press only becomes a node drag or a pan after 3px of travel. A click
     used to pin the node and reheat the whole layout, and a click on empty
     space ended the auto-fit.
   - New `browser/graph.spec.ts`: a WebGL compile/link check, plus seeded,
     fake-clock baselines at rest and with a node selected. Measured edge
     contrast after the CRT composite: resting 3.56:1, live about 17:1.
   - Follow-ups not done here: `LinkGlyph` (the legend icon in
     `@nexus-cyberdeck/react`) still draws an arrowhead, and framing ignores
     label width, so a selected node's label can run under the drawer.
5. **Props, controller and stats.** `selectionScopedLinkCategories`,
   `onFrame`, `drawnNodes`, `DEFAULT_*` exports, `invalidEdges`/`onWarning`
   (D1), and N1 refs for `onSelect`/`onFatal`. ✓ Done 2026-10-09.
   `validateGraph()` gained the drop policy and returns the surviving edges,
   which `GraphCanvas` sizes everything from. Without an `onWarning`, a drop
   goes to `console.warn`, so it is never silent. Every callback, including
   `onFrame` and `onWarning`, is read through a ref. The `DEFAULT_*` exports
   landed in phase 4. The showcase's stats show "drawn/total" nodes while
   something is hidden.
6. **Navigation core, no DOM.** `a11y/adjacency.ts`, `a11y/navigator.ts`,
   `describe.ts`, `LinkCategory.verb`/`inverseVerb`, and the history stack
   with `controller.back()`/`canGoBack` (D9), including mouse selections.
   This is fully unit-tested as a reducer. It's the riskiest new logic, so it
   lands alone. ✓ Done 2026-10-09. Decisions made here:
   - A history entry is `{ node, selected }`. Following a connection, clicking
     another node and clearing a selection each push one, and `back` restores
     both the node and its selection (through `onSelect`). Keyboard steps
     taken without selecting go back without touching the selection.
   - A mouse selection moves the keyboard position too, so a reader switching
     from mouse to keyboard continues from what they clicked.
   - The reducer's Escape deselects, then leaves. Dismissing the tooltip
     first is the DOM layer's job (phase 7), because the reducer can't see it.
   - `describeNode`, `rankConnections` and `onNavigate` arrive with the DOM in
     phase 7. Until then the engine uses the default ranking and wording, and
     the announcements go nowhere.
   - The showcase's link kinds have verbs ("cites" / "cited by"). Its Back
     button comes with the key hints in phase 7.
7. **Navigation DOM and visuals.** `a11y/overlay.ts` (focus element, live
   region, key hints), the root role change, focus-driven highlight, ring and
   cursor edge, focus-driven camera (R4), Escape dismissing the tooltip, and
   tooltip placement (R9). Browser tests from §8. 📸 ✓ Done 2026-10-09. Notes:
   - The focus ring is a +4 flag on the node mark, so a node can be focused
     and selected at once. The browsed edge stays at tier 1 while the node's
     other edges drop to `TIER_NEARBY`, so no new shader work was needed.
   - Keyboard focus moves the camera through the new `rig.reveal(i)`: it pans
     at the current zoom only when the node is outside the free box.
   - The highlight is only recomputed when its target changes. Recomputing on
     every hover restarted the selection's ripple each time.
   - `rankConnections` is read when the scene is built; `describeNode` and
     `onNavigate` go through refs.
   - The showcase drawer stays non-modal when the selection came from the
     graph's keyboard navigation. Its focus trap had been pulling focus out of
     the graph on Space.
   - The selection brackets' pulse is now stilled under reduced motion.
8. **Text alternative.** `describeGraph()` (D10) and `<GraphOutline>` in
   `@nexus-cyberdeck/react` with its own a11y and visual tests. 📸 ✓ Done
   2026-10-09. Notes:
   - `GraphOutline` takes the outline by shape and doesn't import the graph
     package. The showcase uses both, so its typecheck is the compatibility
     check.
   - Connection targets are buttons, not `#` links, because the showcase's
     hash router would treat a link as a route change.
   - The showcase's graph lab gained a "View as list" panel over the canvas,
     filtered like the canvas, whose "Select in graph" drives the same
     selection. It has its own component page under Data display.
   - The keyboard-reachability check now skips the contents of a closed
     `<details>`, which the browser keeps out of the tab order, and checks the
     `<summary>` instead. The divider between entries is recorded as a
     reviewed decorative hairline. The token reference baseline changed
     because it lists `GraphOutline` among the stylesheets using four text
     roles.
9. **Docs, assistive-tech pass, release.** Rewrite the README data-model and
   props sections. Add a migration guide (1.x → 2.0). Update the showcase
   `labs/graph` page to demo routing, gain, fray, direction pads, `fitInset`,
   keyboard navigation and the outline. Run the **manual screen reader
   matrix**: NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari (macOS and
   iOS). Ideally also run a short session with at least two blind or
   low-vision users, given how small the research samples are. Add the major
   changeset. **Partly done 2026-10-09:**
   - ✓ The package README is rewritten for 2.0, with keyboard, text
     alternative, layout and camera sections and a "Migrating from 1.x" guide.
     The getting-started snippets are fixed: they used `arrow`, had no
     `ariaLabel`, and one passed inline arrays.
   - ✓ The showcase now shows every edge feature. Links to unresolved
     questions fray (`absentEnd`), and the lab also has the Back button, the
     key hint and the list view.
   - ✓ The focus ring is thicker and brighter, after the phase 7 baseline
     showed it was faint.
   - ✓ The major changeset (`graph-edges-2-0.md`) points to the migration
     guide.
   - **Open, release gate:** the manual screen-reader pass. The script and
     results table are in
     [`graph-screen-reader-pass.md`](./graph-screen-reader-pass.md). It needs
     a person on NVDA, JAWS and VoiceOver.

## 8. Test plan

| Area                             | Test                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Labels / picking / neighbourhood | qrntn unit suites, ported as-is. The hit target is ≥ 12 px screen radius at zoom 0.12, 1 and 16                                                                                                                                                                                                              |
| Neighbourhood tiers              | The edge between two depth-1 neighbours gets `TIER_NEARBY` (the regression qrntn fixed)                                                                                                                                                                                                                      |
| Routing encoder                  | Odd-indexed arcs never decode as etched. `encodeRouting` round-trips through the GLSL sentinel check (string assert on `ROUTE_GLSL`)                                                                                                                                                                         |
| Direction cue                    | The `directed` sign packing round-trips with `gain`. The target pad is open and the source pad filled (pixel probe in a browser test). Undirected edges get two filled pads                                                                                                                                  |
| Attribute budget                 | Edge and pad programs stay ≤ 8 attribute slots (assert against `EDGE_ATTRS`)                                                                                                                                                                                                                                 |
| Physics                          | Seeded determinism with sector, radius and reseed. No overshoot at damping 0.9 (qrntn's measured case). Defaults (`sectorForce = radiusForce = 0`) are byte-identical to 1.x stepping                                                                                                                        |
| Stable layout                    | No `seed` prop: two mounts of the same `nodes` give identical starting positions, and the derived seed ignores node array order (sorted ids). Positions still follow array order, because the seeding spiral is laid out by index, which is documented on the prop. `seed={null}` leaves the solver unseeded |
| Validation                       | Each N2 message. `invalidEdges="drop"` drops, calls `onWarning`, and renders                                                                                                                                                                                                                                 |
| Lifecycle                        | Context loss, forced loss on unmount, throw mid-boot releases everything, StrictMode double mount                                                                                                                                                                                                            |
| Callbacks                        | `onSelect`, `onFatal`, `onStats`, `onFrame` and `onNavigate` see the latest closure                                                                                                                                                                                                                          |
| Reduced motion                   | Shader source asserts (§6.4), intro skipped, keyboard camera moves snap, `data-nx-reduced-motion` stays live                                                                                                                                                                                                 |
| Camera                           | Pan or wheel disables auto-fit, a node drag does not. `fitInset` re-frames only under auto-fit. `focus` follows until settled. Reseed doesn't replay the sweep once the camera is user-owned                                                                                                                 |
| Navigator (unit)                 | Every row of §6.5.1 as a reducer test: browse wraps, the direction filter resets the cursor, follow pushes history, back pops, back at an empty stack, Home, and hidden-current recovery                                                                                                                     |
| Describe (unit)                  | Summary counts, verb / inverseVerb / undirected phrasing, ranking order, `describeNode` override                                                                                                                                                                                                             |
| Navigation (browser)             | A single Tab stop enters and leaves. The live region text per key. `aria-pressed` follows selection. Focus never lands on `<body>` after filtering. Off-screen follow moves the camera                                                                                                                       |
| A11y (browser)                   | Axe clean on `labs/graph` with navigation on and off. Root role is `group` vs `img`. Key hints visible on focus                                                                                                                                                                                              |
| Tooltip                          | Escape dismisses it. It never overlaps the hovered glyph rect                                                                                                                                                                                                                                                |
| Contrast                         | The existing tooltip test, plus edge pixel sampling per tier after the CRT composite (R11): incident ≥ 3:1, and resting edges' value recorded                                                                                                                                                                |
| Outline                          | `describeGraph` output snapshot. `<GraphOutline>` passes axe, and its list navigation matches the graph's connections                                                                                                                                                                                        |
| Visual                           | Seeded baselines for straight, arc and etched routing, a frayed edge, direction pads, the hover tiers, the keyboard focus ring and cursor edge, and reduced motion                                                                                                                                           |
| Manual                           | The screen reader matrix in phase 9, recorded in the PR                                                                                                                                                                                                                                                      |

## 9. Afterwards: qrntn consumes the package

This happens in qrntn's repo, after 2.0.0 is published. It does not block this
spec.

- Replace `nexus/packages/graph` with `@nexus-cyberdeck/graph@^2`. Delete the
  vendored copy and its `$vendored` note.
- Delete `src/a11y/domOverlay.ts`. Pass qrntn's wording (`ariaLabelFor`)
  through `describeNode`, its edge verbs through `LinkCategory.verb` and
  `inverseVerb`, and the kind order through `rankConnections`.
- Remove the app's own Escape handler and overlay container. The package owns
  both now.
- Use `invalidEdges="drop"` and `followSelection={false}`, or remove the
  app's own follow effect.
- Collapse to one category per kind by using the per-node overrides (D6).
  `categoryIdsByKind` can then go away.
- Optionally add a Back button bound to `controller.back()`, and a "view as
  list" toggle using `<GraphOutline>`.

## 10. Risks

- **Edge look change.** Every consumer's graph looks different in 2.0. This is
  intended, but it belongs in the changelog with before and after screenshots.
- **Two-pass cost.** The edge mesh is drawn twice, and pads add a third
  instanced draw. That's cheap per instance, but measure it on the same
  2,000-node graph (§6.6).
- **Root role change** (`img` → `group`). Consumers that asserted
  `getByRole("img")` in their own tests will break. Call it out in the
  migration guide.
- **Screen readers behave differently.** QUARTZ hit real differences between
  JAWS, NVDA, VoiceOver and ZDSR. The phase 9 manual matrix is a release gate,
  not a nice-to-have.
- **Thin evidence for the keyboard model.** It rests on small studies (8–13
  participants). The navigator is a pure reducer, so the key map can change
  after user testing without touching rendering.
- **Direction pads may be too small to read** when zoomed out. Phase 4
  measures it. The fallback is tier-scaled pads (§6.4.1).
- **qrntn moves on in parallel.** Pin the source at `da0823b`. Anything qrntn
  changes in `nexus/packages/graph` after that gets diffed in during phase 9.
  The local checkout is currently on `fix/check-validates-audit-json`, but
  that branch doesn't touch the graph.
