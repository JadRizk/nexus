# @nexus/react

## 3.0.0

### Major Changes

- c9d88b5: Components are styled from CSS with a component token layer, replacing the
  inline `style` objects most of them used.

  Every component now defines its own custom properties on its own class,
  defaulted from the semantic layer, and styles itself from those. States move
  the token rather than restating the property, so a state cannot drift from the
  base rule — and a consumer retheming a component sets one variable on any
  ancestor:

  ```css
  .marketing-site {
    --nx-btn-border: var(--nx-fg-info);
  }
  ```

  That works because custom properties inherit: no specificity fight, no
  `!important`, no fork. Previously an inline `style` outranked every stylesheet
  a consumer could write, so `Panel`'s padding was not adjustable from CSS at
  all. This is the third layer the documentation always claimed
  (`primitive → semantic → component`) and did not have.

  The rule is written down in `packages/react/STYLING.md`: static styling lives
  in CSS, and the `style` prop carries only values that cannot be known before
  render — a caller's colour, a computed position, a percentage width.

  **Breaking for anyone reaching into the rendered markup.** No component API
  changed and nothing looks different — the visual suite verified every baseline
  byte-identical through the conversion — but the DOM now carries classes where
  it previously carried inline styles, so a selector written against an inline
  `style` attribute will no longer match.

### Patch Changes

- c9d88b5: Two overlay fixes, both of which made a documented accessibility guarantee
  untrue in practice.

  `useHotkey` applied its "don't hijack the user's typing" guard to every combo,
  not just unmodified ones. That made `mod+k` unreachable from any focused
  input, textarea, select or contenteditable — and fatally so for the case it
  exists for, because `CommandPalette` keeps focus in its own input for as long
  as it is open (the ARIA combobox pattern), so the shortcut that opened the
  palette could never close it again. The guard now applies only when no
  modifier is wanted. Shift alone still counts as unmodified, because
  Shift+letter is exactly what typing a capital letter is.

  `Drawer` passed `inert=""` to both supported React majors. React 18 needs that
  string idiom, but React 19 classifies `inert` as a boolean attribute, reads
  `""` as false, drops the attribute and warns on every render — so a closed
  Drawer on React 19 was `aria-hidden="true"` with its close and footer buttons
  still in the tab order. A keyboard user tabbed into offscreen content a screen
  reader had been told did not exist, which is the precise defect `inert` is
  there to prevent. The value is now chosen from `React.version`: `""` on React
  18, and the standards-correct boolean everywhere else, so a future major
  inherits the right behaviour rather than the legacy shim.

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

- Updated dependencies [c9d88b5]
  - @nexus/tokens@3.0.0

## 2.0.0

### Major Changes

- **Fixed: `Panel`'s corner ticks never rendered.** The rule resetting the four
  corner variables was `(0,3,0)` — `:not()` contributes its argument's
  specificity — and outranked every rule that sets them at `(0,2,0)`, regardless
  of source order. All four resolved to `transparent` on every panel, in both
  themes, for the entire life of the library.

  The defaults now sit on the bare `.nx-panel` class below the per-corner rules,
  and `corners="none"` is handled by suppressing the pseudo-element rather than
  by out-specifying the defaults.

  **This changes how every `Panel` looks** — the corner brackets now appear. No
  API change, but it is a visible difference in any application already using the
  component, which is why it is a major rather than a patch.

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

### Patch Changes

- `.nx-sr`, the visually-hidden helper, uses `clip-path` instead of the
  deprecated `clip` property.
- Fixed a malformed listbox in `CommandPalette`'s empty state. The "no match"
  message was a bare `<li>` inside `role="listbox"`, which produced two
  accessibility violations the moment a search missed: `aria-required-children`
  (a listbox may only contain options) and an orphaned `listitem` (applying the
  role stops the `<ul>` being a list). The message now sits outside the listbox.
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @nexus/tokens@2.0.0
