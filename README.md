# Nexus Cyberdeck

A HUD design system extracted from a graph-visualisation prototype. Acid-green
on near-black, hairline borders, zero corner radius, corner ticks, monospace
everything — with a WCAG AA mode that keeps the language intact.

```
nexus-ds/
├── packages/
│   ├── tokens/          @nexus/tokens   CSS custom properties + typed handles
│   │   └── src/
│   │       ├── tokens.css               both themes
│   │       ├── crt.css                  CSS-only CRT layer
│   │       ├── tokens.json              source of truth
│   │       └── index.ts                 typed accessors + contrast data
│   └── react/           @nexus/react    16 components, no runtime deps
│       └── src/
│           ├── primitives.tsx           Panel, Button, Slider, Glyph, …
│           ├── overlays.tsx             Drawer, CommandPalette, Legend
│           ├── types.ts                 useFocusTrap, useHotkey, rankItems
│           └── styles.css               pseudo-elements and pseudo-classes
└── apps/
    └── showcase/        Primitives · Overlays · Tokens
```

## Install

```bash
npm install
npm run build      # builds both packages with tsup (ESM + CJS + .d.ts)
npm run dev        # showcase on :5173
npm run typecheck  # tsc -b, strict
```

## Usage

```tsx
import "@nexus/tokens/tokens.css";
import "@nexus/tokens/crt.css";        // optional
import "@nexus/react/styles.css";

import { NexusProvider, Panel, Button, CommandPalette } from "@nexus/react";

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

Not using React? `@nexus/tokens` has zero dependencies and ships plain CSS.
Set `data-nx-theme` on any element and the custom properties cascade.

## Token architecture

Three layers. **Components may reference only the semantic layer.**

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

## Accessibility

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
- No visual regression tests.
