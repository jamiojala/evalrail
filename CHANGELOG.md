# Changelog

No EvalRail version has been published to npm at the time of this source revision. The entries below describe source milestones and Changesets-generated version history, not verified registry releases.

## 0.2.0 (source milestone, not published)

### Minor Changes

- d711f89: Built the first substantial implementation of EvalRail: a local-first TypeScript framework for prompt testing and evaluation.

  This source milestone adds fixture-driven prompt tests, regression snapshots with record/assert/update-missing modes, provider comparison summaries, and a Vitest-friendly runner API.

  It also adds OSS package infrastructure (tsup build, Changesets, CI/release workflows), practical examples, and contributor-facing docs. The repository stores no provider credentials, uses mock/local providers in tests, and includes an OpenAI-compatible adapter with `.env.example` onboarding.

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## 0.1.0 - 2026-03-30 (source milestone, not published)

### Added

- Initial source milestone for `@jamiojala/evalrail`.
- Local-first prompt evaluation runner with fixtures, expectations, and regression snapshots.
- Provider comparison reporting and CI/release automation.
- OpenAI-compatible adapter with `.env.example` onboarding.
