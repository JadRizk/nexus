---
"@nexus-cyberdeck/tokens": patch
---

The top-level `$description` in `tokens.json` (shipped as `dist/tokens.json`)
no longer claims the file is a W3C DTCG document that Style Dictionary v4+ and
Figma/Tokens Studio read unchanged. It is DTCG in shape
(`$value`/`$type`/`$description`) with CSS strings as values rather than the
structured DTCG value shapes, which the package README already said; the
description and the generator's header comment now say the same, and point a
strict importer at the README for what to expect. No token name or value
changes.
