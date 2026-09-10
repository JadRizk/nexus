---
"@nexus-cyberdeck/react": patch
---

`useFocusTrap` now returns `RefObject<T | null>` instead of `RefObject<T>`. The
old annotation was already wrong for what `useRef<T>(null)` actually produces,
and under `@types/react` 19 (where `RefObject<T>` no longer bakes `| null`
into `current` the way 18 does) it was a real type error waiting for anyone on
the React 19 half of this package's declared peer range — the shipped
`.d.ts` told them `current` could never be null. No runtime change; if your
own code narrowed on the old, incorrect non-nullable type, you may need to
handle `null`.
