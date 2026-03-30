# Changelog

## 0.2.0

### Minor Changes

- d711f89: I built the first serious release of EvalRail: a local-first TypeScript framework for prompt testing and evaluation.

  This release adds fixture-driven prompt tests, regression snapshots with record/assert/update-missing modes, provider comparison summaries, and a Vitest-friendly runner API.

  It also ships complete OSS package infrastructure (tsup build, Changesets, CI/release workflows), practical examples, and contributor-facing docs. The project is explicitly credential-free in-repo, with mock/local providers by default, plus an OpenAI-compatible adapter and `.env.example` onboarding for easy local setup.

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## 0.1.0 - 2026-03-30

### Added

- Initial release of `@jamiojala/evalrail`.
- Local-first prompt evaluation runner with fixtures, expectations, and regression snapshots.
- Provider comparison reporting and CI/release automation.
- OpenAI-compatible adapter with `.env.example` onboarding.
