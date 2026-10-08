---
"@nexus-cyberdeck/react": major
---

`useHotkey`'s `mod` now means what its documentation always said: Cmd on Apple
platforms (macOS, iOS, iPadOS) and Ctrl everywhere else, and only that key.
It was satisfied by either Cmd or Ctrl on every platform, so on a Mac `mod+k`
also fired on Ctrl+K, which is kill-line in a native text field and which the
hook then swallowed with `preventDefault`, and elsewhere it fired on the
Windows or Super key. The platform is read from `navigator.userAgentData` where
it exists and `navigator.platform` otherwise, when the listener is armed and
never during render, so server rendering is unaffected. If you relied on Ctrl
working for `mod` on a Mac, or Cmd/Super on Windows or Linux, write `ctrl+k` or
`meta+k`, which have always matched their own key exactly.

Combining `mod` with an explicit `ctrl` or `meta` now throws at render.
`"mod+ctrl+k"` used to fire on Cmd alone, because `mod` stopped the individual
modifier checks, while `"mod+alt+k"` correctly required Alt. `mod` already is
one of those two keys, so the combination has no single meaning; the error
points to `"meta+ctrl+k"` for the case where both keys are wanted. `mod+alt`
and `mod+shift` are unchanged.
