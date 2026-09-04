# design-sync notes — @nexus-cyberdeck/react

## Repo-specific setup

- Monorepo (npm workspaces). `react`/`react-dom`/`@types/react` are hoisted to
  the repo-root `node_modules` (sparse inside `packages/react/node_modules`) —
  `--node-modules ./node_modules` (repo root), not the package's own.
- Build: `npm run build -w packages/tokens -w packages/react` (tokens must
  build first; react's build script also copies `src/styles.css` to `dist/`).
- No Storybook in this repo — package shape.

## Provider

`NexusProvider` (`packages/react/src/primitives.tsx`) applies the `.nx-root`
class, which sets the dark canvas background and phosphor foreground colour
every other component's styling assumes (`packages/tokens/src/tokens.css`).
Without it, every preview would render on the harness's hardcoded white card
background with washed-out light-on-light text. Wired via `cfg.provider`
(`theme: "hud-aa"`, `crt: false` — the CRT scanline effect is opt-in via a
manually-applied `nx-crt` class, not something NexusProvider adds itself, so
leaving it off keeps previews clean).

## Known render warns (accepted, not chased)

- `[FONT_MISSING]` for `--nx-font-stencil` (Impact, Haettenschweiler, Arial
  Narrow Bold, Arial Narrow — used only by `Wordmark`). This is a system-font
  stack with a `sans-serif` fallback, not a missing brand webfont — there is
  nothing to source or ship. Accepted as-is.

## Overlay components (Drawer, CommandPalette) — containing-block gotcha

Both use `position: fixed` (`Drawer`: `top`/`right`/`bottom` + explicit
`width`; `CommandPalette`: `inset: 0`) and assume the real page viewport as
their containing block.

The preview harness's single-card render mode (`cardMode: "single"`, used for
both via `cfg.overrides` so they don't paint over neighbors in a grid) wraps
the story in a `transform: translateZ(0)` div (`.ds-single`) so fixed-position
content stays inside the card. That transform makes `.ds-single` the new
containing block for `position: fixed` descendants — but `.ds-single` itself
has no intrinsic height (its only child is out-of-flow), so it collapses to
`height: 0`. `Drawer`'s `top`/`bottom` offsets then resolve against a 0px box
and its `Panel` (`height: 100%`) visibly collapses to ~2px — a real, observed
render defect, not cosmetic. `CommandPalette`'s `inset: 0` collapses the same
way structurally, but its children aren't percentage-sized, so `overflow:
visible` keeps them painting correctly and viewport screenshots (`page.
screenshot({fullPage: false})`) don't care about the ancestor's box — so it
happens to look fine, but the box model underneath is equally wrong.

**Fix applied in both previews** (`Drawer.tsx`, `CommandPalette.tsx`): wrap
the story's return value in a local div with its own `transform:
translateZ(0)` + explicit `height` (matching the component's configured card
viewport, e.g. `520`). Being closer to the fixed-position descendant than
`.ds-single`, this wrapper becomes the new nearest transformed ancestor, so
`Drawer`/`CommandPalette` size against a real, definite height instead of the
collapsed one.

**Re-sync risk**: this is a preview-authoring workaround for a harness
interaction, not a library fix — any *new* overlay/portal component added to
`@nexus-cyberdeck/react` with `position: fixed` will hit the same collapse and needs
the same wrapper in its own preview. Grep future `[RENDER_BLANK]` /
`[RENDER_THIN]` on a `cardMode: single` component against this note before
assuming it's a real component bug.

## Re-sync risks

- Preview verification for this sync was done manually via the session's own
  browser tool (Claude Code's Browser pane), not `package-validate.mjs`'s
  automated Playwright render-check (`--no-render-check` was used) or
  `package-capture.mjs`'s automated per-story capture — neither Playwright nor
  a cached Chromium was installed in this environment. Grades in
  `.design-sync/.cache/review/*.grade.json` were hand-written after visual
  inspection of every component's default (grid) card and, for the two
  overlay components, spot-checked via DOM/computed-style inspection (see
  above). A future re-sync with Playwright available should run the full
  automated render-check + capture at least once to cross-check these grades.
- `@nexus-cyberdeck/graph` (Three.js graph canvas) is intentionally out of scope for
  this sync — uncommitted, no build output yet at sync time. Re-scope in a
  future sync once it's built and stable.
