# Nexus Cyberdeck

A HUD design system for React. Acid on near-black, hairline borders, corner
ticks, zero radius, monospace everywhere, and a WCAG AA mode that the token
build enforces. Ships with the WebGL graph canvas the panels were drawn around.

This document transcribes a direction that was already implemented. The source
of truth for every value is `packages/tokens/src/tokens.json`; where this file
and that one disagree, that one wins and this one is stale.

## Thesis

The HUD look is usually decoration laid over contrast nobody measured: neon on
black, muted text at 2:1, a cursor flashing at 9 Hz. Nexus Cyberdeck holds that
the instrument aesthetic and the accessibility audit can be the same artefact.
The accessible theme is the default. The immersive prototype theme still ships,
and it is required to fail the contrast rule, so the trade-off stays visible
instead of quietly becoming the default.

The system is built for consoles, dashboards and graph tools that someone
operates for hours. It is not built for marketing pages. It refuses rounded
cards, soft elevation, gradients as decoration, a light mode, and any colour
that carries meaning on its own. Structure is drawn with hairlines and corner
ticks, never with shadows or radius. Category is carried by glyph silhouette
first and colour second.

## Voice

- **Label casing.** Chrome labels are written lowercase in source and set
  uppercase with wide tracking by CSS: `tokens`, `scanlines`, `entity class`.
  Never Title Case.
- **Section prefix.** `///` opens a section heading: `/// relation profile`.
- **Compound identifiers.** `//` joins a qualifier to its class:
  `VECTOR//ATLAS`, `RESIDUE//ATLAS`.
- **Abbreviation.** Codes are three to six capitals from one instrument
  vocabulary: `ATL`, `NDE`, `UNRSLV`, `COMPS`, `DEPS`.
- **Status vocabulary.** Drawn from the graph: `unresolved`, `conflict`,
  `cite`, `mention`. Not `error`, `oops`, `something went wrong`.
- **Identifiers.** Versions are `v1.0` and `DS v1.0`. Tokens are `--nx-…`.

Prose is plain and declarative, in sentence case. The instrument vocabulary
belongs to labels and chrome; body copy is not written in it. Headings state
the finding, not the topic. The README is the reference register.

## Typography

Two faces. Monospace carries everything, body included: the token resolves to
`ui-monospace, "SF Mono", Menlo, Consolas, monospace`. The stencil face is a
condensed grotesque, resolving to `Impact, Haettenschweiler, "Arial Narrow
Bold"`. It appears only in the wordmark, sheared −9° with a chromatic split,
and in display numerals, which are set upright with neither.

The scale is closed at six steps, `2xs` to `xl`, in rem and multiplied by a
per-theme factor (×1.15 in `hud-aa`, ×1.0 in `hud`). The system names no font
file; consumers resolve the stacks.

## Non-negotiables

- **Zero radius.** Every corner is square, including focus rings, tracks and
  the mark. A constraint, not an omission.
- **Dark only.** No light theme exists, and the absence of one keeps every
  ratio measured against one ground.
- **Hairlines and ticks are the structure.** Boundaries are 1 px lines and 9 px
  corner ticks. No drop shadows. The only elevation is a faint accent glow on a
  raised panel, and it never carries meaning.
- **One accent.** Acid is the signal and the focus ring. Alarm magenta is
  reachable only through `fg.critical` and is never decoration.
- **Text clears 4.5:1** in `hud-aa`, measured against the lightest surface a
  component can render on. The build refuses to emit tokens that miss it.
- **Category is never colour alone.** Six glyph silhouettes carry it
  (WCAG 1.4.1).
- **Nothing flashes above 3 Hz.** The blink is capped at 0.94 Hz on the token,
  and reduced motion stops it.
- **Decoration and identification are different tokens.** The decorative
  hairline (`border.default`, 1.61:1) never identifies a control; the boundary
  that does is `border.strong` at 3.19:1.

## References

See [`references/research.md`](references/research.md). In short: Arwes and
augmented-ui are the shelf. The corner frame is taken from that shelf, and the
clipped corner, the sound layer and the absent contrast floor are refused.

## Open

- The six category colours do not separate as a chart series: acid and lime
  collapse to ΔE 1.9 under protanopia. Glyph silhouette is what separates them,
  so no Nexus chart may encode category by colour alone. Recorded in
  `PALETTE.md`; not re-solved here.
- Status loudness runs backwards. Info (12.19:1) is louder than warning
  (8.32:1), which is louder than critical (5.44:1). The mitigation is that
  every status carries its word and its glyph. Nobody has tested whether
  operators read severity correctly from it.
- No one with a colour vision deficiency has reviewed the system. Every CVD
  claim here is simulated.

## Name

_NEK-sus SY-ber-deck._ Two written forms: **Nexus Cyberdeck** wherever the name
is displayed, and **nexus-cyberdeck** wherever it is typed. The stencil
wordmark sets the first in capitals, and `NEXUS` alone appears only in tight
chrome. `nexus` and `nx` are abbreviations of the identifier that predate this
document and stay. `Nexus` alone in prose is refused: it collides with
Sonatype Nexus and GraphQL Nexus.

The name is the metaphor: a cyberdeck is the console an operator works from,
and a nexus is where the graph's links meet. The forms and the collision sweep
are in [`references/naming.md`](references/naming.md).

## Mark

**What ships.** The stencil N: Impact's N, sheared −9° as the Wordmark
component shears it, flat phosphor `#DFF5C7` on void at 17.10:1
(`assets/logo/mark.svg`). At 48 px and below the small mark takes over: the
same N redrawn on a 16 px grid (`assets/logo/favicon.svg`), because Impact's own
N fills its counters at that size. The wordmark is `NEXUS CYBERDECK` in the
same face, shear and colour (`assets/logo/wordmark.svg`).

**The wordmark is the lockup.** The mark is the wordmark's initial, so the two
are never set side by side. Where the name fits, use the wordmark; where it
does not, use the mark.

**Against the non-negotiables:**

- **Zero radius.** The tile is square, and no icon is pre-rounded; platforms
  apply their own masks.
- **Dark only.** The mark is drawn on void. `mark-inverted.svg`, void on
  transparent at 19.93:1 on white, exists only for light surfaces outside the
  system, such as print or a registry page.
- **No shadows.** The mark is flat in every context, the site hero included.
- **One accent.** The mark carries no accent at all. It is phosphor, the
  Wordmark component's default foreground. On release surfaces acid appears
  only as signal: corner ticks, a still cursor, a hazard rule. Never as the
  name.
- **Alarm is restricted.** The Wordmark component's chromatic split spends
  alarm magenta at 33%. That split is a live site texture and never appears on
  the mark or on any release surface.
- **Nothing flashes.** The mark never animates. The cursor on the social card
  is still.

**Clear space.** A quarter of the mark's height on every side; half the cap
height around the wordmark.

**Minimum size.** The mark is used above 48 px; at 48 px and below,
`favicon.svg`. The wordmark is used at 160 px wide and up; below that, the mark.

**Don't.** Recolour it outside the mono and inverted versions. Add the split, a
glow or a shadow. Stretch it, or remove the shear. Set other words in the
stencil face as if they were part of the logo. Animate it on the README, the
social card, the favicon or a registry listing.
