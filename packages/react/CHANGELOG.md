# @nexus/react

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
