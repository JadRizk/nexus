---
"@nexus-cyberdeck/tokens": minor
---

`tokens.css` now declares `color-scheme: dark` on `:root`, so native controls
(scrollbars, `<select>`, form fields) render with the dark UA palette instead
of clashing with a light default — both shipped themes are dark-only. The
`Tone` union gained `"cat-lime"` and `"cat-violet"`, and `Surface` gained
`"hover"`, `"active"` and `"track"`: typed handles for semantic roles that
already existed in `tokens.json` and in the shipped CSS, but had no route
through `tone()`/`surface()` before now.
