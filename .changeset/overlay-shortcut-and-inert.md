---
"@nexus/react": patch
---

Two overlay fixes, both of which made a documented accessibility guarantee
untrue in practice.

`useHotkey` applied its "don't hijack the user's typing" guard to every combo,
not just unmodified ones. That made `mod+k` unreachable from any focused
input, textarea, select or contenteditable — and fatally so for the case it
exists for, because `CommandPalette` keeps focus in its own input for as long
as it is open (the ARIA combobox pattern), so the shortcut that opened the
palette could never close it again. The guard now applies only when no
modifier is wanted. Shift alone still counts as unmodified, because
Shift+letter is exactly what typing a capital letter is.

`Drawer` passed `inert=""` to both supported React majors. React 18 needs that
string idiom, but React 19 classifies `inert` as a boolean attribute, reads
`""` as false, drops the attribute and warns on every render — so a closed
Drawer on React 19 was `aria-hidden="true"` with its close and footer buttons
still in the tab order. A keyboard user tabbed into offscreen content a screen
reader had been told did not exist, which is the precise defect `inert` is
there to prevent. The value is now chosen from `React.version`: `""` on React
18, and the standards-correct boolean everywhere else, so a future major
inherits the right behaviour rather than the legacy shim.
