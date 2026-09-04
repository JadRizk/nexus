# @nexus-cyberdeck/graph

## 1.1.0

### Minor Changes

- The packages are now shaped to be installed. `main`, `module`, `types` and
  `exports` resolve to `dist/` with proper conditions, and `files`,
  `sideEffects` and `publishConfig` are set, so a consumer gets built output and
  a bundler can tree-shake. Previously every entry point pointed at raw
  TypeScript in `src/`, while the `dist/` that tsup built on every run went
  unreferenced.

  `@nexus/react`'s dependency on `@nexus/tokens` is a real version rather than a
  wildcard. Local tooling reads source through a shared alias, so development
  still needs no build step.

  Also removes a global React type augmentation that `@nexus/react` was merging
  into every consumer's `HTMLAttributes` — including React 19 apps, where it
  widened `inert` to the wrong type across their whole codebase.
