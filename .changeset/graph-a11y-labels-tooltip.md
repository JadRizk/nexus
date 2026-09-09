---
"@nexus-cyberdeck/graph": minor
---

The label pool and tooltip are now `aria-hidden` — a screen reader was
previously announcing whichever rotating subset of node names happened to be
on screen. `GraphCanvas` also accepts a new `ariaLabel` prop and exposes
`role="img"`, so the canvas has one accessible name instead of none. The
tooltip's secondary text (category code and degree) is now `#6B7F61` instead
of `#3D4C39`, which measured 2.17:1 against the tooltip background; the new
colour meets the AA floor. There is still no keyboard path to the canvas —
that remains the consumer's responsibility, as documented.
