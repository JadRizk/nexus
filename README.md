# Nexus Cyberdeck

A HUD design system extracted from a graph-visualisation prototype. Acid-green
on near-black, hairline borders, zero corner radius, corner ticks, monospace
everything — with a WCAG AA mode that keeps the language intact.

```
nexus-ds/
├── packages/
│   ├── tokens/          @nexus-cyberdeck/tokens   CSS custom properties + typed handles
│   │   ├── build-tokens.mjs             the generator
│   │   ├── lib/wcag.mjs                 contrast maths, dependency-free
│   │   └── src/
│   │       ├── tokens.json              SOURCE OF TRUTH — the only file to edit
│   │       ├── tokens.css               generated · both themes
│   │       ├── contrast.gen.ts          generated · computed ratios
│   │       ├── base.css                 hand-authored base + focus rules
│   │       ├── crt.css                  CSS-only CRT layer
│   │       └── index.ts                 typed accessors
│   ├── react/           @nexus-cyberdeck/react    19 components, no runtime deps
│   │   ├── build-styles.mjs             assembles the shipped stylesheet
│   │   └── src/
│   │       ├── components/<Name>/       one folder per component:
│   │       │                             <Name>.tsx · <Name>.css · <Name>.test.tsx
│   │       ├── hooks/                   useFocusTrap, useHotkey (+ tests)
│   │       ├── search/                  rankItems (+ tests)
│   │       ├── colour.ts                the tone/colour resolver
│   │       ├── types.ts                 shared types only
│   │       └── styles.css               generated · concatenated components
│   └── graph/           @nexus-cyberdeck/graph   force-directed WebGL canvas
└── apps/
    └── showcase/        Primitives · Overlays · Tokens
```

## Install

```bash
npm install
npm run build      # builds both packages with tsup (ESM + CJS + .d.ts)
npm run dev        # showcase on :5173
npm run typecheck  # tsc -b, strict
npm run lint       # eslint + stylelint
npm run test       # unit tests, all workspaces
npm run test:browser # visual regression + a11y (needs Docker)
```

## Layout

One folder per component, holding everything about it — implementation, its own
CSS where it needs any, and its tests:

```
src/components/Panel/
  Panel.tsx
  Panel.css        ← concatenated into the shipped styles.css
  Panel.test.tsx
  index.ts
```

`styles.css` is **generated** by `npm run build:styles`; edit the component's
own stylesheet. Components import each other by path rather than through the
barrel, so an import cycle is not possible. Adding a component means adding a
folder — there is no central list to remember to update.

## Releasing

Versions and changelogs are managed with [Changesets](https://github.com/changesets/changesets).
Any change a consumer could notice needs one:

```bash
npx changeset      # pick packages, pick the bump, describe the change
```

CI asks for one on any pull request that touches `packages/*/src`. The entry
you write becomes the changelog verbatim, so write it for someone upgrading.

`@nexus-cyberdeck/tokens` and `@nexus-cyberdeck/react` are versioned in **lockstep**, and `react`
depends on an exact `tokens` version rather than a range. The two communicate
through CSS custom property names at runtime — a component asking for a token
a newer build no longer defines does not fail to compile, it renders the wrong
colour. Pinning is what makes that mismatch unreachable. `@nexus-cyberdeck/graph`
versions independently: the README is explicit that the graph is a product
built *with* the system rather than part of it.

The packages are still `"private": true`, so nothing publishes yet. Versioning
and changelogs work regardless — the history accumulates from now rather than
from the day someone decides to publish. Removing `private` from a package is
the only change needed to start publishing it; the workflow is already wired.

## Visual regression

37 screenshot tests cover the things jsdom cannot see: Panel's corner ticks,
focus rings, hover states, both themes, the CRT layer, and the overlays.

```bash
npm run test:visual          # run the suite
npm run test:visual:update   # re-record after an intended visual change
```

**Docker is required, and that is deliberate.** Chromium renders text
differently on macOS and Linux, so a baseline captured on a laptop fails on CI
for reasons unrelated to the change — which is how visual suites end up
permanently red and then permanently ignored. There is one supported renderer:
the official Playwright container, pinned to the same version as the
`@playwright/test` dependency. CI runs the job in that image; the script above
runs the same image locally. Baselines are therefore Linux-only and byte-
comparable everywhere.

The comparison threshold is **zero differing pixels**. If the suite ever goes
flaky the fix is to stabilise the input — wait for a font, disable an
animation, pin a viewport — never to widen the tolerance. An earlier draft of
this config allowed a 0.2% pixel ratio, which sounds conservative and permits
around 360 changed pixels on a panel screenshot; Panel's four corner ticks are
roughly 120 pixels in total, so deleting the entire corner-tick system passed.

## Usage

```tsx
import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/tokens/crt.css";        // optional
import "@nexus-cyberdeck/react/styles.css";

import { NexusProvider, Panel, Button, CommandPalette } from "@nexus-cyberdeck/react";

export default function App() {
  return (
    <NexusProvider theme="hud-aa" crt>
      <Panel corners={["tl", "br"]}>
        <Button active>Isolate</Button>
      </Panel>
    </NexusProvider>
  );
}
```

Not using React? `@nexus-cyberdeck/tokens` has zero dependencies and ships plain CSS.
Set `data-nx-theme` on any element and the custom properties cascade.

## Token architecture

`src/tokens.json` is the source of truth, in W3C DTCG format. `tokens.css` and
`contrast.gen.ts` are **generated** from it:

```bash
npm run build:tokens     # regenerates both; runs as part of npm run build
```

Editing either generated file by hand is caught in CI. Style Dictionary v4+ and
Figma/Tokens Studio can read the token file unchanged, should you want them.

Three layers. **Components may reference only the semantic layer** — enforced
by ESLint and stylelint, not by convention.

```
primitive   --nx-acid, --nx-grey-300        raw values, never used directly
semantic    --nx-fg-accent, --nx-border-strong   roles, what components use
component   .nx-btn, .nx-slider             per-component composition
```

Both themes define every semantic name, so switching themes never touches
component code.

### The one restricted colour

Magenta is reserved for alarm states — unresolved items and conflicts, nothing
else. That restraint is why it reads as a warning rather than decoration.
`--nx-alarm` has exactly one semantic alias, `--nx-fg-critical`. There is no
general accent alias, so it cannot quietly become a button colour.

### Themes

| | `hud-aa` (default) | `hud` |
|---|---|---|
| muted ramp | lifted, AA-compliant | the prototype's original |
| type scale | ×1.15 | ×1.0 |
| disabled text | 4.52:1 | 2.14:1 ✗ |
| UI boundaries | 3.01:1 | 1.21:1 ✗ |

The signature colours are **identical in both**. Acid 14.98:1, data 12.19:1,
lime 15.20:1, sodium 8.32:1, violet 6.27:1, alarm 5.44:1, phosphor 16.84:1 —
all already clear AA, which is why the accessible theme needed no redesign.
Only the muted ramp had to move.

The ramp was solved rather than eyeballed: hue 100°, saturation 13%,
binary-searched per step against exact contrast targets.

Every ratio quoted above is **computed at build time** from the resolved token
values, not transcribed — including the comments in `tokens.css` itself. Each
theme declares the floors it holds itself to in `tokens.json`, and the build
fails if a colour moves past one:

```
hud-aa/grey-300 is 4.21:1, below the 4.5:1 floor for disabled text — WCAG 1.4.3.
```

That check is itself tested: `lib/build-tokens.test.mjs` feeds the generator a
deliberately broken palette and asserts it refuses to emit.

## Accessibility

Every claim below is asserted by a machine. `browser/a11y.spec.ts` runs
axe-core over the real rendered page — once per route, once per component, and
once per overlay state — plus direct assertions for the things axe cannot see.

```bash
npm run test:a11y
```

axe is treated as a floor, not a ceiling. It found a malformed listbox in
`CommandPalette`'s empty state and a scrollable region with no keyboard access;
it did **not** notice that the showcase traps focus in a modal drawer at page
load. Automated coverage does not replace using the thing with a keyboard.

Verified behaviours:

- **Focus trap, focus restoration, Escape** — one shared `useFocusTrap`
  implementation used by both Drawer and CommandPalette
- **CommandPalette is a real combobox** — input retains focus and owns
  `aria-activedescendant`, results are a `listbox`, a live region announces
  the result count
- **ToggleRow is a real checkbox**, visually hidden but focusable and announced
- **TabStrip uses roving tabindex** with arrow/Home/End
- **Slider stays a native `<input type="range">`** with `aria-valuetext`
- **Global `:focus-visible`** ring that cannot be removed per-component
- **Glyphs carry category by shape**, satisfying 1.4.1 — the criterion most
  dark-neon systems fail
- **Blink capped at 0.94Hz.** The prototype flickered at 9Hz, above the 3Hz
  threshold in WCAG 2.3.1 Level A — a seizure risk, not a preference
- **Slider tracks use `--nx-border-strong`** (3:1) not the decorative hairline,
  because a track is a UI component boundary under 1.4.11
- `prefers-reduced-motion` and `prefers-contrast` both honoured
- **The contrast bargain is asserted in both directions** — `hud-aa` passes
  axe's colour-contrast rule and `hud` is required to fail it, so the
  documented trade-off cannot silently become an undocumented one

## CRT layer

The prototype's CRT is a four-pass GPU pipeline: render to texture,
bright-pass, two blurs, then a composite with barrel distortion, chromatic
aberration, aperture grille, rolling refresh bar, grain and glitch slicing.
**You cannot run that behind every panel in an application.**

`crt.css` gets ~80% of the read for one composited pseudo-element and no
JavaScript. Reserve the shader version for a hero canvas.

```html
<div class="nx-crt nx-crt--roll nx-crt--grain">…</div>
<span class="nx-crt-split">CHROMATIC FRINGING</span>
```

Three independent escape hatches: `data-nx-crt="off"`,
`prefers-reduced-motion`, and `prefers-contrast: more` — because someone asking
for more contrast should not be fighting a scanline overlay.

## What is deliberately not here

The graph itself. The SDF glyph shaders, bézier link geometry, force solver and
CRT pipeline are a *product*, not a design system. They live in
`NexusCyberdeck.jsx`. The library gives you the language; the canvas is yours.

## Known gaps

- **No keyboard path to a canvas surface** (WCAG 2.1.1). This belongs in the
  consuming visualisation, not the component layer.
- No Storybook yet; the showcase app covers the same ground.
- No automated a11y (axe) suite yet — the behaviours above are asserted by
  hand-written tests, the contrast claims by the token build, and the focus
  rings by the visual suite.
