---
"@nexus-cyberdeck/react": patch
---

`muted` now works on `Drawer`, `MeterRow`, `Stat` and `Tooltip`, as the README
always said it did. All four accepted the prop and type-checked it, but never
passed it on, so it had no effect: a muted `Stat` still showed its value in its
`tone`. It now overrides `tone` and `colour` and routes to the disabled
foreground, exactly as it already did on `Glyph` and `LinkGlyph`. That covers
`Drawer`'s title accent, a `MeterRow`'s bar, glow and label, a `Stat`'s value
and a `Tooltip`'s accent bar. Nothing changes unless you pass `muted`.
