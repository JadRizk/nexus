---
"@nexus-cyberdeck/react": patch
---

`Button` with `aria-disabled="true"` now looks the same as a disabled one. Use it for a button that can run out of things to do while it holds focus, such as a Back button at the start of its history: a `disabled` button drops focus to the page, an `aria-disabled` one keeps it. Guard the click handler yourself, since `aria-disabled` doesn't stop clicks.
