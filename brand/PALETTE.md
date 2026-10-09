# Nexus Cyberdeck — palette

Every number here is reproducible. The command that produced each table is
printed beside it; re-run it rather than trusting the table.

This is a transcription of `packages/tokens/src/tokens.json`, which is the
source of truth. The token build computes the same ratios into
`packages/tokens/src/contrast.gen.ts` and refuses to emit when a theme misses
its floor. If a value here disagrees with that file, this file is stale.

Validator: `~/.claude/skills/design-direction/scripts/validate-palette.mjs`

---

## Ground

|         | Value     | Role                                                                               |
| ------- | --------- | ---------------------------------------------------------------------------------- |
| Canvas  | `#08090A` | Page ground (`primitive.colour.void`). Brand assets are drawn on this.             |
| Surface | `#0A0C0B` | Panel surface. Every ratio quoted in the system is measured against this.          |
| Raised  | `#11150F` | Raised panel. The lightest opaque surface, so the AA floors are solved against it. |

---

## The accent, and what it forces

```bash
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs accent "#C6F135" --ground "#08090A"
```

|                     |                              |
| ------------------- | ---------------------------- |
| Accent              | `#C6F135` (acid)             |
| OKLCH               | L 0.897 · C 0.204 · H 122.4° |
| Contrast vs canvas  | 15.22:1                      |
| Contrast vs surface | 14.98:1                      |
| Accent-ink          | black `#000000` at 16.03:1   |

**A · Series.** L 0.897 is far outside the L 0.48–0.67 categorical band. Acid
is not a series colour.

**B · Status hues.** Blocked band, a red-green collapse affecting about 8% of
males: **H 70–160°**. Green, yellow and amber are all inside it. Every status
colour the system ships sits outside it.

**C · Success.** Green is not available: ΔE 1.2 against acid under protanopia.
Success is the accent. The system ships no green success state, and the
categorical `lime` is not a status.

**D · Accent-ink.** Black, 16.03:1. Text on an acid fill is black.

---

## Primitives

The private vocabulary. Components may not reference these; lint enforces it.

| Token           | Value     | Named for                                            |
| --------------- | --------- | ---------------------------------------------------- |
| `--nx-void`     | `#08090A` | page ground                                          |
| `--nx-panel`    | `#0A0C0B` | panel surface                                        |
| `--nx-raised`   | `#11150F` | raised surface                                       |
| `--nx-acid`     | `#C6F135` | the accent                                           |
| `--nx-data`     | `#17E2E5` | information                                          |
| `--nx-lime`     | `#7CFF4F` | categorical slot                                     |
| `--nx-sodium`   | `#FF8A1E` | warning, after sodium-vapour lamps                   |
| `--nx-violet`   | `#9D7BFF` | categorical slot                                     |
| `--nx-phosphor` | `#DFF5C7` | default text, after CRT phosphor                     |
| `--nx-alarm`    | `#FF2E63` | **restricted**: reachable only through `fg.critical` |

---

## Roles

```bash
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs text "#DFF5C7,#B0BDA9,#8DA084,#788E6D,#6F8465" --ground "#0A0C0B"
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs text "#DFF5C7,#B0BDA9,#8DA084,#788E6D,#6F8465" --ground "#11150F"
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs text "#C6F135,#17E2E5,#FF8A1E,#FF2E63,#9D7BFF,#7CFF4F" --ground "#0A0C0B"
```

Ratios are for the default `hud-aa` theme.

| Role                  | Maps to            | vs surface | vs raised | Job                                                 |
| --------------------- | ------------------ | ---------- | --------- | --------------------------------------------------- |
| `--nx-bg-canvas`      | void               | —          | —         | Page ground                                         |
| `--nx-border-default` | grey-100 `#2F382B` | 1.61:1     | 1.51:1    | Decorative hairline. **Never identifies anything.** |
| `--nx-border-strong`  | grey-200 `#57664F` | 3.19:1     | 3.00:1    | A control's boundary. Held to 3:1.                  |
| `--nx-fg-default`     | phosphor           | 16.84:1    | 15.84:1   | Headings, values                                    |
| `--nx-fg-muted`       | grey-600 `#B0BDA9` | 10.00:1    | 9.40:1    | Body copy                                           |
| `--nx-fg-subtle`      | grey-500 `#8DA084` | 7.00:1     | 6.59:1    | Secondary copy                                      |
| `--nx-fg-tertiary`    | grey-400 `#788E6D` | 5.50:1     | 5.17:1    | Labels, metadata                                    |
| `--nx-fg-disabled`    | grey-300 `#6F8465` | 4.82:1     | 4.54:1    | Disabled text, still above 4.5                      |
| `--nx-fg-accent`      | acid               | 14.98:1    | —         | The signal, the focus ring, the brand               |
| `--nx-fg-info`        | data               | 12.19:1    | —         | Information                                         |
| `--nx-fg-warning`     | sodium             | 8.32:1     | —         | Degraded                                            |
| `--nx-fg-critical`    | alarm              | 5.44:1     | —         | Unresolved, conflict. Nothing else.                 |
| `--nx-fg-cat-lime`    | lime               | 15.20:1    | —         | Categorical, no status meaning                      |
| `--nx-fg-cat-violet`  | violet             | 6.27:1     | —         | Categorical, no status meaning                      |

**The primary form device.** Line, in two tiers plus the tick.

| Tier     | Weight                            | Means                                                     |
| -------- | --------------------------------- | --------------------------------------------------------- |
| Hairline | 1 px `border.default`             | Region division inside something that already has an edge |
| Boundary | 1 px `border.strong`              | The edge of a control                                     |
| Tick     | 9 px × 1 px arms, `border.accent` | A frame: two corners read as a bracket, four as a box     |

**Focus.** A 2 px acid outline at 2 px offset, global and not removable per
component. Hover is a 10% acid wash; focus is a line. They never look alike.

**Deliberately absent.** No success green (see C). No light-surface roles. No
shadow tokens beyond the two accent glows, which carry no meaning.

---

## Status

```bash
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs status "warning:#FF8A1E,critical:#FF2E63,info:#17E2E5" \
  --accent "#C6F135" --ground "#0A0C0B"
```

| Pair               | ΔE   | Condition | Verdict |
| ------------------ | ---- | --------- | ------- |
| warning ↔ accent   | 14.2 | deutan    | PASS    |
| critical ↔ accent  | 25.0 | deutan    | PASS    |
| info ↔ accent      | 21.2 | protan    | PASS    |
| warning ↔ critical | 11.7 | tritan    | WARN    |
| warning ↔ info     | 21.1 | deutan    | PASS    |
| critical ↔ info    | 19.8 | deutan    | PASS    |

**Severity ordering runs backwards.**

| State    | Value     | Contrast |
| -------- | --------- | -------- |
| info     | `#17E2E5` | 12.19:1  |
| warning  | `#FF8A1E` | 8.32:1   |
| critical | `#FF2E63` | 5.44:1   |

On a dark ground the brighter colour is the louder one, so the validator flags
both steps as inverted. The system's answer is that state is never carried by
colour alone: every status carries its word and its glyph silhouette. The
inversion is recorded rather than re-solved because alarm's restriction, not
its loudness, is what makes it read as a warning. Nobody has tested that claim
with operators.

---

## Category colours

```bash
node ~/.claude/skills/design-direction/scripts/validate-palette.mjs series "#C6F135,#17E2E5,#FF2E63,#FF8A1E,#9D7BFF,#7CFF4F" --surface "#0A0C0B,#11150F"
```

The graph's six entity classes use six colours. **They fail as a chart
series**, and that is a known property, not a defect to fix here:

| Check                      | Result                       |
| -------------------------- | ---------------------------- |
| Lightness band L 0.48–0.67 | 5 of 6 outside               |
| Worst CVD pair             | acid ↔ lime, ΔE 1.9 (protan) |
| Worst normal-vision pair   | acid ↔ lime, ΔE 7.4          |

Category is carried by six glyph silhouettes: circle, hexagon, diamond, ring,
square, triangle. Colour is the second channel. **A Nexus chart never encodes
category by colour alone**, and a chart that needs more than shape plus
colour needs a different palette, solved separately.

---

## Type scale

Closed. Base sizes in rem, multiplied by `--nx-font-scale` (×1.15 in `hud-aa`).

| Step  | Base      | At ×1.15 | For                           |
| ----- | --------- | -------- | ----------------------------- |
| `2xs` | 0.5625rem | 10.35px  | Version stamps, fine print    |
| `xs`  | 0.625rem  | 11.5px   | Body, the `.nx-root` default  |
| `sm`  | 0.6875rem | 12.65px  | Labels                        |
| `md`  | 0.8125rem | 14.95px  | Values                        |
| `lg`  | 1rem      | 18.4px   | Headings, the header wordmark |
| `xl`  | 1.3125rem | 24.15px  | Display, the stencil numerals |

Tracking: `tight` 0.06em, `normal` 0.09em, `wide` 0.14em, `wider` 0.2em.

---

## Form

|                |                                                                             |
| -------------- | --------------------------------------------------------------------------- |
| Primary device | Line: hairline, boundary, corner tick                                       |
| Radius         | 0, everywhere                                                               |
| Elevation      | None by shadow. A raised panel gets a lighter ground and a faint acid glow. |

The furthest-reaching consequence: every mark is square-ended, including
meters, tracks, chart bars and the logo.

---

## Unverified

- Every colour-vision claim is simulated by the validator. No one with a CVD
  has reviewed the system.
- The severity inversion is mitigated by word plus glyph, untested with users.
- Ratios assume sRGB on a calibrated panel. Wide-gamut and OLED black crush
  were not measured.
