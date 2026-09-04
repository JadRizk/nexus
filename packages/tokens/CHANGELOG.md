# @nexus-cyberdeck/tokens

## 3.0.0

### Patch Changes

- c9d88b5: Ten fixes from an independent review of the tokens/testing/packaging/styling
  work, each confirmed by a second verification pass before landing:

  - **`CommandPalette`**: pressing `End` on an empty result list left `cursor`
    at -1 with nothing to re-clamp it if results later populated for the same
    query, so `Enter` would silently do nothing until an arrow key was pressed.
  - **`Panel`**: `corners="none"` no longer actually suppressed the corner-tick
    pseudo-element — a specificity tie with the generic rule meant source
    order, not intent, decided the winner, and the generic rule silently won.
    Invisible only because the corner-tick colour variables default to
    transparent regardless.
  - **`Slider`, `ToggleRow`, `BlinkCursor`**: still carried static values
    through the `style` prop, unreachable from a consumer stylesheet — the
    three components the STYLING.md conversion missed.
  - **`Glyph`/`LinkGlyph`**: deduplicated identical muted-colour resolution and
    decorative-icon aria logic into `resolveColour`'s new `muted` option and a
    shared `iconA11y()` helper.
  - Five components' hand-rolled `className` merge (one of which had already
    silently diverged from the other four) factored into `mergeClassName()`.

  Also fixes two footguns in the tooling, invisible to a consumer but worth
  knowing about if you build this repo yourself: `build-tokens.mjs`'s
  theme-sensitivity detection had an asymmetric traversal that could have
  silently reintroduced the theme-switch bug for a token shape that doesn't
  exist yet; and `scripts/build-preview.mjs` could silently bundle a stale
  `packages/tokens/dist` build when run on its own.

## 2.0.0

### Major Changes

- **Fixed: the theme switch never worked.** Setting `data-nx-theme` on anything
  below `:root` — which is exactly what `NexusProvider` does — changed nothing a
  component reads.

  A custom property's `var()` is substituted on the element where the declaration
  matches, and only the result inherits. Every semantic token was declared once on
  `:root`, so `--nx-fg-disabled` resolved against `:root`'s ramp and inherited as
  a fixed literal. The attribute changed, the muted ramp did not, and neither did
  the type scale.

  Tokens downstream of a themed primitive are now re-declared inside each theme
  block, so the attribute works on any element and nested themes resolve
  correctly. No token names or values changed; only where they are declared.

- One colour API across every component that carries a colour. `tone` names a
  semantic role and is the preferred route; `colour` takes a raw CSS colour for
  data the token system does not name — a graph node class with its own hex, a
  chart series. `tone` wins when both are given.

  This replaces three spellings of the same idea: `colour` on the glyphs,
  `accent` on the overlays, and `tone` on `Stat`.

  **Breaking.** The `accent` prop is gone from `Drawer` and `Tooltip`:

  ```diff
  -<Drawer accent="var(--nx-fg-info)" … />
  +<Drawer tone="info" … />

  -<Tooltip accent={category.color} … />
  +<Tooltip colour={category.color} … />
  ```

  `MeterRow.colour` is no longer required — pass `tone` instead where the value
  has a semantic role. Existing `colour` props on `Glyph`, `LinkGlyph` and
  `MeterRow` continue to work unchanged.

### Minor Changes

- The packages are now shaped to be installed. `main`, `module`, `types` and
  `exports` resolve to `dist/` with proper conditions, and `files`,
  `sideEffects` and `publishConfig` are set, so a consumer gets built output and
  a bundler can tree-shake. Previously every entry point pointed at raw
  TypeScript in `src/`, while the `dist/` that tsup built on every run went
  unreferenced.

  `@nexus/react`'s dependency on `@nexus/tokens` is a real version rather than a
  wildcard. Local tooling reads source through a shared alias, so development
  still needs no build step.

  Also removes a global React type augmentation that `@nexus/react` was merging
  into every consumer's `HTMLAttributes` — including React 19 apps, where it
  widened `inert` to the wrong type across their whole codebase.

- `tokens.json` is now genuinely the source of truth, in W3C DTCG format.
  `tokens.css` and the contrast table are generated from it, and every contrast
  ratio — including the annotations inside the stylesheet — is computed from the
  resolved colours rather than transcribed by hand.

  Each theme declares the contrast floors it holds itself to, and the build fails
  if a colour moves past one:

  ```
  hud-aa/grey-300 is 4.21:1, below the 4.5:1 floor for disabled text — WCAG 1.4.3.
  ```

  Adds `--nx-bg-track`, `--nx-split-r`, `--nx-split-b`, and semantic aliases for
  two palette colours that previously had none: `--nx-fg-cat-lime` and
  `--nx-fg-cat-violet`. Both were signature colours reachable only by breaking
  the system's own semantic-layer rule.
