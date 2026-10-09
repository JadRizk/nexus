---
"@nexus-cyberdeck/tokens": patch
"@nexus-cyberdeck/react": patch
---

An open `Drawer` and its scrim now stack above page content wherever the
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
