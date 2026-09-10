## What

<!-- Explain the why; the diff already shows the what. -->

## Checklist

From [CONTRIBUTING.md](../CONTRIBUTING.md):

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] `npm run build -w apps/showcase`
- [ ] `node scripts/check-docs.mjs`
- [ ] `node scripts/check-peer-floor.mjs`
- [ ] Changeset added (`npx changeset`, or `npx changeset --empty` if this
      cannot affect a consumer)
- [ ] One concern per pull request — a rename and a behaviour change are two
- [ ] If this changes something visible: browser baselines re-recorded
      (`npm run test:browser:update`) and only the changed ones committed —
      or, if Docker isn't available to you, say so below so CI's diff can be
      reviewed and re-recorded by a maintainer
- [ ] If this adds or changes an interactive component: native elements kept
      where one exists, `useFocusTrap` used for anything modal, the global
      focus ring left in place, meaning never encoded by colour alone

## Notes for the reviewer

<!-- Anything a reviewer needs that isn't obvious from the diff. -->
