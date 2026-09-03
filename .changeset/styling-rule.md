---
"@nexus/react": major
---

Components are styled from CSS with a component token layer, replacing the
inline `style` objects most of them used.

Every component now defines its own custom properties on its own class,
defaulted from the semantic layer, and styles itself from those. States move
the token rather than restating the property, so a state cannot drift from the
base rule — and a consumer retheming a component sets one variable on any
ancestor:

```css
.marketing-site { --nx-btn-border: var(--nx-fg-info); }
```

That works because custom properties inherit: no specificity fight, no
`!important`, no fork. Previously an inline `style` outranked every stylesheet
a consumer could write, so `Panel`'s padding was not adjustable from CSS at
all. This is the third layer the documentation always claimed
(`primitive → semantic → component`) and did not have.

The rule is written down in `packages/react/STYLING.md`: static styling lives
in CSS, and the `style` prop carries only values that cannot be known before
render — a caller's colour, a computed position, a percentage width.

**Breaking for anyone reaching into the rendered markup.** No component API
changed and nothing looks different — the visual suite verified every baseline
byte-identical through the conversion — but the DOM now carries classes where
it previously carried inline styles, so a selector written against an inline
`style` attribute will no longer match.
