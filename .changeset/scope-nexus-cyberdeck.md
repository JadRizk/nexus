---
"@nexus-cyberdeck/tokens": patch
"@nexus-cyberdeck/react": patch
"@nexus-cyberdeck/graph": patch
---

Packages are named under the `@nexus-cyberdeck` scope. The `@nexus` scope on
npm belongs to the GraphQL Nexus project, so `@nexus/react` was never going to
be publishable; nothing had shipped under the old name, so no consumer has to
migrate.
