# Changelog

## 0.2.0 (source milestone, not published)

Registry availability is independently verifiable with `npm view @jamiojala/evalrail version`. This entry and other versions explicitly labelled as source milestones were not registry releases.

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
