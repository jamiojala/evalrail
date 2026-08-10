# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).

To prepare a release candidate:

1. Add a changeset with `pnpm changeset`
2. Commit the generated markdown file
3. Merge to `main`
4. Let the release workflow create or update the version PR
5. Follow the maintainer preflight and external publication gates in [`../docs/releasing.md`](../docs/releasing.md)
