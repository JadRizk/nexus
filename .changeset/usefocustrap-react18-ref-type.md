---
"@nexus-cyberdeck/react": patch
---

`useFocusTrap`'s return type now compiles when its ref is passed straight to a
DOM node under `@types/react` 18. It was declared `RefObject<T | null>`, which
React 18's types accept in `useRef` but reject as a `ref` prop (`Type 'null' is
not assignable to type 'HTMLDivElement'`), so `<div ref={useFocusTrap()}>` needed
a cast on the 18 half of the declared peer range while working on 19. It is now
the equivalent object type `{ readonly current: T | null }`, assignable to
`ref` on both, with `current` still honestly nullable. No runtime change.
