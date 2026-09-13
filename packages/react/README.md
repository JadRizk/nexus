# @nexus-cyberdeck/react

React components for the [Nexus Cyberdeck](https://github.com/JadRizk/nexus#readme)
HUD design system: acid green on near-black, hairline borders, zero corner
radius, corner ticks, monospace everything, and a WCAG AA theme that keeps the
language intact.

19 components, two hooks, one search ranker. No runtime dependencies beyond
React and `@nexus-cyberdeck/tokens`. Dark only, desktop first, built for
consoles and visualisations rather than marketing pages.

## Install

```bash
npm install @nexus-cyberdeck/react @nexus-cyberdeck/tokens
```

React 18.3 or 19 is a peer dependency.

> Not published yet. Until the first release, install from `npm pack` output —
> see the [getting-started guide](https://github.com/JadRizk/nexus/blob/main/docs/getting-started.md).

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

`NexusProvider`, `Panel`, `Button`, `SectionHeading`, `Wordmark`, and
`HazardRule` extend their underlying element's props, so `className`, `style`,
`aria-*` and event handlers pass straight through. The rest declare closed prop
interfaces — `Stat` takes `label` and `value`, `Glyph` takes `shape` and a
colour, and neither accepts `className`. Restyle those through their component
tokens (below) rather than through a class.

Closed components that compute dynamic values (position, colour from a prop)
accept `style` to carry them; those that do not accept `style` do not expose it
because the component's own styling is complete. See the `style` prop in each
component's `Props` interface to confirm what is accepted.

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

| Component        | Prop           | Names                          | Default                                         |
| ----------------- | -------------- | ------------------------------- | ------------------------------------------------ |
| `Drawer`          | `closeLabel`   | the close button                | `"Close details"`                                 |
| `CommandPalette`  | `label`        | the dialog (separate from `placeholder`, which still names the input) | `placeholder` |
| `CommandPalette`  | `resultsLabel` | the live-region result count | string or `(count) => string`, defaulting to `` `${count} result${count === 1 ? "" : "s"}` `` |
| `TabStrip`        | `label`        | the tablist                     | `"View"`                                          |

## Related

- [`@nexus-cyberdeck/tokens`](https://github.com/JadRizk/nexus/blob/main/packages/tokens/README.md): the CSS custom properties this package renders with.
- [`@nexus-cyberdeck/graph`](https://github.com/JadRizk/nexus/blob/main/packages/graph/README.md): the force-directed WebGL canvas built with the same language.

## License

MIT
