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

- a4cd8c9: `useHotkey`'s `mod` now means what its documentation always said: Cmd on Apple
  platforms (macOS, iOS, iPadOS) and Ctrl everywhere else, and only that key.
  It was satisfied by either Cmd or Ctrl on every platform, so on a Mac `mod+k`
  also fired on Ctrl+K, which is kill-line in a native text field and which the
  hook then swallowed with `preventDefault`, and elsewhere it fired on the
  Windows or Super key. The platform is read from `navigator.userAgentData` where
  it exists and `navigator.platform` otherwise, when the listener is armed and
  never during render, so server rendering is unaffected. If you relied on Ctrl
  working for `mod` on a Mac, or Cmd/Super on Windows or Linux, write `ctrl+k` or
  `meta+k`, which have always matched their own key exactly.

  Combining `mod` with an explicit `ctrl` or `meta` now throws at render.
  `"mod+ctrl+k"` used to fire on Cmd alone, because `mod` stopped the individual
  modifier checks, while `"mod+alt+k"` correctly required Alt. `mod` already is
  one of those two keys, so the combination has no single meaning; the error
  points to `"meta+ctrl+k"` for the case where both keys are wanted. `mod+alt`
  and `mod+shift` are unchanged.

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

- bfbd9cb: `Drawer` is now modal in practice, not only in its ARIA. It renders a
  full-viewport scrim behind the open panel (`.nx-drawer__scrim`, coloured by
  `--nx-drawer-scrim`, defaulting to `--nx-scrim`) that blocks pointer
  interaction with the page underneath, and `useFocusTrap` — shared with
  `CommandPalette` — now guards the document while active: focus that leaves the
  trap by any route other than Tab, such as a click on the page behind or a
  script calling `focus()` elsewhere, is pulled straight back to wherever it
  last was inside. Previously one click outside an open drawer moved focus out,
  after which Tab walked the whole page and Escape no longer closed it.

  Clicking the scrim does not close the drawer; Escape and the close button do.
  When two traps are active at once (a palette opened over a drawer) only the
  most recently activated one guards the document, so they never fight.

  If you mounted `Drawer` open as a permanently docked side panel, the scrim now
  covers the rest of your page while it is open — a drawer is a modal dialog,
  and content that should stay interactive alongside it belongs in a `Panel`.
  `Drawer` also renders two sibling elements now (scrim, then dialog) instead
  of one, so a selector that assumed it was a lone child needs revisiting.

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

- 2c5d22e: New **`<GraphOutline>`** component: a graph shown as a list, the text alternative to a node-link canvas. A named region holds the summary, one headed section per category, and a native `<details>` per node listing its connections. Each connection's far node is a button that opens and focuses that node's entry, so the list can be travelled the way the graph can. Pass `onSelect` to add a "Select in graph" button, `selectedId` to open and mark the selected node, and `headingLevel` to fit the page's heading outline. It takes the shape `describeGraph()` from `@nexus-cyberdeck/graph` returns, without depending on that package.
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

- 2c5d22e: `Button` with `aria-disabled="true"` now looks the same as a disabled one. Use it for a button that can run out of things to do while it holds focus, such as a Back button at the start of its history: a `disabled` button drops focus to the page, an `aria-disabled` one keeps it. Guard the click handler yourself, since `aria-disabled` doesn't stop clicks.
- 03afcb1: `Button` merges a caller's `className` with `nx-btn` instead of replacing it.
  Previously `className="nx-btn"` was written before `{...rest}`, so passing any
  `className` to `Button` silently dropped `nx-btn` and unstyled the button —
  one of the five components the README promises passthrough for. `Drawer`'s
  close button, which had been hand-rolled specifically to work around this,
  now renders through `Button` like everything else.
- 70f1004: Restructure CommandPalette internals into focused hooks; no API or behaviour change.
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

- 81cd2ee: `muted` now works on `Drawer`, `MeterRow`, `Stat` and `Tooltip`, as the README
  always said it did. All four accepted the prop and type-checked it, but never
  passed it on, so it had no effect: a muted `Stat` still showed its value in its
  `tone`. It now overrides `tone` and `colour` and routes to the disabled
  foreground, exactly as it already did on `Glyph` and `LinkGlyph`. That covers
  `Drawer`'s title accent, a `MeterRow`'s bar, glow and label, a `Stat`'s value
  and a `Tooltip`'s accent bar. Nothing changes unless you pass `muted`.
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
- 3384260: `useFocusTrap`'s TSDoc no longer points at `scripts/check-react19-types.mjs`,
  which was removed when the repository moved its own React baseline to 19. It
  now describes how both majors are checked. Documentation only: no runtime or
  type change.
- c289767: `useFocusTrap`'s return type now compiles when its ref is passed straight to a
  DOM node under `@types/react` 18. It was declared `RefObject<T | null>`, which
  React 18's types accept in `useRef` but reject as a `ref` prop (`Type 'null' is
not assignable to type 'HTMLDivElement'`), so `<div ref={useFocusTrap()}>` needed
  a cast on the 18 half of the declared peer range while working on 19. It is now
  the equivalent object type `{ readonly current: T | null }`, assignable to
  `ref` on both, with `current` still honestly nullable. No runtime change.
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
- Updated dependencies [4cbcb8d]
- Updated dependencies [6e65ea0]
- Updated dependencies [90f836b]
- Updated dependencies [7b68784]
- Updated dependencies [46db929]
- Updated dependencies [ee02a0d]
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
