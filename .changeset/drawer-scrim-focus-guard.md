---
"@nexus-cyberdeck/react": minor
---

`Drawer` is now modal in practice, not only in its ARIA. It renders a
full-viewport scrim behind the open panel (`.nx-drawer__scrim`, coloured by
`--nx-drawer-scrim`, defaulting to `--nx-scrim`) that blocks pointer
interaction with the page underneath, and `useFocusTrap` — shared with
`CommandPalette` — now guards the document while active: focus that leaves the
trap by any route other than Tab, such as a click on the page behind or a
script calling `focus()` elsewhere, is pulled straight back to wherever it
last was inside. Previously one click outside an open drawer moved focus out,
after which Tab walked the whole page and Escape no longer closed it.

Clicking the scrim does not close the drawer; Escape and the close button do.
When two traps are active at once (a palette opened over a drawer) only the
most recently activated one guards the document, so they never fight.

If you mounted `Drawer` open as a permanently docked side panel, the scrim now
covers the rest of your page while it is open — a drawer is a modal dialog,
and content that should stay interactive alongside it belongs in a `Panel`.
`Drawer` also renders two sibling elements now (scrim, then dialog) instead
of one, so a selector that assumed it was a lone child needs revisiting.
