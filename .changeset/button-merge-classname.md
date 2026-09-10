---
"@nexus-cyberdeck/react": patch
---

`Button` merges a caller's `className` with `nx-btn` instead of replacing it.
Previously `className="nx-btn"` was written before `{...rest}`, so passing any
`className` to `Button` silently dropped `nx-btn` and unstyled the button —
one of the five components the README promises passthrough for. `Drawer`'s
close button, which had been hand-rolled specifically to work around this,
now renders through `Button` like everything else.
