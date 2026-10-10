# Research: what makes an interactive graph usable

|          |                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Date     | 2026-10-09                                                                                                        |
| Feeds    | [`graph-migration-qrntn.md`](./graph-migration-qrntn.md)                                                          |
| Question | Which parts of the Nexus graph and the qrntn graph should the combined graph keep, and what is missing from both? |

## 1. What the research says

### 1.1 Tasks: what people actually do with a graph

Lee et al.'s graph task taxonomy (BELIV 2006) is the standard reference. Its
**topology** tasks are the core ones:

- adjacency (who is connected to X)
- accessibility (what is reachable from X)
- common connection (who links X and Y)
- connectivity (paths, clusters, components)

Around those sit **attribute**, **browsing** and **overview** tasks. A 2018
survey of 152 empirical graph studies found topology tasks were by far the
most studied (47%), ahead of attribute (22%) and overview (21%). The practical
reading is that **the neighbourhood of one node is the unit of use, and the
whole-graph picture comes second.**

Van Ham and Perer's "Search, Show Context, Expand on Demand" (InfoVis 2009)
says the same thing from the other end. Most users have semi-specific
questions, a global overview often doesn't serve them, and the better model
starts from a node of interest and shows a bounded, interest-ranked context
around it. Shneiderman's mantra (overview, zoom and filter, details on demand)
still applies, but for networks he also lists **relate**, **history** and
**extract** as tasks in their own right.

### 1.2 When node-link stops working

In Ghoniem, Fekete and Castagliola (2005), node-link diagrams beat adjacency
matrices on small, sparse graphs (around 20 nodes). Matrices won as size and
density grew. **Path finding was the one task where node-link always won.**
Later crowdsourced replications (Okoe et al., TVCG 2018) found node-link
better for memorability and connectivity, and matrices better for common
neighbours and group tasks.

So at scale, a node-link canvas only stays usable if density is controlled
for it, through filtering, isolating a neighbourhood or grouping. Practitioner
guidance agrees. Cambridge Intelligence (vendor advice, so with a grain of
salt) treats hairballs as a scoping problem: show what the task needs,
disclose the rest progressively, and group nodes into combos.

### 1.3 Stability and the mental map

People read position as meaning, and they build a "mental map" of where
things are. Force-directed layouts are fragile: a small change in the data can
reorganise the whole drawing. The established mitigations are to keep stable
nodes still, interpolate between layouts instead of jumping, and measure
stability as node displacement between layouts. Cambridge Intelligence's
version of this rule is to keep layouts predictable and gestures standard.

### 1.4 Visual encoding and interaction rules (practitioner consensus)

These come from Cambridge Intelligence's 10 rules, and match WCAG:

- **Never rely on colour alone.** Add shape, icon or text, and check the graph
  in greyscale.
- **Reserve high-contrast accents for interactive or important states.** Too
  many hues create false patterns.
- **Labels:** truncate them, hide the ones too small to read, and show more
  through tooltips or zoom.
- **Hover** reveals detail, **selection** highlights context, **expansion**
  reveals grouped content, and **motion** should be short and explain a change.
  Motion that explains nothing is noise.

### 1.5 Accessibility, the part both graphs are weakest on

**Structure, navigation, description.** Zong et al. (EuroVis 2022, 13 blind
and low-vision readers) found that what screen-reader users need from a chart
goes far beyond alt text plus a data table. They need a navigable structure,
moves through it (structural, spatial and targeted), and narration they can
adjust in content and verbosity. With that, participants built spatial mental
models and controlled their own analysis.

**Networks need their own navigation model.** QUARTZ (Khan and Seo, ASSETS
2026, 8 blind and low-vision participants, iterative design) is the most
recent and the most directly relevant:

- **DOM-order traversal disoriented participants.** A network has no
  sequential anchor the way a chart axis does. Its own guideline: keyboard
  access is _necessary but insufficient_, and navigation has to follow the
  topology.
- What survived iteration:
  - **The first Tab enters the graph and speaks a summary** ("14 nodes, 19
    connections, 3 clusters").
  - **Left and Right cycle through the current node's connections.** That is
    browsing, and nothing moves yet.
  - **Enter follows the highlighted connection.** That commits the move.
  - **Backspace goes back** through a history stack.
  - **Up and Down switch between outgoing and incoming** connections.
  - A key gives a **structural description** (cluster membership, bridge
    status, ranked connections).
- **Announcing "X connected to Y" was not enough.** Participants needed the
  _relation type_, the _direction_ and the _strength_, with the strongest
  announced first.
- Hidden keyboard shortcuts went undiscovered, and they were replaced with
  visible buttons. Behaviour differed between JAWS, NVDA, VoiceOver and ZDSR,
  so the authors advise designing for several screen readers from the start.

This is older advice than QUARTZ. A 2015 W3C SVG accessibility thread on the
RAVE engine describes "highlight the node's connections, cycle through them,
pick one", plus a back stack. The NC State GSK studies with blind users
likewise simplified edge navigation after testing.

**Mechanics.** Data Navigator (Elavsky et al., VIS 2023, MIT licence) is the
reference architecture. It keeps a navigation graph separate from rendering,
and draws a semantic HTML layer over SVG, Canvas or WebGL. WAI-ARIA composite
widgets expose **one Tab stop** with arrow keys inside, the "roving tabindex"
pattern.

**Auditing.** Chartability (Elavsky, EuroVis 2022) builds on WCAG because
WCAG-compliant charts can still be inaccessible. It asks whether an
alternative such as a table or simpler view is provided. In a validation
study, all users relied heavily on the data table. Tooltips were valued, but
they must not cover the chart.

**WCAG criteria that apply to a canvas graph** (from my own knowledge of
WCAG 2.2, not from the sources above): 1.4.1 use of colour, 1.4.11 non-text
contrast (3:1 for the graphics needed to understand the graph), 1.4.13 content
on hover (dismissible, hoverable, persistent), 2.1.1 keyboard, 2.3.3 animation
from interactions, 2.4.7 and 2.4.11 visible and unobscured focus, 2.5.7
dragging (a single-pointer alternative for panning), and 2.5.8 target size
(24 px).

## 2. Scorecard: the two graphs against the research

✅ = has it · ◐ = partial · ✗ = missing. "Nexus" means `packages/graph` today.
"qrntn" means its package _plus_ its app-level overlay.

| Need                                        | Nexus                                                                 | qrntn                                                                                     | Notes                                                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Relate:** clear neighbourhood on hover    | ◐ incident edges only, and they also get **wider**                    | ✅ incident plus 2-hop tier, **alpha only, no geometry change**                           | qrntn fixed edges between neighbours being dimmed. Geometry that doesn't change keeps the picture stable                                                                              |
| **Relate:** relation type readable          | ◐ colour, dash, arrow                                                 | ✅ routing (form), gain (intensity), dash                                                 | qrntn carries type through form, not just colour (1.4.1)                                                                                                                              |
| Direction readable                          | ✅ arrowheads (static)                                                | ◐ **only the moving packet**                                                              | ⚠ Under reduced motion the packets freeze, so **qrntn loses direction entirely**. A static cue is needed                                                                              |
| Never colour alone (nodes)                  | ✅ six SDF shapes                                                     | ✅ same                                                                                   | Inherited from the shared base                                                                                                                                                        |
| Overview without hairball                   | ◐ category filters, isolate                                           | ✅ adds selection-scoped layers and sector/ring structure                                 | qrntn's arms and rings give the graph **regions you can learn**                                                                                                                       |
| **Search / show context**                   | ✗ (`focus(id)` only)                                                  | ◐ app command palette plus `focus` with follow                                            | Neither package has search. It belongs to the consumer, but needs a documented recipe                                                                                                 |
| Expand on demand / grouping                 | ✗                                                                     | ✗                                                                                         | Out of scope now, but don't close the door (§3, R10)                                                                                                                                  |
| **History** (back)                          | ✗                                                                     | ✗                                                                                         | QUARTZ found a back stack necessary for keyboard users. It helps everyone                                                                                                             |
| Layout stability across visits              | ◐ seeded PRNG exists but isn't exposed                                | ◐ structural forces, but `Math.random`                                                    | Combined: seed **plus** structural forces gives the same regions on every visit                                                                                                       |
| Camera respects the user                    | ◐ auto-zooms on every selection                                       | ✅ auto-fit stops the moment the user pans or zooms. Follow stops when the layout settles | qrntn matches "the user owns the camera"                                                                                                                                              |
| Chrome-aware framing                        | ✗                                                                     | ✅ `fitInset`                                                                             |                                                                                                                                                                                       |
| Motion                                      | ✅ full reduced-motion support                                        | ◐ adds new motion (6× intro sweep, packets, sync marks) without gating                    | Combined graph: everything Nexus gated, plus the new sources                                                                                                                          |
| **Keyboard**                                | ✗ ("consumer's job")                                                  | ◐ one Tab stop **per node**, arrows cycle neighbours                                      | ⚠ qrntn's model is what QUARTZ found disorienting. It has no summary, no back, and no relation type in announcements                                                                  |
| Screen-reader naming                        | ◐ `ariaLabel` on the root only                                        | ◐ per-node labels (domain-specific)                                                       |                                                                                                                                                                                       |
| Text alternative (list or table)            | ✗                                                                     | ✗                                                                                         | Chartability's context check fails for both                                                                                                                                           |
| Tooltip (1.4.13)                            | ◐ `aria-hidden`, pointer-following, not dismissible                   | same                                                                                      | Needs Escape to dismiss, and must never cover the hovered node                                                                                                                        |
| Edge contrast (1.4.11)                      | ?                                                                     | ? lower default opacity (0.4)                                                             | Not measured on either side. qrntn's resting edges are deliberately dim. It is defensible only if focus or hover brings them to 3:1 _and_ the relation is also available non-visually |
| Target size (2.5.8)                         | ✅ grab radius is node radius + max(5, 12/zoom), so ≥ 12 px on screen | same                                                                                      | Already met at every zoom; pin it with a test                                                                                                                                         |
| Panning without dragging (2.5.7)            | ✗                                                                     | ✗                                                                                         | Keyboard focus moving the camera solves it (R4)                                                                                                                                       |
| Robustness (validation, context loss, refs) | ✅                                                                    | ◐                                                                                         | Nexus side. Already in the migration spec §4                                                                                                                                          |

**Summary.** Rendering, relating, framing and layout structure: **qrntn
wins.** Robustness, motion safety and static direction: **Nexus wins.**
Accessible navigation: **neither is there**, and qrntn's overlay has the right
mechanics (a DOM layer synced through `onFrame`) but the wrong navigation
model.

## 3. The combined graph: recommendations

Each recommendation is ranked and has a source, and each says which graph
supplies the code.

**R1. qrntn's relate model becomes the default.** Use the tiered
neighbourhood, constant width, alpha-only state, two-pass compositing, and
routing plus gain as non-colour channels. _Source:_ §1.4 (form plus accents),
Lee et al. adjacency tasks. _Code:_ qrntn.

**R2. Bring back a static direction cue.** Without one, direction is motion
only and disappears under reduced motion. Options, cheapest first:

1. An asymmetric terminal pad (a filled pad at the source, an open bracket at
   the target).
2. A small static chevron at the middle of the route.
3. A brightness taper from source to target.

_Recommendation:_ option 1. The pads already exist (`PAD_VS`), and it costs
one more `aPad.z` branch. It also keeps qrntn's "no arrowheads, too busy"
decision. _Source:_ WCAG 2.3.3, 1.4.1. _Code:_ new, on qrntn.

**R3. Rebuild keyboard navigation on QUARTZ's model**, and keep qrntn's DOM
layer as the mechanism. Key map:

| Key       | Action                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab       | Enter the graph: the **one** Tab stop. It lands on the selected node, otherwise the last-focused node, otherwise the highest-ranked node, and announces a summary ("Graph, 120 nodes, 340 connections. Focused: X") |
| ← / →     | Move the highlight to the previous or next connection of the current node, most important first. This is a browse step: it announces the relation, direction and target, and the camera doesn't move                |
| ↑ / ↓     | Switch between outgoing, incoming and all connections                                                                                                                                                               |
| Enter     | Follow the highlighted connection. Focus moves to that node                                                                                                                                                         |
| Space     | Select or deselect the focused node (`onSelect`)                                                                                                                                                                    |
| Backspace | Go back to the previous node (history stack)                                                                                                                                                                        |
| Home      | Return to the start node                                                                                                                                                                                            |
| Escape    | Clear the selection, then dismiss the tooltip, then leave the graph                                                                                                                                                 |
| `?`       | Speak the key map. It is also listed visibly (see R7)                                                                                                                                                               |
| `D`       | Describe the node in detail: category, degree, neighbours by type                                                                                                                                                   |

Mechanics:

- **Roving tabindex:** one button has `tabindex=0` at a time, and the rest
  have `-1`.
- **A polite live region** carries the summary and browse announcements.
- **Avoid `role="application"`.** QUARTZ used it, but it disables screen
  reader browse mode and is the riskiest choice across different readers.
  Start with `role="group"` and native buttons, and test that with NVDA, JAWS
  and VoiceOver.
- **Announcement order** follows QUARTZ: name, then the relation type and
  direction, then the target, then strength or rank ("Uses → animate, 1 of 4,
  strongest").

_Source:_ QUARTZ DI1 and Modification 2, Zong et al., ARIA roving tabindex.
_Code:_ qrntn's overlay mechanics with a new navigation model. This
**replaces** §6.5 of the migration spec.

**R4. Keyboard focus drives the visuals and the camera.** The focused node
gets the same neighbourhood highlight as hover. The browsed connection gets
the "live" pass. Focusing a node that is off-screen calls the existing
`focus()` path, follow included. That gives keyboard users panning without
dragging (2.5.7), and focus is never hidden off-screen (2.4.11). _Code:_ qrntn
camera.

**R5. History is an engine feature, not a keyboard extra.** Keep a selection
and focus back stack in the package. Expose it as `controller.back()` and
`controller.canGoBack` so mouse users get a Back button from the consumer's
chrome. _Source:_ Shneiderman's "history", QUARTZ Backspace. _Code:_ new.

**R6. Stable layout across visits.** Expose `seed` (migration spec D7) and
default it to a hash of the node ids, so the same data always draws the same
picture. Combine it with qrntn's sector and ring forces, so regions mean
something. `reseed()` stays an explicit user action. _Source:_ §1.3. _Code:_
Nexus PRNG plus qrntn forces.

**R7. Visible affordances, not only shortcuts.** Show a small key hint on the
canvas when it has keyboard focus ("←→ connections · Enter follow · ⌫ back ·
? help"). Hide it with a prop. _Source:_ QUARTZ Modification after P5
(undiscovered shortcuts). _Code:_ new, using tokens from
`@nexus-cyberdeck/react`.

**R8. A text alternative ships with the package.** Provide a headless helper
`describeGraph(nodes, edges, categories)` that returns a structured outline
(nodes grouped by category, each with its connections by relation type). Add
an optional `<GraphOutline>` component in `@nexus-cyberdeck/react` that renders
it as a navigable list, with a "view as list" toggle. This helps sighted users
in dense graphs too (Ghoniem: common-neighbour tasks favour a non-node-link
view). _Source:_ Chartability, Zong et al. _Code:_ new.

**R9. Make the tooltip conform to 1.4.13.** Escape dismisses it. Place it so it
never covers the hovered node or its incident edges' first segment. The
`aria-hidden` stays, because the same information reaches screen readers
through R3. _Code:_ both sides already share the tooltip.

**R10. Leave room for expand on demand, don't build it.** The
`selectionScopedLinkCategories` / `isolateId` / `hiddenNodeCategories` trio
already covers filter and isolate. Grouping into combos and degree-of-interest
expansion are future work. The API should not assume every node is always in
the scene (for example, validation in `invalidEdges="drop"` mode, migration
spec D1).

**R11. Measure what is now guessed.**

- Edge contrast at default optics for each tier (resting, nearby, incident)
  against the background, after the CRT composite. Add a pixel-sampling
  browser test like the tooltip contrast test.
- Frame time with the overlay at 2,000 nodes.

**R12. Motion budget.** On top of migration spec §6.4: the 6× intro sweep is
skipped under reduced motion. It also shouldn't replay on `reseed()` when the
camera is already user-owned (mental map). Short transitions are fine when
they _explain a change_, like camera eases and the neighbourhood fade.

## 4. Changes this makes to the migration spec

Applied to [`graph-migration-qrntn.md`](./graph-migration-qrntn.md) on 2026-10-09: D3, D4, D7, D9, D10, §6.3–§6.6, §7–§10.

| Spec section | Change                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §5 D3        | Still decided "in-package, on by default", but the model is R3, not qrntn's                                                                                                                                                                                               |
| §6.3 API     | Add `controller.back()`, `canGoBack`, `onNavigate`, `keyHints?: boolean`, `describeNode?(node, ctx)` (replaces `getNodeAriaLabel`, adds relation phrasing), `edgeLabel?` per link category for announcements. Drop `compareNodesForFocus` in favour of `rankConnections?` |
| §6.4         | Add R2 (static direction cue) and R12                                                                                                                                                                                                                                     |
| §6.5         | Replace with R3, R4 and R7                                                                                                                                                                                                                                                |
| §7           | Phase 4 gains R2. Phase 6 becomes R3–R5 and R7. A new phase 6b covers R8 (outline)                                                                                                                                                                                        |
| §8           | Add a keyboard traversal and back-stack test, a live-region announcement test, an edge contrast pixel test (R11), and a manual screen reader matrix (NVDA, JAWS, VoiceOver) before release                                                                                |

## 5. Caveats

- The blind and low-vision studies are small (8–13 participants) and
  exploratory. QUARTZ is a preprint for ASSETS '26, and its system changed
  between participants by design. Treat R3 as the best-supported starting
  point, not a validated standard, and plan a test round with real screen
  reader users.
- The Cambridge Intelligence guidance is vendor content.
- I didn't verify Kumu, Obsidian or Neo4j Bloom interaction details, so
  nothing here relies on them.

## Sources

- Lee, Plaisant, Parr, Fekete, Henry: [Task Taxonomy for Graph Visualization (BELIV 2006)](https://www.microsoft.com/en-us/research/publication/task-taxonomy-graph-visualization/), plus the [2018 survey of 152 empirical studies](https://arxiv.org/pdf/1809.00270) and [Georgia Tech course notes](https://faculty.cc.gatech.edu/~stasko/7450/11f/Notes/graph1.pdf)
- van Ham, Perer: [Search, Show Context, Expand on Demand (InfoVis 2009)](https://dig.cmu.edu/publications/2009-doigraphs.html), [PDF](https://aviz.fr/wiki/uploads/Teaching2015/SearchShowContextArticle.pdf)
- Shneiderman: [The Eyes Have It (1996)](https://webspace.science.uu.nl/~telea001/uploads/VACourse/Shneiderman96.pdf)
- Ghoniem, Fekete, Castagliola: [Node-link vs matrix readability](https://hal.archives-ouvertes.fr/hal-00343819); Okoe et al.: [TVCG 2018](https://smsf.cs.arizona.edu/~kobourov/NL-AM-TVCG18.pdf)
- Mental map and stability: [Staged animation for online dynamic networks](https://arxiv.org/pdf/2009.02005), [Diehl, GD 2002](https://www.st.uni-trier.de/diehl/pubs/GD02_LNCS.pdf), [SFU thesis on measuring stability](https://summit.sfu.ca/item/10032)
- Cambridge Intelligence: [10 rules of great graph design](https://cambridge-intelligence.com/10-rules-great-graph-design/), [How to fix hairballs](https://cambridge-intelligence.com/how-to-fix-hairballs/), [Filtering](https://cambridge-intelligence.com/filtering/)
- Khan, Seo: [QUARTZ (ASSETS 2026 preprint)](https://arxiv.org/pdf/2608.11364)
- Zong et al.: [Rich Screen Reader Experiences for Accessible Data Visualization (EuroVis 2022)](https://vis.mit.edu/pubs/rich-screen-reader-vis-experiences)
- Elavsky et al.: [Data Navigator (VIS 2023)](https://arxiv.org/pdf/2308.08475), [GitHub](https://github.com/cmudig/data-navigator)
- Elavsky: [Chartability](https://dataviz-training.notion.site/Chartability-a-framework-for-auditing-accessibility-97c56d739f0f447998e6d2efa01c326a), [paper](https://diglib.eg.org/handle/10.1111/cgf14522), [validation study](https://diposit.ub.edu/dspace/bitstream/2445/213328/1/paper2022.pdf)
- Blind users and graphs: [Balik et al., GSK](https://ciigar.csc.ncsu.edu/files/bib/Balik2014-AccessGraphs.pdf), [W3C SVG a11y thread on RAVE](https://lists.w3.org/Archives/Public/public-svg-a11y/2015Oct/0015.html), [GoJS accessibility](https://gojs.net/intro/accessibility.html)
- Roving tabindex: [Chrome focusgroup RFC](https://developer.chrome.com/blog/focusgroup-rfc)
- Edge bundling limits: [Divided edge bundling](https://idl.uw.edu/papers/divided-edge-bundling), [Confluent bundling](https://ialab.it.monash.edu/~dwyer/papers/confluentbundling.pdf)
