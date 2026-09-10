---
"@nexus-cyberdeck/react": patch
"@nexus-cyberdeck/graph": patch
---

Both packages now emit a `"use client";` banner as the first line of
`dist/index.js` and `dist/index.cjs`. Both use hooks and context, so without
the directive every import had to be wrapped by the consumer in a Next.js App
Router project. `@nexus-cyberdeck/tokens` is pure and does not carry the
directive.
