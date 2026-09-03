---
"@nexus/react": patch
"@nexus/tokens": patch
---

Ten fixes from an independent review of the tokens/testing/packaging/styling
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
