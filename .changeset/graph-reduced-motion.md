---
"@nexus-cyberdeck/graph": minor
---

`<GraphCanvas>` now honours `prefers-reduced-motion`. It reads the media query
at mount and follows it live, and under `reduce` the glitch bands, grain,
rolling refresh bar and trails go to zero while the HOT-node flicker drops from
9 Hz to the 0.94 Hz the tokens layer caps its blink at (WCAG 2.3.1). The static
scanlines, grille, curve, aberration and vignette stay, as does the physics.
Nothing changes when the preference is off, and the `optics` you pass are gated
on the GPU rather than overwritten, so there is nothing to restore.

If you were doing this yourself — zeroing `optics.glitch`, `optics.grain` and
`optics.trails` from your own `matchMedia` listener — you can stop; keeping it
is harmless. The new state is mirrored onto the `<canvas>` as
`data-nx-reduced-motion="true" | "false"`. The shader sources gain a
`uReduced` float uniform (0 or 1) in `NODE_FS`, `FADE_FS` and `COMPOSITE_FS`;
anyone compiling those sources into their own renderer needs to supply it.
