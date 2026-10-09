# brand/

The identity of Nexus Cyberdeck, decided 2026-10-09. The direction was already
implemented in `packages/tokens/src/tokens.json`; this folder records it, then
adds the position, the written forms of the name, the mark and the kit.

| File                                                             | Carries                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`BRAND.md`](BRAND.md)                                           | Thesis, voice, typography, non-negotiables, name, mark. The document a human reads.                                             |
| [`PALETTE.md`](PALETTE.md)                                       | Every colour with its measured ratio and the command that produced it.                                                          |
| [`references/research.md`](references/research.md)               | The shelf, and what was taken or refused from it.                                                                               |
| [`references/positioning.md`](references/positioning.md)         | Category, alternatives, onliness statement, one-liner, tagline, and the surface each lives on.                                  |
| [`references/naming.md`](references/naming.md)                   | Written forms, pronunciation, the collision sweep with dated results.                                                           |
| [`references/mark-16px-read.png`](references/mark-16px-read.png) | The shipped marks rendered at 16, 32 and 64 px on light and dark tabs.                                                          |
| [`assets/logo/`](assets/logo/)                                   | Five candidate marks, the shipped mark and its versions, the wordmark, the favicon set and the app icons. **`mark.svg` ships.** |
| [`assets/social/social-card.svg`](assets/social/social-card.svg) | The 1200×630 `og:image`. The PNG beside it is the deliverable; crawlers take raster only.                                       |
| [`assets/social/github-card.svg`](assets/social/github-card.svg) | The 1280×640 GitHub social preview.                                                                                             |
| [`assets/readme-header.svg`](assets/readme-header.svg)           | The README banner. The PNG beside it is what GitHub serves.                                                                     |
| `apps/showcase/public/`                                          | Where the kit is served from. Copied by the build script, never placed by hand.                                                 |

## Which mark ships

**`assets/logo/mark.svg`**: the stencil N, sheared −9°, flat phosphor on void.
It is the wordmark's initial, so the name and the mark are one system and the
wordmark doubles as the lockup. Picked over the bracket-and-cursor
recommendation by the maintainer.

| File                | What                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `mark.svg`          | The mark on its ground. Source of the apple-touch icon and the 192 and 512 icons. |
| `mark-mono.svg`     | `currentColor`, no ground.                                                        |
| `mark-inverted.svg` | Void on transparent, for light surfaces outside the system.                       |
| `favicon.svg`       | **The small mark.** The N redrawn on a 16 px grid. Source of `favicon.ico`.       |
| `icon-maskable.svg` | The N inside Android's 80% safe circle.                                           |
| `wordmark.svg`      | `NEXUS CYBERDECK`, outlined. Also the lockup.                                     |

Small spaces, 48 px and below or a circular slot, carry `favicon.svg`, never
the wordmark.

The refused candidates stay so the choice can be made again on sight:

- `mark-stencil-n.svg`: the shipped N as first drawn, with the Wordmark
  component's chromatic split. The split spends alarm magenta as decoration
  and adds two colours, so the N ships flat. An acid N was also drawn and
  refused for phosphor, which keeps the accent out of the name.
- `mark-bracket-cursor.svg`: the Panel's corner ticks around the block cursor.
  The recommended candidate; refused for the N, which ties the mark to the
  name rather than to a component.
- `mark-box-cursor.svg`: four ticks. Reads as a camera viewfinder or a scan
  target.
- `mark-bracket-hex.svg`: the ATLAS hexagon, framed. A blob at 16 px, and the
  hexagon is the crypto shelf's shape.
- `mark-graph.svg`: three nodes and their links. The links vanish at 16 px, and
  node-and-link is every graph library's icon.

## Reproducing the numbers

```bash
VP=~/.claude/skills/design-direction/scripts/validate-palette.mjs
node $VP accent "#C6F135" --ground "#08090A"
node $VP text "#DFF5C7" --ground "#08090A"
node $VP text "#08090A" --ground "#FFFFFF"
```

Phosphor on void is 17.10:1; void on white is 19.93:1. Every other ratio is in
[`PALETTE.md`](PALETTE.md) beside the command that produced it.

## Regenerating the kit

Two steps. Both outputs are committed, in the same commit as the edit that
caused them.

**1 · The SVG sources.** Run after changing the mark, a string in
`scripts/brand-meta.mjs`, the card's eyebrow or footer, or a colour token.
Strings and colours come from `scripts/brand-meta.mjs`, which reads the
colours from `tokens.json`. Text is outlined from Impact and DejaVu Sans Mono,
so the SVGs need no fonts to render. The drawing dependencies are installed
outside the repository, so the workspace's `node_modules` and lockfile are
untouched:

```bash
D=$(mktemp -d) && npm install --prefix "$D" --no-save opentype.js@1.3.4 dejavu-fonts-ttf@2.37.3
NODE_PATH="$D/node_modules" node scripts/brand-draw.mjs
```

Impact is read from macOS's system path; set `NX_IMPACT_TTF` elsewhere. The
refused candidates are not redrawn. On 2026-10-09 these two commands, run from
a fresh temporary directory, redrew every shipped SVG byte-identical.

**2 · The rasters.** Run after any SVG edit. Renders every PNG with `resvg`
0.48, packs `favicon.ico` from 16, 32 and 48 px renders of the small mark,
copies the served set into `apps/showcase/public/`, and redraws the 16 px
evidence sheet.

```bash
node scripts/brand-assets.mjs
```

| Raster                                                | From                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `logo/apple-touch-icon.png` 180, opaque               | `logo/mark.svg`                                               |
| `logo/icon-192.png`, `logo/icon-512.png`              | `logo/mark.svg`                                               |
| `logo/icon-maskable-512.png`                          | `logo/icon-maskable.svg`                                      |
| `logo/favicon.ico` 16/32/48                           | `logo/favicon.svg`                                            |
| `social/social-card.png` 1200×630, served as `og.png` | `social/social-card.svg`                                      |
| `social/github-card.png` 1280×640                     | `social/github-card.svg`                                      |
| `readme-header.png` 1280×320                          | `readme-header.svg`                                           |
| `../references/mark-16px-read.png`                    | `logo/favicon.svg`, `logo/mark.svg`, `logo/icon-maskable.svg` |

**The head and the manifest are not files to edit.** `apps/showcase/index.html`
holds `%NX_…%` placeholders that the `nx-brand-head` plugin in the showcase's
`vite.config.ts` fills from `scripts/brand-meta.mjs`, in development and at
build. The same plugin serves `site.webmanifest` in development and emits it
into the build, so no copy of the ground colour is ever typed by hand.

`apps/showcase/src/brand.test.ts` fails when a placeholder is left unfilled,
when `theme-color` or the manifest stop matching `primitive.colour.void`, when
a shipped SVG uses a colour outside the ones `BRAND.md` allows it, including
any `rgba()`, or when a served file differs from its source here.

## Checking the kit

Build with the Pages base first, so the checker reads the HTML that ships:

```bash
npm run build -w apps/showcase -- --base=/nexus/
node ~/.claude/skills/brand-identity/scripts/check-kit.mjs --dir brand --public apps/showcase/dist --html apps/showcase/dist/index.html --manifest apps/showcase/dist/site.webmanifest
```

Last run: 2026-10-09. 31 pass · 0 advisory · 0 fail.

## What is not decided

- **The crawler's view.** The card only exists at its URL once this is
  deployed. After the first deploy, paste `https://jadrizk.github.io/nexus/`
  into LinkedIn's Post Inspector and a Slack message once; their caches hold a
  wrong first card for a week.
- **The GitHub social preview.** `github-card.png` has to be uploaded by hand
  under Settings, General, Social preview. There is no API for it.
- **Impact's licence.** The mark and wordmark are outlined from Impact, which
  ships with macOS and Windows under Monotype's licence. Nobody has read that
  licence for logo use. Redrawing the N and the ten letters by hand would end
  the question.
- **The Home hero.** The tagline belongs on the showcase Home page, which is
  being redesigned separately. It is not wired there.
- **Acid at 16 px.** The mark is phosphor, so the accent is absent from the
  tab strip. Whether that loses recognition among other dark favicons has not
  been tried on a real tab strip.
- **Email avatar.** Not produced: no sending address exists.
- **Colour vision.** No one with a colour vision deficiency has looked at the
  kit. Every CVD claim is simulated.
- **The npm scope and the trademark.** Ownership of `@nexus-cyberdeck` on npm is
  unverified, and the trademark search was preliminary. See
  [`references/naming.md`](references/naming.md).
