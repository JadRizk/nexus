# @nexus-cyberdeck/tokens

## 4.0.0

### Minor Changes

- 65a5833: Two muted greys are lighter, and the contrast guard now runs on every opaque
  background rather than only on the panel.

  `--nx-grey-200` moves `#53624B` → `#57664F` and `--nx-grey-300` moves
  `#6B7F61` → `#6F8465` in the `hud-aa` theme. Both cleared their floors against
  `--nx-bg-surface` (3.01:1 and 4.52:1) but not against `--nx-bg-raised`, which
  is lighter (2.83:1 and 4.25:1) — so disabled text and UI boundaries inside a
  `Drawer` were below WCAG 1.4.3 and 1.4.11 where they were actually drawn. The
  new values are 3.19:1 and 4.82:1 on the panel, 3.00:1 and 4.54:1 on raised.
  The `hud` prototype theme is untouched; it declares no floors and still fails
  AA by design.

  This is visible if you depend on the exact hex of `--nx-fg-disabled`,
  `--nx-border-strong` or the ramp primitives — in screenshot baselines, for
  instance. The values in `contrast["hud-aa"]` move with them. Nothing was
  renamed and no token was added or removed.

  The guard behind those numbers also got stricter: `semantic.fg.*` is held to
  the theme's declared text floor (4.5) instead of a hardcoded 3.0, and
  `semantic.border.*` and the focus ring are held to its non-text floor (3.0).
  `--nx-border-default` is exempt and says so in `tokens.json` — it is a
  decorative hairline at 1.61:1, and `--nx-border-strong` is the role that
  carries a control's boundary.

- fcc16b9: `tokens.css` now declares `color-scheme: dark` on `:root`, so native controls
  (scrollbars, `<select>`, form fields) render with the dark UA palette instead
  of clashing with a light default — both shipped themes are dark-only. The
  `Tone` union gained `"cat-lime"` and `"cat-violet"`, and `Surface` gained
  `"hover"`, `"active"` and `"track"`: typed handles for semantic roles that
  already existed in `tokens.json` and in the shipped CSS, but had no route
  through `tone()`/`surface()` before now.
- 46db929: `TabStrip` now takes an optional `id` and `panelId`: each tab gets an id (from
  `useId()` if `id` is omitted), and every tab's `aria-controls` points at
  `panelId`, so a caller's tabpanel can bind to the active tab with
  `aria-labelledby` — previously a tabpanel had no tab id to bind to at all.

  `Tooltip` now takes an `id`, so a subject can reference it with
  `aria-describedby`. Its content wraps at `max-width` instead of truncating
  with an ellipsis, which was silently dropping text with no way to recover it
  (a tooltip has no hover-to-reveal-more).

  Three new tokens, `--nx-z-drawer` (20), `--nx-z-tooltip` (30) and
  `--nx-z-overlay` (40), replace the hardcoded `z-index` values `Tooltip` and
  `CommandPalette` already had and give `Drawer` one for the first time — it had
  none, so its stacking order depended on DOM position alone. See
  [packages/react/README.md](https://github.com/JadRizk/nexus/blob/main/packages/react/README.md#overlay-stacking)
  for the scale and the "no transformed ancestor" constraint that
  `position: fixed` overlays are subject to.

### Patch Changes

- 4cbcb8d: An open `Drawer` and its scrim now stack above page content wherever the
  `Drawer` is mounted. `--nx-z-drawer` was `0`, so a `Drawer` rendered before
  positioned content — every `Panel` is `position: relative` — was painted over
  by it: the cards after it showed through the open drawer and the scrim, and
  stayed clickable through the scrim. `--nx-z-drawer` is now `20`, and the scrim
  takes the same layer (`.nx-drawer__scrim` previously had no `z-index`; it still
  paints under its own drawer by DOM order). The order is unchanged: drawer under
  `--nx-z-tooltip` (30) under `--nx-z-overlay` (40).

  The token keeps its name and meaning (the drawer's layer), so this is not a
  breaking change. Two effects to know about: page content with its own
  `z-index` of 20 or more now covers an open drawer, so keep it below
  `--nx-z-drawer`; and the drawer now sits above the `.nx-crt` scanline layer
  (`z-index: 2`), as the tooltip and palette already did, so it is no longer
  scanlined while open.

- 6e65ea0: The `CommandPalette` search field's underline now uses `--nx-border-strong`
  (3.19:1 in `hud-aa`) instead of the decorative `--nx-border-default` hairline
  (1.61:1). The input has no border of its own, so that underline is the only
  boundary that says a text field is there, which makes it the one edge in the
  palette that WCAG 1.4.11 holds to the 3:1 non-text floor. Every other use of the
  hairline is a container or divider, or sits on a control identified by its text.
  `--nx-palette-divider` still overrides it, and now overrides the field's
  underline and the hints divider together, as before.

  `semantic.border.default`'s `$description` in `tokens.json` now records why the
  hairline is exempt and where it may be used. No token values change.

- 90f836b: Packages are named under the `@nexus-cyberdeck` scope. The `@nexus` scope on
  npm belongs to the GraphQL Nexus project, so `@nexus/react` was never going to
  be publishable; nothing had shipped under the old name, so no consumer has to
  migrate.
- 7b68784: The `.` export's `import` and `require` conditions each now carry their own
  `types` entry (`index.d.ts` for ESM, `index.d.cts` for CJS) instead of sharing
  one declaration file. A `require()` consumer under Node's `node16`/`node18`
  module resolution previously got the ESM types applied to the CommonJS build,
  which `arethetypeswrong` reports as "Masquerading as ESM"; nothing to do on
  upgrade, but a TypeScript consumer on `require()` now resolves the correct
  `.d.cts` file. `CHANGELOG.md` is also now included in the published tarball,
  so `npm view <pkg> versions` and in-editor "what changed" links work without
  visiting the repo.
- ee02a0d: The top-level `$description` in `tokens.json` (shipped as `dist/tokens.json`)
  no longer claims the file is a W3C DTCG document that Style Dictionary v4+ and
  Figma/Tokens Studio read unchanged. It is DTCG in shape
  (`$value`/`$type`/`$description`) with CSS strings as values rather than the
  structured DTCG value shapes, which the package README already said; the
  description and the generator's header comment now say the same, and point a
  strict importer at the README for what to expect. No token name or value
  changes.

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

  `@nexus-cyberdeck/react`'s dependency on `@nexus-cyberdeck/tokens` is a real version rather than a
  wildcard. Local tooling reads source through a shared alias, so development
  still needs no build step.

  Also removes a global React type augmentation that `@nexus-cyberdeck/react` was merging
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
