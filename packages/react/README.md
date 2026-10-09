# @nexus-cyberdeck/react

[![The Nexus Cyberdeck showcase: a docked console panel, an entity legend, a theme switcher and an open detail drawer, all acid green on near-black](https://raw.githubusercontent.com/JadRizk/nexus/main/docs/assets/hero.png)](https://jadrizk.github.io/nexus/)

**[Live showcase →](https://jadrizk.github.io/nexus/)**

React components for the [Nexus Cyberdeck](https://github.com/JadRizk/nexus#readme)
HUD design system: acid green on near-black, hairline borders, zero corner
radius, corner ticks, monospace everything, and a WCAG AA theme that keeps the
language intact.

20 components, two hooks, one search ranker. No runtime dependencies beyond
React and `@nexus-cyberdeck/tokens`. Dark only, desktop first, built for
consoles and visualisations rather than marketing pages.

## Install

```bash
npm install @nexus-cyberdeck/react @nexus-cyberdeck/tokens
```

React 18.3 or 19 is a peer dependency.

> Not published yet: the package is held `"private": true` until its first
> publish, so install from `npm pack` output in the meantime — see the
> [getting-started guide](https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md).

## Use

```tsx
import "@nexus-cyberdeck/tokens/tokens.css";
import "@nexus-cyberdeck/react/styles.css";

import { NexusProvider, Panel, Button, SectionHeading, Stat } from "@nexus-cyberdeck/react";

export function App() {
  return (
    <NexusProvider theme="hud-aa">
      <Panel corners={["tl", "br"]} raised style={{ width: 280 }}>
        <SectionHeading>/// subject</SectionHeading>
        <Stat label="Class" value="NODE" tone="info" />
        <Button active>Isolate</Button>
      </Panel>
    </NexusProvider>
  );
}
```

`NexusProvider` must wrap the tree. It applies `.nx-root`, which is where the
custom properties, the dark canvas and the global focus ring live; without it
every component renders unstyled.

`styles.css` requires `tokens.css` to be imported first: it depends on the
focus ring and reduced-motion rules defined in the tokens layer.

`NexusProvider`'s `theme` and `crt` props are **initial values only** — they
seed state on mount and are not re-read afterward, so changing either prop on
a live provider does nothing. After mount, `useNexus().setTheme` and
`useNexus().setCrt` are the only way to change them; there is no
`onThemeChange` callback because the provider is uncontrolled by design, not
also driven by its props.

## Components

|              |                                                                    |
| ------------ | ------------------------------------------------------------------ |
| **Surfaces** | `Panel`, `HazardRule`, `SectionHeading`, `Wordmark`, `BlinkCursor` |
| **Data**     | `Stat`, `KeyValue`, `MeterRow`, `Legend`, `Glyph`, `LinkGlyph`     |
| **Controls** | `Button`, `TabStrip`, `Slider`, `ToggleRow`                        |
| **Overlays** | `Drawer`, `CommandPalette`, `Tooltip`                              |
| **Root**     | `NexusProvider`, `useNexus()`                                      |
| **Hooks**    | `useFocusTrap`, `useHotkey`                                        |
| **Search**   | `rankItems`                                                        |

Five of them — `NexusProvider`, `Panel`, `Button`, `SectionHeading` and
`Wordmark` — extend their underlying element's props and spread the rest onto
the DOM node, so `className`, `style`, `aria-*` and event handlers all pass
straight through. Those five, and no others: the passthrough is the `...rest`
spread in the component, not something every component has.

The other fourteen declare **closed** prop interfaces. They accept exactly the
props they list and nothing else — there is no rest spread, so an `aria-label`
or an `onMouseEnter` passed to one is dropped on the floor rather than reaching
the DOM. Restyle those through their component tokens (below) rather than
through a class. What a closed component lets a caller reach is then one of
three things:

- **`style`, on nine of them** — `BlinkCursor`, `HazardRule`, `KeyValue`,
  `Legend`, `Slider`, `Stat`, `TabStrip`, `ToggleRow` and `Tooltip`. It is
  there for _placement_, not appearance: a component cannot know the margin,
  gap or flex behaviour the surrounding layout needs, and every use of it in
  this repository's own showcase is exactly that (`margin`, `marginTop`,
  `gap`, `flexShrink`). It lands on the component's root element and is spread
  last, so a caller's value wins over the custom properties the component
  computes there. Appearance still belongs to the tokens.
- **A typed dimension prop instead, on five** — `Glyph` and `LinkGlyph` take
  `size`, `MeterRow` takes `labelWidth`, `CommandPalette` and `Drawer` take
  `width`. These own their own box (the last two are overlays that position
  themselves), so the one thing a caller needs to move is a number, and it
  goes through a prop rather than a CSS object. They accept no `style` at all.
- **`className`, on exactly one** — `HazardRule`, which merges the caller's
  class onto its own `nx-hazard`. It is the single exception to the rule that
  closed components keep their class list private, and it is not a passthrough:
  a closed interface with `className` in it still drops `aria-*` and handlers.

So `Stat` takes `label` and `value` and a `style` for placement; `Glyph` takes
`shape`, `size` and a colour and neither `className` nor `style`; `HazardRule`
takes `className` and is still closed. Three-way, not two-way.

### Colour

Components that carry a colour take the same two props everywhere:

```tsx
<Stat tone="critical" />          // semantic role, follows the theme
<Glyph colour={category.hex} />   // raw CSS colour, for data the system cannot name
```

`tone` wins when both are given. `muted` overrides both.

### Theming and extension

Every component defines its own custom properties, defaulted from the semantic
layer. Retheme from any ancestor without specificity fights:

```css
.marketing-site {
  --nx-btn-border: var(--nx-fg-info);
  --nx-panel-padding: var(--nx-space-7);
}
```

Component tokens are named `--nx-<component>-<part>`. See
[STYLING.md](https://github.com/JadRizk/nexus/blob/main/packages/react/STYLING.md)
for the rule and the trap it avoids.

### Overlay stacking

`Drawer`, `CommandPalette` and `Tooltip` are `position: fixed` or `absolute`
and each carries a `--nx-z-*` token — `--nx-z-drawer` (the drawer and its
scrim), `--nx-z-tooltip`, `--nx-z-overlay` (CommandPalette's scrim and panel)
— rather than a hardcoded number, lowest to highest in that order: a tooltip
pointing at something inside an open Drawer has to outrank it, and the modal
palette outranks everything. The drawer layer sits above ordinary positioned
page content, so a `Drawer` renders correctly wherever it mounts, including
ahead of the `Panel`s that follow it; page content that sets its own
`z-index` at or above `--nx-z-drawer` (20) will cover an open drawer, so keep
yours below it.

These numbers are only meaningful relative to one another, and only when
nothing between the overlay and the viewport has created its own stacking
context. `position: fixed` positions against the _initial containing
block_ — normally the viewport — but an ancestor with a `transform`,
`filter`, `perspective`, `contain: layout|paint|content|strict`, or
`opacity` below `1` becomes that containing block instead. Wrap a `Drawer`
or `CommandPalette` inside an ancestor carrying any of those (a
CSS-animated panel is the usual way this happens) and the overlay stops
tracking the viewport and gets clipped to that ancestor's box, `--nx-z-*`
notwithstanding. Render overlays outside any such ancestor — a portal at
the document root is the reliable fix if one can't be avoided.

## Accessibility

Every claim below is asserted by a test in this repository: unit tests for
the ARIA wiring and focus behaviour, and the browser suite — axe-core over a
real renderer — for the things jsdom cannot see.

- `Drawer` and `CommandPalette` trap focus, restore it on close, and close on
  Escape. Closed drawers are `inert` and `aria-hidden`.
- `CommandPalette` is a real ARIA combobox: the input keeps focus and owns
  `aria-activedescendant`, results are a `listbox`, a live region announces the
  count.
- `ToggleRow` is a real checkbox; `Slider` is a native range input with
  `aria-valuetext`; `TabStrip` uses roving tabindex with arrow, Home and End.
- `Glyph` encodes category by silhouette, never by colour alone (WCAG 1.4.1).
- The focus ring is global and cannot be removed per component (WCAG 2.4.7), except that `Slider` relocates it to the thumb and `CommandPalette` deliberately suppresses it on the input.
- `prefers-reduced-motion` and `prefers-contrast` are honoured.

Every accessible name below an app localises has a prop rather than a
hardcoded string, defaulted to the current English copy so existing output is
unchanged:

| Component        | Prop           | Names                                                                 | Default                                                                                       |
| ---------------- | -------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Drawer`         | `closeLabel`   | the close button                                                      | `"Close details"`                                                                             |
| `CommandPalette` | `label`        | the dialog (separate from `placeholder`, which still names the input) | `placeholder`                                                                                 |
| `CommandPalette` | `resultsLabel` | the live-region result count                                          | string or `(count) => string`, defaulting to `` `${count} result${count === 1 ? "" : "s"}` `` |
| `TabStrip`       | `label`        | the tablist                                                           | `"View"`                                                                                      |

## Related

- [`@nexus-cyberdeck/tokens`](https://github.com/JadRizk/nexus/blob/main/packages/tokens/README.md): the CSS custom properties this package renders with.
- [`@nexus-cyberdeck/graph`](https://github.com/JadRizk/nexus/blob/main/packages/graph/README.md): the force-directed WebGL canvas built with the same language.

## License

MIT
