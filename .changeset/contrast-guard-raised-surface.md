---
"@nexus-cyberdeck/tokens": minor
---

Two muted greys are lighter, and the contrast guard now runs on every opaque
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
