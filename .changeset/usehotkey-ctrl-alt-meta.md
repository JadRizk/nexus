---
"@nexus-cyberdeck/react": patch
---

`useHotkey` now recognises `ctrl`, `alt` and `meta` as modifier keywords
alongside the existing `mod` and `shift`, each matched against its own
`KeyboardEvent` flag (`ctrlKey`, `altKey`, `metaKey`) rather than the combined
Cmd-or-Ctrl check `mod` uses — so `"ctrl+k"` no longer silently degrades to a
bare, unmodified `k` that fires on ordinary typing outside text fields. A
combo with an unrecognised part (for example a typo like `"crtl+k"`) now
throws instead of being misparsed. `mod+k` and `shift+k` behave exactly as
before.
