# How components are styled

One rule:

> **Static styling lives in CSS. The `style` prop carries only values that cannot
> be known before render.**

The test is not "does this have a hover state" — it is "could this value have
been written down yesterday". A colour that depends on a prop, a tooltip's
position, a meter's fill percentage: those are computed, and they belong
inline. A panel's padding, a heading's tracking, a wordmark's shear: those are
the design, and they belong in the stylesheet.

## Why this rule and not a looser one

The audit that prompted this proposed a narrower version — classes for anything
with a state or a pseudo-element, inline for everything else. That would have
been satisfied by the code as it already stood, and it would not have fixed the
actual problem.

An inline `style` outranks every stylesheet a consumer can write. Short of
`!important`, the only way to change an inline value from outside is the
component's own `style` prop, which merges by object spread — so whether the
caller's value survives depends on which side of the spread the component put
it. `Panel`'s padding was not adjustable from CSS at all. That is the defect;
"does it have a hover state" is unrelated to it.

## Component tokens

Every component defines its own custom properties on its own class, defaulted
from the semantic layer, and then styles itself from those:

```css
.nx-btn {
  color: var(--nx-btn-fg, var(--nx-fg-muted));
  background: var(--nx-btn-bg, transparent);
  border: var(--nx-hairline) solid var(--nx-btn-border, var(--nx-border-default));
}

.nx-btn:hover {
  --nx-btn-fg: var(--nx-fg-accent);
  --nx-btn-border: var(--nx-border-accent);
}
```

**The default is a fallback in the usage, never a declaration on the same
element.** This matters more than it looks. Writing

```css
.nx-btn {
  --nx-btn-border: var(--nx-border-default);
} /* wrong */
```

appears equivalent and silently defeats the entire mechanism: a custom property
declared on an element always beats the same property inherited from an
ancestor, whatever the specificity. The component would be setting its own
token on every button, so a consumer's override on a wrapper would never reach
one. The first draft of this layer did exactly that, and the test that a
retheme actually lands is what caught it.

Two things follow. States are expressed by moving the _token_, not by
restating the property, so a state cannot drift from the base rule. And a
consumer retheming buttons sets one variable on any ancestor:

```css
.marketing-site {
  --nx-btn-border: var(--nx-fg-info);
}
```

That works because custom properties inherit — no specificity fight, no
`!important`, no fork. This is the layer the README always claimed existed
(`primitive → semantic → component`) and did not.

Component tokens are named `--nx-<component>-<part>`. They are **not** part of
the semantic layer: a component may read the semantic tokens, and a consumer
may override a component token, but nothing reads another component's tokens.

## Passing a computed value into CSS

When a value is dynamic but the rule using it is not, pass the value as a
custom property and keep the rule in the stylesheet:

```tsx
<div className="nx-meter" style={{ "--nx-meter-fill": `${pct}%` }} />
```

```css
.nx-meter::after {
  width: var(--nx-meter-fill);
}
```

This keeps the design in one place while the number stays where it is
calculated.

## What the tests assert

Unit tests assert structure, behaviour and class names. They do **not** assert
appearance: jsdom applies no stylesheet, so `toHaveStyle` on a class-styled
element passes for a component with no styling at all.

Appearance is asserted by the visual suite in `browser/`, against a real
renderer, at zero pixel tolerance.
