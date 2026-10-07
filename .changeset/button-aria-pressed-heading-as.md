---
"@nexus-cyberdeck/react": minor
---

`Button` now announces its toggle state. Passing `active` sets `aria-pressed`
as well as `data-active`, so the state a sighted user reads off the accent
border is the state a screen reader announces — previously `active` was
visual only. `aria-pressed` appears only when the prop is actually passed: a
plain `<Button>` is still a plain button, because `aria-pressed="false"` on
something that is not a toggle announces a control the user can hunt for and
never find. If you were passing `aria-pressed` by hand alongside `active` you
can drop it; both spellings agree and yours still wins.

`SectionHeading` takes an `as` prop, `"div"` (default) or `"span"`, for the
places that accept phrasing content only. `Legend` uses it: its group titles
were `<div>`s inside `<legend>`, which is invalid HTML, and a parser that acts
on that moves the title out of the legend and takes the group's accessible name
with it. `.nx-heading` now declares `display: block` so either tag lays out
identically — nothing moves.

`Drawer`'s closed position is derived from `--nx-drawer-inset` instead of a
hardcoded 28px. It travels its own width plus the gutter, and the gutter is
that token; with the number written out, raising the inset left the drawer
short of the edge while it was meant to be hidden. At the default inset the
travel goes from width + 28px to width + 12px, which is only visible mid-slide.
