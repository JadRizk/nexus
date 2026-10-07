---
"@nexus-cyberdeck/react": minor
---

Every component that renders a DOM element now forwards its ref, and carries
a `displayName`. Previously no component forwarded a ref at all, so a
consumer running against `@types/react` 18 had no way to reach the underlying
node — the `Panel` div, the `Button`, the `Slider`'s `<input>`, the `Drawer`'s
dialog node, and so on. On React 19, where `ref` is an ordinary prop, the five
components that already spread `{...rest}` (`Button`, `NexusProvider`,
`Panel`, `SectionHeading`, `Wordmark`) happened to forward it there, so the
two supported majors behaved differently for the same code. `forwardRef` is
now used uniformly across both.

The ref target for each component is the element a consumer would reach for:
the outer container for layout primitives, the `role="dialog"` surface for
`Drawer` and `CommandPalette`, and the native `<input>` — not the wrapping
field — for `Slider`. No prop interface gained anything beyond `ref`; every
closed interface stays closed.
