---
"@nexus-cyberdeck/react": patch
---

Ship the `.nx-sr` visually-hidden utility in `@nexus-cyberdeck/react`'s own
`styles.css`, so a consumer loading it without `tokens.css` no longer gets a
visible checkbox and live region. The README now states that `styles.css`
depends on `tokens.css` for the focus ring and reduced-motion rules.
