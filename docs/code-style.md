# Code style

What review holds code to. Where a lint rule enforces a line, it is named; "—"
means review only. `packages/graph` is not yet covered by the new rules.

**The ratchet.** New rules land as warnings. Once a package reaches zero
warnings for a rule, that rule becomes an error for that package.

## Comments

| Rule                                                              | Why                                                          | Lint |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ---- |
| Explain why, not what.                                            | The code already says what.                                  | —    |
| Delete a comment a stranger could write by reading the next line. | It costs reading time and adds nothing.                      | —    |
| Condense to the constraint.                                       | The reader needs the rule the code must keep, not a story.   | —    |
| History and "what we tried" go in the commit message or PR.       | Code describes what is, `git log` describes how it got here. | —    |
| JSDoc on exported API for units, ranges and invariants.           | The type says `number`; only a comment says "ms, ≥ 0".       | —    |
| No commented-out code.                                            | Git keeps it; in the file it rots.                           | —    |

## Naming

| Rule                                                                                | Why                                               | Lint                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Booleans start with `is`, `has`, `can`, `should` or `did`.                          | `open` could be a flag, a function or a state.    | `@typescript-eslint/naming-convention` (react, tokens, showcase) |
| No one- or two-letter names outside loops and maths (`i`, `x`, `y`, `dt` are fine). | A name is the cheapest documentation there is.    | —                                                                |
| No dropped-letter abbreviations, except `props`, `ref`, `ctx` and `el`.             | `btn`, `cfg`, `evt` save typing and cost reading. | —                                                                |
| Hooks are `useX`, handlers `handleX`, event props `onX`.                            | The name tells you how it is called.              | —                                                                |
| Public props are not renamed outside a major version.                               | A rename is a breaking change for every consumer. | — (the boolean rule skips destructured props)                    |

## Size and complexity

Lines are a trigger for a second look, not a target. Do not split a function
so that a reader has to jump files to follow one idea.

| Rule                                                        | Why                                                       | Lint                           |
| ----------------------------------------------------------- | --------------------------------------------------------- | ------------------------------ |
| Cognitive complexity ≤ 12.                                  | Past this, a function stops fitting in one reader's head. | `sonarjs/cognitive-complexity` |
| Functions ≤ 60 code lines. Components and tests are exempt. | Complexity is the better measure for components.          | `max-lines-per-function`       |
| Files ≤ 300 code lines.                                     | A longer file usually holds more than one concern.        | `max-lines`                    |
| Nesting depth ≤ 3.                                          | Return early instead.                                     | `max-depth`                    |
| Parameters ≤ 4; past that, take an options object.          | Positional arguments are unreadable at the call site.     | `max-params`                   |

## Hooks

| Rule                                                                                                                                          | Why                                                                                        | Lint                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| One hook, one concern or external system.                                                                                                     | It can then be named, tested and removed on its own.                                       | —                                 |
| Pure logic goes in plain functions; the hook is glue.                                                                                         | Plain functions test without rendering.                                                    | —                                 |
| `useEffectEvent` instead of ref mirrors or `exhaustive-deps` suppressions.                                                                    | It reads the latest value without re-running the effect.                                   | `react-hooks/exhaustive-deps`     |
| Extract a named hook when a component has more than about three related state or effect hooks.                                                | The name documents what they do together.                                                  | —                                 |
| Every effect that subscribes, allocates or schedules cleans up.                                                                               | Strict Mode and fast refresh run effects twice; anything left behind leaks or fires twice. | —                                 |
| Derive during render rather than syncing in an effect ([You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)). | An effect that sets state renders twice and can go stale.                                  | `react-hooks/set-state-in-effect` |

## Types

| Rule                                                                                      | Why                                                                                                             | Lint                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `strict` everywhere.                                                                      | The baseline that makes the types worth having.                                                                 | `tsc`                                      |
| `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, in new strict folders first. | They catch real bugs but need a folder-wide pass to adopt.                                                      | `tsc`                                      |
| Data tables use `as const satisfies T`.                                                   | Ids become a literal union and the shape is still checked.                                                      | —                                          |
| No `any`.                                                                                 | It switches the checker off for everything it touches.                                                          | `@typescript-eslint/no-explicit-any`       |
| Avoid `!`. Where one is unavoidable, an `eslint-disable-next-line` with the reason.       | A non-null assertion is a claim the compiler cannot check; the disable comment is where the claim is justified. | `@typescript-eslint/no-non-null-assertion` |
