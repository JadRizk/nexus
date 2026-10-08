---
"@nexus-cyberdeck/react": patch
---

`useFocusTrap`'s TSDoc no longer points at `scripts/check-react19-types.mjs`,
which was removed when the repository moved its own React baseline to 19. It
now describes how both majors are checked. Documentation only: no runtime or
type change.
