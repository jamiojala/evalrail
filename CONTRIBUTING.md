# Contributing to EvalRail

Thanks for contributing to EvalRail.

## Prerequisites

- Node.js 18+
- pnpm 10+

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
5. Run `pnpm check` before opening a PR.

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

- Changesets action opens/updates a version PR on `main`.
- Merging that PR publishes to npm (when `NPM_TOKEN` is configured).
- If PR creation is blocked by GitHub Actions policy, either:
  1. Enable `Allow GitHub Actions to create and approve pull requests` in repository settings, or
  2. Set a `CHANGESETS_GITHUB_TOKEN` secret (PAT with repository write access).

## Code of Conduct

Please be respectful, constructive, and collaborative.
