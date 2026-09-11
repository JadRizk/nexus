---
"@nexus-cyberdeck/graph": minor
---

The label pool and tooltip are now `aria-hidden` — a screen reader was
previously announcing whichever rotating subset of node names happened to be
on screen. `GraphCanvas` also accepts a new `ariaLabel` prop: when supplied,
the root exposes `role="img"` + `aria-label`; when omitted, the root exposes
neither, so the canvas never renders a nameless `role="img"` (an axe
`role-img-alt` / WCAG 2.0 A violation). The tooltip's secondary text (category
code and degree) is now `#6F8465` instead of `#3D4C39`, which measured
2.17:1 against the tooltip background; the new colour clears the 4.5 AA
floor even composited over the brightest node colour behind the translucent
tooltip panel (4.5184:1 worst case). There is still no keyboard path to the
canvas — that remains the consumer's responsibility, as documented.
