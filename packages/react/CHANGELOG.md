# @nexus-cyberdeck/react

## 4.0.0

### Major Changes

- b7aca28: `NexusProvider`'s `theme` and `crt` props are now initial values only —
  changing either prop on a live provider no longer does anything. Previously
  the provider was both controlled and uncontrolled: `theme`/`crt` seeded
  `useState` and were then re-synced from the props on every render through a
  pair of `useEffect` calls, with no `onThemeChange` to tell a consumer the
  value had moved, and no way to opt out of the prop-sync short of never
  changing the prop.

  The provider is now uncontrolled by design. `theme` and `crt` seed state on
  mount and are not read again; `useNexus().setTheme` and `useNexus().setCrt`
  are the only way to change them afterward. The context value is also now
  memoised, so a component that only calls `useNexus()` no longer re-renders
  every time `NexusProvider` itself re-renders.

  **Breaking for any consumer that changes the `theme` or `crt` prop on a
  mounted `NexusProvider` and expects the live theme to follow.** That pattern
  now does nothing silently. Switch to holding the value yourself and calling
  `useNexus().setTheme(...)` / `useNexus().setCrt(...)` instead — see the
  "Use" section of the react package README for the updated contract.

### Minor Changes

- 30a42f6: `Button` now announces its toggle state. Passing `active` sets `aria-pressed`
  as well as `data-active`, so the state a sighted user reads off the accent
  border is the state a screen reader announces — previously `active` was
  visual only. `aria-pressed` appears only when the prop is actually passed: a
  plain `<Button>` is still a plain button, because `aria-pressed="false"` on
  something that is not a toggle announces a control the user can hunt for and
  never find. If you were passing `aria-pressed` by hand alongside `active` you
  can drop it; both spellings agree and yours still wins.

  `SectionHeading` takes an `as` prop, `"div"` (default) or `"span"`, for the
  places that accept phrasing content only. `Legend` uses it: its group titles
  were `<div>`s inside `<legend>`, which is invalid HTML, and a parser that acts
  on that moves the title out of the legend and takes the group's accessible name
  with it. `.nx-heading` now declares `display: block` so either tag lays out
  identically — nothing moves.

  `Drawer`'s closed position is derived from `--nx-drawer-inset` instead of a
  hardcoded 28px. It travels its own width plus the gutter, and the gutter is
  that token; with the number written out, raising the inset left the drawer
  short of the edge while it was meant to be hidden. At the default inset the
  travel goes from width + 28px to width + 12px, which is only visible mid-slide.

- b6a2288: Every component that renders a DOM element now forwards its ref, and carries
  a `displayName`. Previously no component forwarded a ref at all, so a
  consumer running against `@types/react` 18 had no way to reach the underlying
  node — the `Panel` div, the `Button`, the `Slider`'s `<input>`, the `Drawer`'s
  dialog node, and so on. On React 19, where `ref` is an ordinary prop, the five
  components that already spread `{...rest}` (`Button`, `NexusProvider`,
  `Panel`, `SectionHeading`, `Wordmark`) happened to forward it there, so the
  two supported majors behaved differently for the same code. `forwardRef` is
  now used uniformly across both.

  The ref target for each component is the element a consumer would reach for:
  the outer container for layout primitives, the `role="dialog"` surface for
  `Drawer` and `CommandPalette`, and the native `<input>` — not the wrapping
  field — for `Slider`. No prop interface gained anything beyond `ref`; every
  closed interface stays closed.

- ab9775a: `Drawer`, `CommandPalette` and `TabStrip` exposed a few accessible names as
  hardcoded English strings, so an app localising its UI had no way to change
  them. Three new props cover the gap, all defaulting to the previous copy so
  existing output — including snapshots — is unchanged unless a consumer opts
  in:

  - `Drawer` takes `closeLabel` for the close button's accessible name.
    Default: `"Close details"`.
  - `CommandPalette` takes `label` for the dialog's own accessible name,
    independent of `placeholder` (which continues to name the input). Default:
    `placeholder`, so the dialog's name is unchanged unless `label` is set
    explicitly.
  - `CommandPalette` takes `resultsLabel` for the live-region announcement made
    as results change — a string is announced verbatim, a function receives
    the result count and formats its own text. Default:
    `` `${count} result${count === 1 ? "" : "s"}` ``.
  - `TabStrip` already took a `label` prop (default `"View"`) for the tablist's
    accessible name; it now has test coverage confirming the accessible name
    actually changes when it is set.

### Patch Changes

- 03afcb1: `Button` merges a caller's `className` with `nx-btn` instead of replacing it.
  Previously `className="nx-btn"` was written before `{...rest}`, so passing any
  `className` to `Button` silently dropped `nx-btn` and unstyled the button —
  one of the five components the README promises passthrough for. `Drawer`'s
  close button, which had been hand-rolled specifically to work around this,
  now renders through `Button` like everything else.
- 90f836b: Packages are named under the `@nexus-cyberdeck` scope. The `@nexus` scope on
  npm belongs to the GraphQL Nexus project, so `@nexus/react` was never going to
  be publishable; nothing had shipped under the old name, so no consumer has to
  migrate.
- ee138be: Ship the `.nx-sr` visually-hidden utility in `@nexus-cyberdeck/react`'s own
  `styles.css`, so a consumer loading it without `tokens.css` no longer gets a
  visible checkbox and live region. The README now states that `styles.css`
  depends on `tokens.css` for the focus ring and reduced-motion rules.
- 7b68784: The `.` export's `import` and `require` conditions each now carry their own
  `types` entry (`index.d.ts` for ESM, `index.d.cts` for CJS) instead of sharing
  one declaration file. A `require()` consumer under Node's `node16`/`node18`
  module resolution previously got the ESM types applied to the CommonJS build,
  which `arethetypeswrong` reports as "Masquerading as ESM"; nothing to do on
  upgrade, but a TypeScript consumer on `require()` now resolves the correct
  `.d.cts` file. `CHANGELOG.md` is also now included in the published tarball,
  so `npm view <pkg> versions` and in-editor "what changed" links work without
  visiting the repo.
- dc57941: Both packages now emit a `"use client";` banner as the first line of
  `dist/index.js` and `dist/index.cjs`. Both use hooks and context, so without
  the directive every import had to be wrapped by the consumer in a Next.js App
  Router project. `@nexus-cyberdeck/tokens` is pure and does not carry the
  directive.
- ea6c50a: `useFocusTrap` now returns `RefObject<T | null>` instead of `RefObject<T>`. The
  old annotation was already wrong for what `useRef<T>(null)` actually produces,
  and under `@types/react` 19 (where `RefObject<T>` no longer bakes `| null`
  into `current` the way 18 does) it was a real type error waiting for anyone on
  the React 19 half of this package's declared peer range — the shipped
  `.d.ts` told them `current` could never be null. No runtime change; if your
  own code narrowed on the old, incorrect non-nullable type, you may need to
  handle `null`.
- 5555bd8: `useHotkey` now recognises `ctrl`, `alt` and `meta` as modifier keywords
  alongside the existing `mod` and `shift`, each matched against its own
  `KeyboardEvent` flag (`ctrlKey`, `altKey`, `metaKey`) rather than the combined
  Cmd-or-Ctrl check `mod` uses — so `"ctrl+k"` no longer silently degrades to a
  bare, unmodified `k` that fires on ordinary typing outside text fields. A
  combo with an unrecognised part (for example a typo like `"crtl+k"`) now
  throws instead of being misparsed. `mod+k` and `shift+k` behave exactly as
  before.
- Updated dependencies [65a5833]
- Updated dependencies [fcc16b9]
- Updated dependencies [90f836b]
- Updated dependencies [7b68784]
  - @nexus-cyberdeck/tokens@4.0.0

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
  - @nexus-cyberdeck/tokens@3.0.0

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

  `@nexus-cyberdeck/react`'s dependency on `@nexus-cyberdeck/tokens` is a real version rather than a
  wildcard. Local tooling reads source through a shared alias, so development
  still needs no build step.

  Also removes a global React type augmentation that `@nexus-cyberdeck/react` was merging
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
  - @nexus-cyberdeck/tokens@2.0.0
