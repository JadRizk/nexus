---
"@nexus-cyberdeck/tokens": patch
"@nexus-cyberdeck/react": patch
"@nexus-cyberdeck/graph": patch
---

The `.` export's `import` and `require` conditions each now carry their own
`types` entry (`index.d.ts` for ESM, `index.d.cts` for CJS) instead of sharing
one declaration file. A `require()` consumer under Node's `node16`/`node18`
module resolution previously got the ESM types applied to the CommonJS build,
which `arethetypeswrong` reports as "Masquerading as ESM"; nothing to do on
upgrade, but a TypeScript consumer on `require()` now resolves the correct
`.d.cts` file. `CHANGELOG.md` is also now included in the published tarball,
so `npm view <pkg> versions` and in-editor "what changed" links work without
visiting the repo.
