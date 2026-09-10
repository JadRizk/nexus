---
"@nexus-cyberdeck/graph": patch
---

`<GraphCanvas physics={...}>` now actually reaches the solver. The initial
value was silently discarded — the effect that forwards it runs before the one
that creates the solver, so on first mount there was nothing to forward it to —
and `gravity` and `damping` were never forwarded at all, at mount or on change,
despite both being documented fields of `PhysicsConfig`. Both were invisible so
long as you passed the documented defaults, because they are the solver's own.

If you were passing a `physics` prop and compensating for it having no effect
(for example by holding a `GraphController` and reheating, or by feeding the
solver the values a second time), you can stop: the layout will now settle
where the props say it should. `repulsion`, `linkDistance`, `cursorForce` and
`settle` already applied on change and are unaffected. No numerics changed.
