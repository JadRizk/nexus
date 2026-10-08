---
"@nexus-cyberdeck/react": patch
"@nexus-cyberdeck/tokens": patch
---

The `CommandPalette` search field's underline now uses `--nx-border-strong`
(3.19:1 in `hud-aa`) instead of the decorative `--nx-border-default` hairline
(1.61:1). The input has no border of its own, so that underline is the only
boundary that says a text field is there, which makes it the one edge in the
palette that WCAG 1.4.11 holds to the 3:1 non-text floor. Every other use of the
hairline is a container or divider, or sits on a control identified by its text.
`--nx-palette-divider` still overrides it, and now overrides the field's
underline and the hints divider together, as before.

`semantic.border.default`'s `$description` in `tokens.json` now records why the
hairline is exempt and where it may be used. No token values change.
