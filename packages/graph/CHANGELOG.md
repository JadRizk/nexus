# @nexus-cyberdeck/graph

## 2.0.0

### Major Changes

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
