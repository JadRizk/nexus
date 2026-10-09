# Changesets

Every change that a consumer could notice needs a changeset. Run:

```bash
npx changeset
```

Pick the packages, pick the bump, and write the entry as a sentence someone
upgrading would want to read — what changed and what they have to do about it,
not which files you touched. Those entries become the CHANGELOG verbatim, so
"fix Panel" is a wasted line and "Panel's corner ticks now render; they were
transparent in every theme" is not.

## What this repository's configuration does

**`fixed: [["@nexus-cyberdeck/tokens", "@nexus-cyberdeck/react"]]`** — these two always carry the
same version. `@nexus-cyberdeck/react` depends on an exact `@nexus-cyberdeck/tokens` version rather
than a range, because the two communicate through CSS custom property names at
runtime: a component asking for `--nx-fg-tertiary` from a tokens build that no
longer defines it does not fail to compile, it renders the wrong colour. Exact
pinning plus lockstep versioning is what makes that mismatch unreachable.

**`@nexus-cyberdeck/graph` is versioned independently.** The README is explicit that the
graph is a product built _with_ the design system rather than part of it, so it
should not be dragged through a major version because a token was renamed.

**`privatePackages: { version: true, tag: true }`** — the packages are still
`"private": true`, so nothing publishes to a registry yet. `changeset version`
still bumps them and writes their changelogs, and `changeset publish` still
creates their git tags, which means the release history starts accumulating
now rather than on the day someone decides to publish. Removing `private` is
not enough on its own to start publishing: trusted publishing can only be
configured for a package that already exists, so each package's first publish
is done by hand, with `private` removed in that same pull request, `tokens`
before `react`. See
[How publishing is authorised](../CONTRIBUTING.md#how-publishing-is-authorised).

## Releasing

`.github/workflows/release.yml` runs on pushes to `main`. When changesets are
pending it opens a "Version Packages" pull request that applies the bumps and
updates the changelogs. Merging that PR is the release.
