# Isometric diagrams — design

Status: **agreed, not started.** Decided 2026-10-08 in a design grilling; every
decision below was put as a question with alternatives and settled. The
numbers (D1…D34, matching the grilling's questions) are stable so later PRs and the future skill can cite them.

`@nexus-cyberdeck/iso` is a collection of isometric diagrams — architecture,
layered stacks, pipelines and more — with animation and interaction that
speak the Nexus language: hairlines, zero radius, monospace, tokens, AA
enforced at build time. It is built first for a model to author, so a later
skill can pick the right diagram for a use case and write its spec correctly
the first time.

## Contents

1. [Audience and scope](#1-audience-and-scope)
2. [Architecture](#2-architecture)
3. [The spec](#3-the-spec)
4. [Layout](#4-layout)
5. [Motion and interaction](#5-motion-and-interaction)
6. [Drill-in](#6-drill-in)
7. [Accessibility and small screens](#7-accessibility-and-small-screens)
8. [Quality gates](#8-quality-gates)
9. [The diagram catalogue](#9-the-diagram-catalogue)
10. [Milestones](#10-milestones)
11. [Out of scope, on purpose](#11-out-of-scope-on-purpose)

## 1. Audience and scope

| #   | Decision                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Primary consumer is model-generated output** (artifacts, chat pages, HTML a model writes) loading Nexus from `ds-bundle` with no build step. React apps are the close second. The core is therefore framework-agnostic. |
| D2  | **Ceiling is ~200 objects per view.** Past that an isometric picture stops being legible; the answer is the force graph or a table, not a faster renderer.                                                                |
| D3  | **Static in v1, keyed for live later.** Specs render once; every object has a stable id so `update(spec)` can animate to a new state when live data arrives.                                                              |
| D4  | **Models write the specs, people read them.** The spec is optimised for first-try correctness and fixable errors; people wanting full control use the scene primitives.                                                   |
| D5  | **Every colour is a token**, the three face tones included. Dark only today (`hud`, `hud-aa`); nothing hardcoded that would block a light theme later.                                                                    |

## 2. Architecture

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6  | **SVG only.** No second renderer is planned. Crisp 2:1 hairlines (26.57°, edges land on whole pixels), real DOM for focus and screen readers, CSS tokens, snapshot-testable. A 1,000-node view would be a different component.                                                                                                                                                     |
| D7  | **One package, three layers.** A pure core `renderIsoToString(spec, opts?)` that runs without a DOM; `mountIso(el, spec)` on top adding interaction and motion; a light-DOM `<nx-iso>` custom element (spec inline as `<script type="application/json">`) and a React `<IsoDiagram>`, both thin wrappers. No shadow DOM, so `tokens.css` applies and Playwright can select inside. |
| D21 | **The pure renderer is the foundation.** Layout and scene construction are pure functions; the DOM mount only adds behaviour on top. The interaction layer can never feed back into layout.                                                                                                                                                                                        |
| D10 | **30 KB gzipped for the core, layout included, enforced in CI** like the AA contrast gate. This rules out ELK (~400 KB) and dagre.                                                                                                                                                                                                                                                 |
| D23 | **The core depends only on `@nexus-cyberdeck/tokens`** and ships its own `iso.css`, never `react/styles.css`. It emits `nx-select`, `nx-focus`, `nx-step`, `nx-drill` and has a built-in plain-DOM tooltip and detail card. The React wrapper maps events to `onSelect` etc. and lets a real `<Drawer>` replace the built-in card.                                                 |
| D22 | **Released as `0.x`, in `ds-bundle` from the first release**, so the skill is tested against real bundle use before 1.0.                                                                                                                                                                                                                                                           |

`mountIso` returns a handle:

```ts
const handle = mountIso(el, spec);
handle.update(spec); // animate to the new state by stable id
handle.focus(id);
handle.play(step); // narrative mode
handle.drill(path); // v0.2
handle.up(); // v0.2
handle.diagnostics; // layout warnings with repair hints
handle.destroy();
```

## 3. The spec

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D8  | **One schema, a discriminated union on `type`** (`"architecture" \| "stack" \| "pipeline" \| …`). Nodes, edges, groups, steps, tones and glyphs are one shared vocabulary. Rule: **a shared field means the same thing in every type; anything else is type-local.**                                                                                                     |
| D22 | **Every spec carries `"v": 1`**, so the schema can evolve without breaking specs already in the wild.                                                                                                                                                                                                                                                                    |
| D19 | **A closed `kind` list** — `service, database, queue, cache, storage, client, external, function, gateway` — each mapped to a shape (database → cylinder, queue → segmented slab) and a `Glyph`, with one optional `shape` override. **Never image URLs**: they break the look, make output depend on the network and leak privacy. New kinds arrive by PR, not by spec. |
| D20 | **Neutral by default; colour means status or a declared category.** `tone: ok \| warn \| danger \| info` for status, or a category the spec declares and the `Legend` shows. Shape and glyph already carry the kind. Every colour use has an AA test.                                                                                                                    |
| D25 | **The schema is the single source of truth.** Field descriptions and examples live in it; the docs pages, validator messages and the skill's reference section are generated from it; a test fails when the generated output is stale. The skill's which-diagram-when table stays hand-written.                                                                          |
| D16 | **Two levels of validation.** Schema errors refuse to render and show a styled error panel. Layout problems — crossings, overlaps, over 200 objects, unreachable nodes — render anyway and attach warnings with a repair hint, on `handle.diagnostics` and in the CLI the skill runs.                                                                                    |

A sketch of the shape, not the final schema:

```json
{
  "v": 1,
  "type": "architecture",
  "title": "Checkout",
  "groups": [{ "id": "vpc", "label": "VPC eu-west-1" }],
  "nodes": [
    { "id": "web", "kind": "client", "label": "Web" },
    {
      "id": "api",
      "kind": "gateway",
      "label": "API",
      "group": "vpc",
      "children": { "type": "stack", "nodes": ["…"] }
    },
    { "id": "db", "kind": "database", "label": "Orders", "group": "vpc", "tone": "warn" }
  ],
  "edges": [
    { "from": "web", "to": "api" },
    { "from": "api/auth", "to": "db" }
  ],
  "steps": [
    { "focus": ["web", "api"], "caption": "The browser calls the gateway" },
    { "at": "api", "focus": ["auth"], "caption": "Inside, auth runs first" }
  ]
}
```

## 4. Layout

Our own engine; nothing off the shelf fits D10 or the iso grid.

| #   | Decision                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D11 | **Automatic, with hints.** Placement is automatic by default; optional `rank` (column in the flow), `lane` (row), `group` and `pin: [col, row]` repair it where the automatic result reads badly. The validator suggests the hints when it detects crossings or overlaps.                    |
| D12 | **Connectors: simple routes first, grid A\* on collision.** Most edges are an L or Z between assigned ports; A\* with bend and crossing penalties runs only where the simple route hits something. Port assignment (which face, which slot) is built alongside routing — it matters as much. |
| D13 | **Deterministic and stable under edits.** Same spec, same pixels; no randomness. Ties break by spec order then id, and changes stay local where possible, so adding a node does not reshuffle the rest. A model converges by editing; a layout that jumps on every edit stops it converging. |
| D18 | **Labels are flat on screen**, with leader lines and collision avoidance. Only large zone and platform titles are projected onto floor faces. Monospace makes text width `chars × advance`, so label layout needs no DOM measurement — which is what makes D21 possible.                     |

Depth order is the painter's algorithm, ties split by grid position. SVG has no
z-index, so depth is DOM order; keyboard order is separate (§7).

## 5. Motion and interaction

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D14 | **Our own spring solver on one shared rAF clock** for transforms, explode/collapse, drill transitions and packets. CSS only for hover and focus states. Packets travel connector paths via `getPointAtLength`. Only transforms and opacity animate. Reduced motion is handled in one place: packets become static dashes and arrowheads, transitions become short crossfades — the information survives. |
| D15 | **In v1:** hover focus with everything else dimmed; select → tooltip and detail card (`Drawer` in React); path tracing upstream and downstream; step-through narrative mode; explode/collapse (Stack); `Legend` filtering; keyboard focus that moves by screen direction. **Not in v1:** rotation and pan/zoom — the scene graph must not assume either is impossible.                                   |

Entry animation builds from the floor up — floor, structure, connectors,
labels — staggered, under 600 ms, interruptible.

## 6. Drill-in

A node can open into its own view: the C4 move from context to container to
component, without fitting 200 objects on one screen.

| #   | Decision                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D27 | **Structure in v0.1, interaction in v0.2.** Nested scene graph, path ids and per-level rendering ship first because they are expensive to retrofit; the transition is a large standalone piece.                                                                                                                       |
| D28 | **Inline children, at most 3 levels.** A node carries `children`, a complete sub-spec with its own `type` — so an Architecture service can open into a Stack, a Pipeline stage into a sub-pipeline. One document, one validation pass.                                                                                |
| D29 | **"Open the box" transition**, about 700 ms, interruptible: the other nodes sink and fade, the opened block's walls and lid lift away, its footprint grows into the new floor, the children rise from it. Leaving reverses it. Reduced motion: a 150 ms crossfade.                                                    |
| D30 | **Outside neighbours stay as ghosts.** When inside `api`, the nodes it connects to sit dimmed at the edges of the view, and edges continue to the specific child they connect to (`to: "api/auth"`). An edge naming only the parent lands on a port marker on the boundary. The validator checks every path resolves. |
| D31 | **Navigation:** a clickable breadcrumb `/// system / api / auth`; Esc or Backspace goes up a level; focus returns to the node you opened; `drill(path)`, `up()` and `nx-drill`. **The core never writes the URL** — a host wanting deep links adds them in one line from the event.                                   |
| D32 | **Openable nodes carry corner ticks on their top face**, which survive in static and reduced-motion output where hover hints do not. `renderIsoToString(spec, { path })` renders any level; the list view nests; screen readers hear "Entered api: 6 nodes".                                                          |
| D33 | **Narrative steps may cross levels** (`at: "api"`), so a walkthrough can go into a component and back out.                                                                                                                                                                                                            |
| D34 | **Path tracing stays on the current level**, highlighting children and ghosts; it never opens other levels by itself.                                                                                                                                                                                                 |

## 7. Accessibility and small screens

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D17 | **A `<figure>` with a generated, visually hidden summary** ("Architecture: 9 nodes in 3 zones. API gateway connects to…"). Each node is focusable, `role="button"`, named and described by kind, zone and connections. Steps announce through a polite live region. A **list/table toggle** renders the same spec as plain HTML — nearly free, since the spec already holds the data. |
| D15 | **Arrow keys move focus by screen direction** — left on screen is left — not DOM order.                                                                                                                                                                                                                                                                                               |
| D24 | **Below a container-width threshold the list view takes over**, with a button to show the diagram anyway. Above it, the diagram scales down to a minimum label size.                                                                                                                                                                                                                  |

## 8. Quality gates

Each is a CI failure, in the spirit of the existing AA gate:

- **Size** — core ≤ 30 KB gzipped (D10).
- **Contrast** — AA for every face tone, and for labels on every face (D5, D20).
- **Accessibility** — one test per diagram type (D17).
- **Visual regression** — each diagram × theme × reduced motion, through the
  existing Playwright setup.
- **Reduced motion** — no continuous motion; information still present (D14).
- **Determinism** — same spec renders identical output; property tests on
  random scenes for depth order and for stability under single edits (D13).
- **Generated docs are current** (D25).
- **Performance** — 60 fps at 150 objects with packets flowing.

## 9. The diagram catalogue

**D9** — the first three, chosen so v1 covers four use cases with three types:

| Type                                               | The question it answers                                       | Signature                                             |
| -------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| **Architecture** (groups as platforms cover zones) | What are the parts, how do they connect, where does each run? | Packets on connectors, path tracing, nested platforms |
| **Stack**                                          | What sits on top of what?                                     | Explode/collapse, peel a layer on hover               |
| **Pipeline**                                       | What happens in what order?                                   | Step-through with captions                            |

Later, in rough order of value: **Exploded** (what is this made of), **Cluster**
(how is capacity spread out), **Matrix** (which cell is hot), **StateMachine**
(which states, what moves between them), **Timeline/Roadmap** (where are we on
the journey).

## 10. Milestones

**v0.1 — the engine and Architecture, all the way through** (D26). Proves every
layer and every gate before Stack and Pipeline repeat the pattern.

1. Projection and scene core — 2:1 projection, shapes, face shading from tokens, depth sort.
2. Nested scene graph and path ids; per-level rendering (D27, D28, D30 addressing).
3. Schema, validator and diagnostics; docs generation from the schema (D8, D16, D25).
4. Layout — automatic placement with hints, determinism and edit stability (D11, D13).
5. Connector routing — ports, simple routes, A\* fallback (D12).
6. Labels — flat, leader lines, collision avoidance, projected platform titles (D18).
7. `renderIsoToString` and the CLI the skill will run (D21, D16).
8. `mountIso` — interaction from D15, built-in tooltip and card, events (D23).
9. Motion — spring, shared clock, entry, packets, reduced motion (D14).
10. Accessibility — figure summary, focusable nodes, screen-direction keys, list view, small-screen switch (D17, D15, D24).
11. `<nx-iso>` and `<IsoDiagram>`; `ds-bundle` entry; showcase page (D7, D22).
12. All §8 gates green.

**v0.2 — drill-in interaction, Stack, Pipeline.**

1. "Open the box" transition and its reverse (D29).
2. Ghost neighbours and boundary ports (D30).
3. Breadcrumb, Esc, focus restore, `drill`/`up`/`nx-drill` (D31).
4. Steps that cross levels (D33).
5. Stack, with explode/collapse.
6. Pipeline, with step-through.

**Then:** the skill — the which-diagram-when table by hand, the field
reference generated (D25), the CLI as its self-check.

## 11. Out of scope, on purpose

- **Isometric bar charts for precise comparison.** Height in 3D distorts
  magnitude; the skill sends these to a flat chart and says why.
- **WebGL, Canvas, or any second renderer** (D6).
- **Rotation and pan/zoom in v1** (D15) — deferred, not ruled out.
- **Image URLs or free-form icons** in specs (D19).
- **Writing the page URL** from the core (D31).
- **Views over ~200 objects** (D2).
