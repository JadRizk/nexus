## Wrapping and setup

Every component reads its colours and layout from CSS custom properties that
only exist inside `.nx-root` — the class `NexusProvider` applies. **Wrap the
app root in `NexusProvider`**, or every component renders unstyled (browser
default colours, no dark canvas):

```tsx
import { NexusProvider } from "@nexus/react";

<NexusProvider theme="hud-aa" crt={false}>
  {/* your screen */}
</NexusProvider>
```

- `theme`: `"hud-aa"` (default — WCAG AA contrast) or `"hud"` (the original,
  lower-contrast aesthetic). Every semantic token exists in both, so nothing
  else needs to change when switching.
- `crt`: only flips a `data-nx-crt` attribute for components that read it via
  `useNexus()` — it does **not** itself apply the CRT scanline effect. To get
  scanlines, add the `nx-crt` class (from `@nexus/tokens/crt.css`) to a
  specific container yourself; treat it as a deliberate, occasional accent,
  not a default.

## Styling idiom: CSS custom properties, not utility classes or style props

This is not a Tailwind-style class system and not a prop-based theme (no
`color="accent"` props). Components style themselves inline from `var(--nx-*)`
custom properties defined by `@nexus/tokens`; compose new layout the same way,
via `style`, not by inventing class names. Real tokens (there is no `-100`/
`-900` numeric scale — semantic names only):

| Purpose | Tokens |
|---|---|
| Foreground | `--nx-fg-default`, `-accent`, `-info`, `-warning`, `-critical`, `-tertiary`, `-subtle`, `-muted`, `-disabled` |
| Background | `--nx-bg-canvas` (page), `--nx-bg-surface` (panel), `-raised`, `-hover`, `-active` |
| Border | `--nx-border-default`, `-strong`, `-accent` |
| Space (2px base) | `--nx-space-0` … `--nx-space-8` |
| Type size | `--nx-text-2xs` … `--nx-text-xl` |
| Tracking | `--nx-track-tight`, `-normal`, `-wide`, `-wider` |
| Type family | `--nx-font-mono` (body/UI), `--nx-font-stencil` (display — `Wordmark` only) |
| Motion | `--nx-dur-micro`, `-fade`, `-panel`, with `--nx-ease` |
| Effects | `--nx-glow-raised`, `--nx-glow-inset`, `--nx-hairline`, `--nx-radius`, `--nx-scrim` |
| Focus | `--nx-focus-ring`, `--nx-focus-width`, `--nx-focus-offset` (never remove — WCAG 2.4.7) |

`@nexus/react` re-exports one helper, `tone(t: Tone)`, which returns
`var(--nx-fg-${t})` for the five semantic tones (`default | accent | info |
warning | critical`) — prefer `tone("accent")` over hand-writing the
`var(...)` string when picking a foreground colour dynamically.

## Where the truth lives

- `_ds/tokens/tokens.css` — every custom property, both themes, plus `.nx-root`
  and focus-ring base rules.
- `_ds/tokens/crt.css` — the opt-in scanline effect (`.nx-crt` class).
- `_ds/_ds_bundle.css` — component-owned pseudo-element/pseudo-class rules
  (Panel's corner ticks, native-control hover/active states).
- Each component's own `.prompt.md` for its props and composed usage.

## Build snippet

```tsx
import { NexusProvider, Panel, SectionHeading, Stat, Button } from "@nexus/react";

<NexusProvider theme="hud-aa">
  <Panel corners={["tl", "br"]} raised style={{ width: 280 }}>
    <SectionHeading>/// subject</SectionHeading>
    <div style={{ display: "flex", gap: "var(--nx-space-6)", marginTop: "var(--nx-space-3)" }}>
      <Stat label="Class" value="NODE" tone="info" />
      <Stat label="Conflict" value="2" tone="critical" />
    </div>
    <Button active style={{ marginTop: "var(--nx-space-5)" }}>Isolate</Button>
  </Panel>
</NexusProvider>
```

Everything is dense, monospace, and uppercase-leaning by convention (see
`SectionHeading`, `TabStrip`, `Button`) — a HUD/console aesthetic, not a
general-purpose light UI kit. Reach for six-shape `Glyph` (never colour alone)
to encode categories — this system treats colour-only category coding as a
WCAG 1.4.1 failure, not a style choice.
