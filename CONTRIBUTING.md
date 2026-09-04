# Contributing

Thanks for looking. This document is the short version of how the repository
works; most of it is enforced by CI, so the fastest way to a green pull request
is to run the same checks locally first.

## Setup

Node 18 or later (CI uses 20) and npm. Docker is needed only for the browser
suite.

```bash
git clone https://github.com/JadRizk/nexus.git
cd nexus
npm install
npm run dev            # showcase on :5173
```

Local tooling reads package source directly through `workspace-alias.mjs`, so
you do not need to build before developing or testing. `npm run build` is
only needed to produce `dist/` or to regenerate `reference/preview.jsx`.

## Before you open a pull request

```bash
npm run lint           # eslint + stylelint, including the token-layer rule
npm run typecheck      # tsc, strict, every workspace
npm run test           # unit tests, every workspace
npm run test:coverage  # the coverage gate CI applies
npm run build          # packages + reference/preview.jsx
node scripts/check-docs.mjs
```

CI runs exactly these, then fails if any generated file has drifted:
`packages/tokens/src/tokens.css`, `packages/tokens/src/contrast.gen.ts`,
`packages/react/src/styles.css` and `reference/preview.jsx` are all outputs.
Edit their inputs (`tokens.json`, a component's own `.css`, the package source)
and regenerate:

```bash
npm run build:tokens   # tokens.css + contrast.gen.ts from tokens.json
npm run build:styles   # styles.css from packages/react/src/components/*/*.css
npm run build:preview  # reference/preview.jsx from the packages
```

## Changesets

Any change a consumer could notice needs a changeset, and CI asks for one on
every pull request that touches `packages/*/src`:

```bash
npx changeset          # pick packages, pick the bump, describe the change
npx changeset --empty  # a test or a comment that cannot affect a consumer
```

Write the entry for someone upgrading: what changed and what they have to do
about it. It becomes the CHANGELOG verbatim. See
[.changeset/README.md](.changeset/README.md) for how the lockstep versioning of
`tokens` and `react` works.

## Where things go

One folder per component under `packages/react/src/components/<Name>/`,
holding the implementation, its own CSS where it needs any, and its tests.
Adding a component means adding a folder; there is no central list to update,
and `build:styles` picks the stylesheet up on its own.

The rules that lint enforces, so you find out before CI does:

- **Components reference the semantic token layer only** (`--nx-fg-*`,
  `--nx-bg-*`, `--nx-border-*`, `--nx-space-*`, …). A primitive such as
  `--nx-acid` or `--nx-grey-300` in a component is an error. `--nx-alarm` is
  reachable only through `--nx-fg-critical`.
- **Static styling lives in CSS; the `style` prop carries only values that
  cannot be known before render.** Every component defines its own
  `--nx-<component>-<part>` custom properties, defaulted from the semantic
  layer as fallbacks in the usage, never declared on the same element. The
  reasoning and the trap are in [packages/react/STYLING.md](packages/react/STYLING.md).
- **Class names are `nx-block` or `nx-block__element`**, and custom properties
  are `--nx-*`.

New tokens go in `packages/tokens/src/tokens.json` only. If a token is
theme-sensitive, give it a `nexus.themeOverrides` extension; if it is a colour
with a contrast floor, the build will tell you when it fails.

## Tests

- **Unit tests** (`vitest`, jsdom) assert structure, behaviour and class
  names. They do not assert appearance, because jsdom applies no stylesheet.
- **The browser suite** (`browser/`) asserts appearance and accessibility:
  pixel baselines at zero tolerance and axe-core over every route, component
  and overlay state. It runs only in the pinned Playwright container so that
  baselines are byte-comparable everywhere:

  ```bash
  npm run test:browser          # run it (needs Docker)
  npm run test:browser:update   # re-record baselines after an intended visual change
  ```

  If you change something visible, re-record and commit the baselines that
  changed, and only those. If you cannot run Docker, say so in the pull
  request; CI will produce the diff and a maintainer can re-record.

- Coverage thresholds in `packages/react/vitest.config.ts` sit just under the
  measured baseline. A new component without tests will fail the gate.

## Accessibility is not optional

Every accessibility claim in the README is asserted by a test. If you add an
interactive component: keep native elements where one exists (`button`,
`input type="range"`, a real checkbox), use the shared `useFocusTrap` for
anything modal, never remove the global focus ring, and never encode meaning
by colour alone. Run `npm run test:a11y` and expect axe to be a floor rather
than a ceiling.

## Pull requests

- One concern per pull request. A rename and a behaviour change are two.
- Explain the why in the description; the diff already shows the what.
- Keep the figures honest. The showcase's version, token count and component
  count are derived from the code by `scripts/ds-figures.mjs`; do not
  hand-type them anywhere.

## Releasing

Maintainers only. Merging to `main` with pending changesets opens a "Version
Packages" pull request; merging that is the release. See the
[README](README.md#releasing).

## Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
