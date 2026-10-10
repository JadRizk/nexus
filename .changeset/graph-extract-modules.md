---
---

Internal refactor of `@nexus-cyberdeck/graph` with no consumer-visible change: node picking, label placement, the hover neighbourhood walk and pre-WebGL graph validation move out of `GraphCanvas` into their own tested modules (`picking`, `labels`, `neighbourhood`, `validate`). First step of the 2.0 graph migration (docs/specs/graph-migration-qrntn.md, phase 1).
