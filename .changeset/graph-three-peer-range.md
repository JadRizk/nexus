---
"@nexus-cyberdeck/graph": patch
---

The `three` peer dependency accepts any 0.170+ release. The previous range,
`^0.170.0`, only ever admitted `0.170.x` under 0.x semver, so every consumer on
a current Three.js (including this repository, which tests against 0.185)
got an unmet-peer warning or a second copy of Three.
