---
"@nexus-cyberdeck/graph": minor
---

`onSelect` gets a second argument, `source`: `"pointer"` for a click, `"keyboard"` for a key inside the graph (Space, Escape, Backspace) or a screen reader activating its focus target, `"controller"` for `back()`. A detail panel can use it to stay non-modal for a keyboard selection, so the reader keeps their place in the graph. Existing one-argument handlers are unaffected. The type is exported as `SelectSource`.
