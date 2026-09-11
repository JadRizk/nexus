---
"@nexus-cyberdeck/tokens": minor
"@nexus-cyberdeck/react": minor
---

`TabStrip` now takes an optional `id` and `panelId`: each tab gets an id (from
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
