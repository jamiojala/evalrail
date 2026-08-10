# Contributing to EvalRail

Thanks for contributing to EvalRail.

## Prerequisites

- Node.js 22+
- pnpm 10.34.5 through the repository `packageManager` declaration and Corepack

## Setup

```bash
pnpm install
```

## Development Commands

```bash
pnpm test
pnpm test:watch
pnpm typecheck
pnpm build
pnpm package:check
pnpm audit:ci
```

## Project Standards

- Keep APIs strongly typed and backward-compatible when possible.
- Add tests for all behavior changes.
- Prefer fixture-driven tests for prompt behavior.
- Keep docs and examples in sync with code changes.
- Never commit provider credentials, API keys, or secrets.
- Keep repository examples/test providers local or mocked.

## Adding New Features

1. Add or update source in `src/`.
2. Add tests in `tests/`.
3. Add/update docs under `docs/`.
4. Add/update an example in `examples/` when useful.
5. Run `pnpm check`, `pnpm build`, `pnpm package:check`, and `pnpm audit:ci` before opening a PR.

## Changesets

EvalRail uses Changesets for releases.

```bash
pnpm changeset
```

Select the package `@jamiojala/evalrail`, choose semantic version bump, and describe the user-facing change.

## Pull Requests

- Keep pull requests focused and reviewable.
- Explain fixture/regression implications clearly in PR descriptions.
- Include before/after behavior when modifying core evaluation logic.

## Release Flow

- A source version or changelog entry does not prove an npm publication.
- Changesets can open/update a version PR on `main` after the release preflight passes.
- Publishing remains maintainer-only and requires the external GitHub/npm gates in [`docs/releasing.md`](docs/releasing.md).

## Code of Conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
