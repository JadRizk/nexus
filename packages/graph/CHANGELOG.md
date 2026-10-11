# @nexus-cyberdeck/graph

## 2.0.0

### Major Changes

- 2c5d22e: A new edge renderer for `<GraphCanvas>`. Graphs look different after this change: edges are thinner, crossings no longer flare white, and hovering or selecting changes brightness only, never width.

  See **Migrating from 1.x** in the package README for every breaking change in 2.0, in order of how likely it is to affect you.

  **Breaking**

  - **`LinkCategory.arrow` is removed.** Direction is drawn by the edge's end pads instead: a filled bar at the source end and an open bracket at the target end. They stay readable with motion turned off. Set `directed: false` on a category with no direction (it then gets a bar at both ends). Delete `arrow` from your categories, and use `directed: false` where it was `false`.
  - **`LinkCategory.curve` only bows edges with `routing: "arc"`.** In 1.x every edge was bowed by `curve`; the default routing is now `"straight"`, which ignores it. Add `routing: "arc"` to a category to keep it curved.
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

- 30a42f6: **Breaking:** `GraphStats` no longer carries `vertexAttribs` or `webglVersion`.
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
  also says which props _do_ need a stable reference (`nodes`, `edges`,
  `nodeCategories`, `linkCategories`: a new reference rebuilds the whole scene),
  and documents that category colours are handed to the GPU as linear-sRGB, so a
  hex on the canvas does not match the same hex in CSS.

  Label placement no longer allocates per frame — its candidate and collision
  buffers are allocated once and refilled — and the device pixel ratio is
  re-read on resize, so dragging the canvas to a display with a different density
  no longer leaves it rendering at the old one until something remounts it.

### Minor Changes

- 852b5b0: The label pool and tooltip are now `aria-hidden` — a screen reader was
  previously announcing whichever rotating subset of node names happened to be
  on screen. `GraphCanvas` also accepts a new `ariaLabel` prop: when supplied,
  the root exposes `role="img"` + `aria-label`; when omitted, the root exposes
  neither, so the canvas never renders a nameless `role="img"` (an axe
  `role-img-alt` / WCAG 2.0 A violation). The tooltip's secondary text (category
  code and degree) is now `#6F8465` instead of `#3D4C39`, which measured
  2.17:1 against the tooltip background; the new colour clears the 4.5 AA
  floor even composited over the brightest node colour behind the translucent
  tooltip panel (4.5184:1 worst case). There is still no keyboard path to the
  canvas — that remains the consumer's responsibility, as documented.
- 2c5d22e: The `<GraphCanvas>` camera keeps the graph in view while it settles, stays clear of chrome that floats over the canvas, and leaves the view to the reader once they take it.

  - **The intro tracks the layout.** The camera now opens on the measured bounds of the graph, sweeps out to them, and keeps framing the layout as it spreads, instead of landing on a fixed density guess. It stops the moment the reader pans or zooms. Dragging a node doesn't count.
  - **`fitInset`** names the edges covered by your own floating panels, in CSS pixels. The canvas stays full-bleed, but every framing the camera picks (the intro, `fit()`, `focus()`, following a selection) lands in the space that's left. Changing it re-frames, but only while the camera hasn't been taken over by hand.
  - **`followSelection`** (default `true`) keeps 1.x behaviour: selecting frames the node and its neighbours, and clearing the selection frames the whole graph. The camera now also rides along with the selected node while the layout is still settling. Pass `false` to drive the camera yourself with `focus()` and `fit()`.
  - **`focus(id)`** centres the node in the free space and follows it until the layout settles. **`fit()`** hands the camera back to the auto-fit.
  - **`reseed()`** replays the intro sweep only if the reader never took the camera. Otherwise it re-fits in place.
  - **Reduced motion.** Under `prefers-reduced-motion: reduce` the intro sweep is skipped and every camera move lands at once instead of gliding.

- 2c5d22e: **`describeGraph(input)`** returns the graph as a structured outline: a summary, then each category's nodes (sorted by label), each with its connections read from that node's side ("cites ARCHIVE-343, source"). It ranks connections and words nodes the same way the keyboard navigation does, and accepts the same `hiddenNodeCategories`, `hiddenLinkCategories`, `isolateId`, `invalidEdges`, `rankConnections` and `describeNode` as `<GraphCanvas>`, so the outline matches what's on screen. It is generic over your node `data` type like `<GraphCanvas>`, so the same typed `describeNode` and `rankConnections` work for both. Render it with `<GraphOutline>` from `@nexus-cyberdeck/react`, or your own markup. Its types (`GraphOutlineData`, `OutlineGroup`, `OutlineNode`, `OutlineConnection`, `DescribeGraphInput`) are exported.
- 2dd8aa2: Two fixes to `<GraphCanvas>`.

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

- 2c5d22e: `mulberry32` and `seedFromIds` are exported: the seeded generator the layout scatters with, and the seed it derives from a set of node ids by default. Useful for generating sample or test data that is the same on every load, from the same implementation the graph uses.
- 2c5d22e: `<GraphCanvas>` remembers where the reader has been, so you can offer a Back button.

  - **`controller.back()`** returns to where the reader was before their last move: clicking another node, clearing the selection, or (with keyboard navigation, coming next) following a connection. It restores the selection they had there through `onSelect`, exactly like a click.
  - **`controller.canGoBack`** is true when there is somewhere to go back to. Read it after a selection change to enable or disable your button.
  - **`LinkCategory.verb` and `inverseVerb`** set how a screen reader reads a relation from each end, e.g. `"cites"` and `"cited by"`. Without them the category's label is used ("cite to", "cite from").

- 2c5d22e: `<GraphCanvas>` can be read and travelled by keyboard and screen reader, on by default.

  - **One Tab stop.** Tabbing into the graph speaks a summary ("Graph, 200 nodes, 621 connections in 5 kinds.") and the node you land on. Inside, ← → browse the node's connections without moving, ↑ ↓ narrow them to outgoing or incoming, Enter follows one, Backspace goes back, Home returns to where you entered, Space selects, D describes the node in detail, and ? lists the keys. Escape clears the selection, then dismisses the tooltip, then leaves the graph. Each step is spoken through a polite live region.
  - **Visible too.** The focused node gets a ring drawn in the canvas, the connection Enter would follow stays bright while the node's other edges dim, a one-line key hint shows while focus is inside the graph, and the camera pans to keep the focused node in view.
  - **The root is now a named `role="group"`** (with `aria-roledescription="graph"`) instead of `role="img"`, because the focus target inside it has to be reachable. If your own tests query the graph with `getByRole("img")`, query `getByRole("group", { name })` instead, or pass `keyboardNavigation={false}` to keep the 1.x image role. A development build warns when `ariaLabel` is missing.
  - **New props:** `keyboardNavigation` (default true), `keyHints` (default true), `describeNode(node, ctx)` for your own wording, `rankConnections(a, b)` for your own connection order, and `onNavigate(event)` after every step.
  - **New controller method:** `focusNode(id)` puts the reader on a node and moves focus into the graph, for example from a search box.
  - The hover tooltip now sits beside the node, on the side fewer of its edges leave from, instead of under the pointer. Escape dismisses it.
  - Under `prefers-reduced-motion: reduce`, the selection brackets no longer pulse.

- 2c5d22e: `<GraphCanvas>` lays out the same graph the same way on every visit, and can give a layout structure.

  - **Stable by default.** A new `seed` prop seeds the layout's random scatter and the per-node and per-edge shader seeds. Leave it out and the seed is derived from the node ids, so the same data draws the same picture every time, and screenshots are reproducible. Pass a number to pin a specific layout, or `seed={null}` for the old behaviour of a different layout on every mount. Positions also follow the order of `nodes`, so keep that order stable if you want a stable picture. **This changes what you see by default**: a graph that used to come up differently on each load now comes up the same way.
  - **Arms and rings.** `NodeCategory.sectorAngle` pulls a category's nodes toward an angle from the origin, and `NodeCategory.radiusTarget` toward a distance from it. They are switched on with the new `physics.sectorForce` and `physics.radiusForce`, both defaulting to `0`. With both at `0` the solver steps exactly as before, which a test pins against a recorded 1.x run. Both are required fields on `PhysicsConfig` and `PhysicsParams`: if you build either object yourself, add them (or spread `DEFAULT_PHYSICS`).
  - **Per-node overrides.** `GraphNode.size`, `sectorAngle` and `radiusTarget` override the category's value for one node, so a per-instance size no longer needs its own category.
  - **`controller.reseed()`** re-scatters the nodes and restarts the layout without rebuilding the scene.

- f913e82: `GraphNodeSnapshot` now carries the node's `data`, so the payload you put on a
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

- 2c5d22e: New `<GraphCanvas>` props for consumers building around the canvas, and a way to render data whose edges have gone stale.

  - **`invalidEdges`**: `"error"` (default, unchanged) fails the mount when an edge's endpoint matches no node. `"drop"` leaves those edges out, draws the rest, and reports them through the new **`onWarning(message, { dropped })`** callback, or `console.warn` if you don't pass one. Duplicate node ids and missing categories still always fail.
  - **`selectionScopedLinkCategories`**: link categories drawn only on edges touching the selected node, and hidden otherwise. Useful for a dense computed layer that answers a question about one node.
  - **`onFrame(geometry)`**: fires every frame with node ids, positions, radii, hidden flags, the camera and the viewport, for syncing your own DOM to the canvas. The arrays are reused, so read them during the call.
  - **`GraphStats.drawnNodes`**: the number of nodes left on screen after hidden categories and isolation. If you construct a `GraphStats` yourself, add the field.
  - `NEARBY_DEPTH`, `TIER_NEARBY`, `DroppedEdge` and `InvalidEdgePolicy` are now exported.

- aebb9e0: `<GraphCanvas>` now honours `prefers-reduced-motion`. It reads the media query
  at mount and follows it live, and under `reduce` the glitch bands, grain,
  rolling refresh bar and trails go to zero while the HOT-node flicker drops from
  9 Hz to the 0.94 Hz the tokens layer caps its blink at (WCAG 2.3.1). The static
  scanlines, grille, curve, aberration and vignette stay, as does the physics.
  Nothing changes when the preference is off, and the `optics` you pass are gated
  on the GPU rather than overwritten, so there is nothing to restore.

  If you were doing this yourself — zeroing `optics.glitch`, `optics.grain` and
  `optics.trails` from your own `matchMedia` listener — you can stop; keeping it
  is harmless. The new state is mirrored onto the `<canvas>` as
  `data-nx-reduced-motion="true" | "false"`. The shader sources gain a
  `uReduced` float uniform (0 or 1) in `NODE_FS`, `FADE_FS` and `COMPOSITE_FS`;
  anyone compiling those sources into their own renderer needs to supply it.

- 2c5d22e: `onSelect` gets a second argument, `source`: `"pointer"` for a click, `"keyboard"` for a key inside the graph (Space, Escape, Backspace) or a screen reader activating its focus target, `"controller"` for `back()`. A detail panel can use it to stay non-modal for a keyboard selection, so the reader keeps their place in the graph. Existing one-argument handlers are unaffected. The type is exported as `SelectSource`.

### Patch Changes

- 2e69f0f: `<GraphCanvas>` now validates the graph before it touches WebGL, and gives the
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

- 84c9772: `onSelect`, `onStats` and `onFatal` now always fire the current callback,
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

- dd8ca99: `<GraphCanvas physics={...}>` now actually reaches the solver. The initial
  value was silently discarded — the effect that forwards it runs before the one
  that creates the solver, so on first mount there was nothing to forward it to —
  and `gravity` and `damping` were never forwarded at all, at mount or on change,
  despite both being documented fields of `PhysicsConfig`. Both were invisible so
  long as you passed the documented defaults, because they are the solver's own.

  If you were passing a `physics` prop and compensating for it having no effect
  (for example by holding a `GraphController` and reheating, or by feeding the
  solver the values a second time), you can stop: the layout will now settle
  where the props say it should. `repulsion`, `linkDistance`, `cursorForce` and
  `settle` already applied on change and are unaffected. No numerics changed.

- ad4b637: Internal restructure; no API or behaviour change.
- 5fe4c49: Internal restructure; no API or behaviour change.
- df92abf: The `three` peer dependency accepts any 0.170+ release. The previous range,
  `^0.170.0`, only ever admitted `0.170.x` under 0.x semver, so every consumer on
  a current Three.js (including this repository, which tests against 0.185)
  got an unmet-peer warning or a second copy of Three.
- 90f836b: Packages are named under the `@nexus-cyberdeck` scope. The `@nexus` scope on
  npm belongs to the GraphQL Nexus project, so `@nexus/react` was never going to
  be publishable; nothing had shipped under the old name, so no consumer has to
  migrate.
- 7b68784: The `.` export's `import` and `require` conditions each now carry their own
  `types` entry (`index.d.ts` for ESM, `index.d.cts` for CJS) instead of sharing
  one declaration file. A `require()` consumer under Node's `node16`/`node18`
  module resolution previously got the ESM types applied to the CommonJS build,
  which `arethetypeswrong` reports as "Masquerading as ESM"; nothing to do on
  upgrade, but a TypeScript consumer on `require()` now resolves the correct
  `.d.cts` file. `CHANGELOG.md` is also now included in the published tarball,
  so `npm view <pkg> versions` and in-editor "what changed" links work without
  visiting the repo.
- dc57941: Both packages now emit a `"use client";` banner as the first line of
  `dist/index.js` and `dist/index.cjs`. Both use hooks and context, so without
  the directive every import had to be wrapped by the consumer in a Next.js App
  Router project. `@nexus-cyberdeck/tokens` is pure and does not carry the
  directive.

## 1.1.0

### Minor Changes

- The packages are now shaped to be installed. `main`, `module`, `types` and
  `exports` resolve to `dist/` with proper conditions, and `files`,
  `sideEffects` and `publishConfig` are set, so a consumer gets built output and
  a bundler can tree-shake. Previously every entry point pointed at raw
  TypeScript in `src/`, while the `dist/` that tsup built on every run went
  unreferenced.

  `@nexus-cyberdeck/react`'s dependency on `@nexus-cyberdeck/tokens` is a real version rather than a
  wildcard. Local tooling reads source through a shared alias, so development
  still needs no build step.

  Also removes a global React type augmentation that `@nexus-cyberdeck/react` was merging
  into every consumer's `HTMLAttributes` — including React 19 apps, where it
  widened `inert` to the wrong type across their whole codebase.
