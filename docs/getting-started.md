# Getting started

From an empty folder to a themed panel, a command palette and a WebGL graph in
about ten minutes. Everything below was run end to end against the packed
tarballs on a fresh Vite app (React 19.2, TypeScript 6, Vite 8), so the
snippets are the code that built, not an approximation of it.

## 1. Create an app

Any React 18.3+ or 19 setup works. This guide uses Vite:

```bash
npm create vite@latest my-console -- --template react-ts
cd my-console
npm install
```

### App Router (Next.js 13+)

Both builds emit a `"use client"` banner, so importing a component from
`@nexus-cyberdeck/react` or `@nexus-cyberdeck/graph` inside a Server Component
already puts it on the client side of the boundary — you do not have to add a
`"use client"` file of your own just to render one.

You do need one as soon as you pass a prop a Server Component cannot hold.
Every stateful component here is controlled, so `onChange`, `onSelect`,
`onClose` and `useState` all have to live in a file that declares
`"use client"` itself. In practice that means the smallest wrapper that owns
the state, with the server page rendering the wrapper.

`GraphCanvas` needs that wrapper for a second reason. It opens a WebGL2 context
at mount, so it cannot be server-rendered at all and has to be loaded through
`next/dynamic` with `ssr: false` — and `ssr: false` is itself only allowed in a
Client Component. Both constraints land on the same file, `app/graph/page.tsx`:

<!-- prettier-ignore -->
```tsx
"use client";

import dynamic from "next/dynamic";
import type { LinkCategory, NodeCategory } from "@nexus-cyberdeck/graph";

const GraphCanvas = dynamic(() => import("@nexus-cyberdeck/graph").then((m) => m.GraphCanvas), {
  ssr: false,
});

const nodeCategories: Record<string, NodeCategory> = {
  topic: { label: "TOPIC", code: "TOP", tier: 0, shape: 1, color: "#C6F135", size: 3.2, charge: 3, mass: 3 },
};
const linkCategories: Record<string, LinkCategory> = {
  refs: { label: "LINK", color: "#3AC6D4", width: 1.15, dist: 1, strength: 0.55, arrow: true, flow: 1, curve: 0.13 },
};

export default function GraphPage() {
  return (
    <div style={{ height: 480 }}>
      <GraphCanvas
        nodes={[{ id: "t1", categoryId: "topic", label: "THRESHOLD//ATLAS" }]}
        edges={[]}
        nodeCategories={nodeCategories}
        linkCategories={linkCategories}
      />
    </div>
  );
}
```

`nodeCategories` and `linkCategories` are required props, not optional ones,
and the wrapping `<div>` is what gives the canvas its height — see
[step 7](#7-add-the-graph-optional) for what the category fields mean.

## 2. Install the packages

```bash
npm install @nexus-cyberdeck/react @nexus-cyberdeck/tokens
```

For the graph canvas, add the graph package and Three.js (a peer dependency):

```bash
npm install @nexus-cyberdeck/graph three
```

> Until the first release is on npm, install from tarballs instead. From a
> checkout of this repository run `npm run build`, pack the three packages with
> `npm pack`, and pass all three `.tgz` files to `npm install` in one command
> so the react package's dependency on tokens resolves locally.

## 3. Load the stylesheets once

The tokens stylesheet defines every custom property; the react stylesheet
styles the components from them. Import both at the root, in that order.

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/react/styles.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Delete the `index.css` and `App.css` that Vite scaffolds. They set a light
background and a centred layout the system does not want.

## 4. Wrap the tree in the provider

`NexusProvider` applies `.nx-root`, which carries the dark canvas, the
phosphor foreground, the monospace family and the global focus ring. Without
it every component renders unstyled.

```tsx
// src/App.tsx
import { NexusProvider, Panel, SectionHeading, Stat, Button } from "@nexus-cyberdeck/react";

export default function App() {
  return (
    <NexusProvider theme="hud-aa">
      <Panel corners={["tl", "br"]} raised style={{ width: 280, margin: "var(--nx-space-5)" }}>
        <SectionHeading>/// subject</SectionHeading>
        <div style={{ display: "flex", gap: "var(--nx-space-6)", marginTop: "var(--nx-space-3)" }}>
          <Stat label="Class" value="NODE" tone="info" />
          <Stat label="Conflicts" value="2" tone="critical" />
        </div>
        <Button active style={{ marginTop: "var(--nx-space-5)" }}>
          Isolate
        </Button>
      </Panel>
    </NexusProvider>
  );
}
```

```bash
npm run dev
```

You should see a near-black page with one acid-green bracketed panel. That is
the whole install.

`theme` is `"hud-aa"` (default, WCAG AA) or `"hud"` (the original, lower
contrast). Read or switch it anywhere below the provider with `useNexus()`.

## 5. Add controls

Controls are controlled components: you own the state, they render it.

<!-- prettier-ignore -->
```tsx
import { useState } from "react";
import { TabStrip, ToggleRow, Slider, Glyph } from "@nexus-cyberdeck/react";

const [tab, setTab] = useState<"optics" | "solver">("optics");
const [live, setLive] = useState(true);
const [scan, setScan] = useState(0.55);

<TabStrip
  value={tab}
  onChange={setTab}
  tabs={[{ value: "optics", label: "Optics" }, { value: "solver", label: "Solver" }] as const}
/>
<ToggleRow checked={live} onChange={setLive} label="LIVE" icon={<Glyph shape="hexagon" tone="accent" />} />
<Slider label="SCANLINES" value={scan} min={0} max={1} step={0.01} onChange={setScan} />
```

`TabStrip` is generic over the tab value, so `as const` on the tabs array
gives `onChange` the right union. `ToggleRow` takes `label`, not children.

## 6. Add a command palette

<!-- prettier-ignore -->
```tsx
import { CommandPalette, useHotkey } from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";

const ITEMS: PaletteItem[] = [
  { id: "1", label: "THRESHOLD//ATLAS", code: "ATL", shape: "hexagon" },
  { id: "2", label: "liminal grammar", code: "NDE", shape: "circle" },
];

const [open, setOpen] = useState(false);
useHotkey("mod+k", () => setOpen((v) => !v));

<CommandPalette
  open={open}
  onClose={() => setOpen(false)}
  items={ITEMS}
  onSelect={(item) => { console.log(item); setOpen(false); }}
/>
```

`PaletteItem` is `id` and `label` plus optional `code`, `shape`, `colour` and
`weight`; the palette is generic, so your own item type can extend it and
`onSelect` receives it back typed. `mod` is Cmd on macOS and Ctrl elsewhere.

## 7. Add the graph (optional)

The canvas fills its parent, so give the parent a definite height.

<!-- prettier-ignore -->
```tsx
import { GraphCanvas } from "@nexus-cyberdeck/graph";
import type { NodeCategory, LinkCategory } from "@nexus-cyberdeck/graph";

const nodeCategories: Record<string, NodeCategory> = {
  topic: { label: "TOPIC", code: "TOP", tier: 0, shape: 1, color: "#C6F135", size: 3.2, charge: 3, mass: 3 },
  note:  { label: "NOTE",  code: "NDE", tier: 3, shape: 0, color: "#17E2E5", size: 1.7, charge: 1, mass: 1 },
};
const linkCategories: Record<string, LinkCategory> = {
  refs: { label: "LINK", color: "#3AC6D4", width: 1.15, dist: 1, strength: 0.55, arrow: true, flow: 1, curve: 0.13 },
};

<div style={{ height: 480 }}>
  <GraphCanvas
    nodes={[
      { id: "t1", categoryId: "topic", label: "THRESHOLD//ATLAS" },
      { id: "n1", categoryId: "note", label: "liminal grammar" },
    ]}
    edges={[{ a: "t1", b: "n1", categoryId: "refs" }]}
    nodeCategories={nodeCategories}
    linkCategories={linkCategories}
  />
</div>
```

`color` is a real hex rather than a token because it is bound to the GPU. The
full prop and controller reference is in the
[graph package README](../packages/graph/README.md).

## 8. Retheme without fighting specificity

Every component reads its own custom properties, defaulted from the semantic
layer. Set one on any ancestor:

```css
.marketing-site {
  --nx-btn-border: var(--nx-fg-info);
  --nx-panel-padding: var(--nx-space-7);
}
```

Component tokens are named `--nx-<component>-<part>`. The semantic tokens
themselves are listed in the
[tokens package README](../packages/tokens/README.md).

## Optional: the CRT layer

<!-- prettier-ignore -->
```tsx
import "@nexus-cyberdeck/tokens/crt.css";

<div className="nx-crt nx-crt--roll nx-crt--grain">…</div>
```

One composited pseudo-element and no JavaScript. It switches off entirely
under `prefers-contrast: more` or `data-nx-crt="off"`, and under
`prefers-reduced-motion` the rolling bar stops while the static scanlines
remain. Use it on a hero surface, not behind every panel.

## Things that will bite you

- **No `NexusProvider`, no styling.** Every custom property lives under
  `.nx-root`.
- **Import order matters once:** `tokens.css` before `styles.css`.
- **`GraphCanvas` needs a sized parent.** It is `width: 100%; height: 100%`.
- **Dark only, desktop first.** There is no light theme and no responsive
  breakpoints yet. That is the system's positioning, not an oversight.
- **Bundle size with the graph.** Three.js adds roughly 700 kB minified to the
  first load. Lazy-load the graph route if it is not the landing screen.

## Where next

- [Component README](../packages/react/README.md): the full component list, colour props, accessibility guarantees.
- [Tokens README](../packages/tokens/README.md): every custom property, the typed accessors, DTCG import.
- [STYLING.md](../packages/react/STYLING.md): the rule behind the component-token layer.
- The showcase in this repository (`npm run dev`) renders every component with a rationale note and a code sample.
