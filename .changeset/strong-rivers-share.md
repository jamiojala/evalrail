---
"@jamiojala/evalrail": minor
---

I built the first serious release of EvalRail: a local-first TypeScript framework for prompt testing and evaluation.

This release adds fixture-driven prompt tests, regression snapshots with record/assert/update-missing modes, provider comparison summaries, and a Vitest-friendly runner API.

It also ships complete OSS package infrastructure (tsup build, Changesets, CI/release workflows), practical examples, and contributor-facing docs. The project is explicitly credential-free in-repo, with mock/local providers by default.
