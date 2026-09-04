# @nexus-cyberdeck/graph

A force-directed WebGL graph canvas for React, built on Three.js. Nodes are
SDF-rendered glyphs in six silhouettes, links are curved with optional dash,
arrowhead and packet-flow animation, and the whole frame can pass through a CRT
post-process (bloom, barrel distortion, chromatic aberration, scanlines, grain).

It is a companion to the [Nexus Cyberdeck](https://github.com/JadRizk/nexus#readme)
design system and shares its visual language, but has no dependency on it. The
canvas is domain-agnostic: you supply the node and link categories.

## Install

```bash
npm install @nexus-cyberdeck/graph three
```

> Not published yet. Until the first release, install from `npm pack` output —
> see the [getting-started guide](https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md).

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
    charge: 3.0,
    mass: 3.0,
  },
  note: {
    label: "NOTE",
    code: "NDE",
    tier: 3,
    shape: 0,
    color: "#17E2E5",
    size: 1.7,
    charge: 1.0,
    mass: 1.0,
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
    width: 1.15,
    dist: 1.0,
    strength: 0.55,
    arrow: true,
    flow: 1.0,
    curve: 0.13,
  },
  wrote: {
    label: "WROTE",
    color: "#9D7BFF",
    width: 1.0,
    dist: 1.1,
    strength: 0.3,
    dash: 1.3,
    curve: 0.2,
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
        nodes={nodes}
        edges={edges}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
      <button onClick={() => controller.current?.fit()}>Fit</button>
    </div>
  );
}
```

The canvas fills its parent, so the parent needs a definite height.

## Data model

- **`GraphNode`**: `id`, `categoryId`, `label`, optional `state` (0 dormant,
  1 stable, 2 hot, 3 orphan) and an opaque `data` payload that is round-tripped
  through `onSelect` and `getNode` and never read internally. A node with no
  edges is always drawn as an orphan.
- **`GraphEdge`**: `a`, `b`, `categoryId`, optional `data`.
- **`NodeCategory`**: how a category looks and behaves. `shape` is an index into
  the six glyph silhouettes (circle, hexagon, diamond, ring, square, triangle),
  `color` is a real hex because it is bound to the GPU, `tier` is the zoom level
  at which labels appear, and `size`, `charge`, `mass` feed the solver.
- **`LinkCategory`**: `color`, `width`, rest distance (`dist`, a multiplier of
  `physics.linkDistance`), `strength`, and optional `dash`, `arrow`, `flow`
  (packet direction and speed, negative reverses), `curve` and `jit`.

## Props

Everything is a controlled prop; the canvas notifies and the consumer owns
state.

| Prop                                           | Purpose                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes`, `edges`                               | the graph                                                                                                                               |
| `nodeCategories`, `linkCategories`             | per-category appearance and physics                                                                                                     |
| `physics`                                      | partial `PhysicsConfig`: `repulsion`, `linkDistance`, `gravity`, `damping`, `cursorForce`, `settle`                                     |
| `optics`                                       | partial `OpticsConfig`: `glow`, `trails`, `edgeOpacity`, `edgeWidth`, `flowSpeed`, `scan`, `aberr`, `curve`, `grain`, `bloom`, `glitch` |
| `labelMode`                                    | `"auto"` (by tier and zoom), `"key"`, `"all"`, `"off"`                                                                                  |
| `hiddenNodeCategories`, `hiddenLinkCategories` | category ids to hide                                                                                                                    |
| `isolateId`                                    | show only this node and its neighbours                                                                                                  |
| `selectedId`                                   | the selected node; update it from `onSelect`                                                                                            |
| `running`                                      | run the physics solver; `false` pauses it (dragging still works). Default `true`                                                        |
| `onSelect`, `onStats`, `onFatal`               | selection, per-frame stats, WebGL setup failure                                                                                         |

### Controller

The `ref` exposes a `GraphController`:

```ts
controller.current?.fit(); // frame every visible node
controller.current?.focus(id); // frame one node
controller.current?.reheat(); // nudge the solver back above rest
controller.current?.getNode(id); // GraphNodeSnapshot with degree and adjacency
```

## Notes

- Set `optics.curve` to `0` to disable the barrel warp entirely; the CRT pass
  is four render targets and is meant for a hero canvas, not a thumbnail.
- The physics solver, camera maths and shader sources are exported too
  (`createPhysics`, `project`, `unproject`, `NODE_FS`, …) for anyone who
  wants to build a different renderer on the same engine.
- There is no keyboard path to the canvas yet. Provide one in the surrounding UI
  (a list, a command palette) if you need WCAG 2.1.1.

## License

MIT
