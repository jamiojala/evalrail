# EvalRail: LLM prompt evaluation and regression testing for TypeScript

EvalRail is a local-first TypeScript library for fixture-driven LLM prompt tests, reviewable regression snapshots, explicit provider rollout gates, and Vitest/CI workflows.

Use it when a prompt, model, or provider change needs the same evidence you expect from a code change. Fixtures and baselines stay in the consuming repository, providers plug into one small interface, and failed quality or resource thresholds stop the rollout.

EvalRail is intentionally narrow. It is a library, not a hosted evaluation platform, dashboard, security scanner, or built-in LLM-as-judge system.

## Package Availability

The npm registry is the source of truth for published versions. Check the current version and artifact integrity before installing:

```bash
npm view @jamiojala/evalrail version dist.integrity
```

For development from the repository, use the source workflow:

```bash
git clone https://github.com/jamiojala/evalrail.git
cd evalrail
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 check
corepack pnpm@10.34.5 package:check
```

## Why prompt changes need regression tests

Prompt behavior can drift when instructions, models, provider settings, or surrounding application code change. EvalRail turns that uncertainty into a reviewable test workflow:

- Define LLM evaluation fixtures in JSON or TypeScript.
- Run explicit assertions with Vitest and CI.
- Record prompt regression baselines as local snapshot files.
- Compare providers against the same fixtures.
- Gate model rollouts on pass rate, reference similarity, measured provider-call duration, and tokens.
- Keep the evaluation artifacts under your own source-control policy.

## Features

- Local-first fixture files (`loadFixturesFromFile` / `writeFixtureFile`)
- Template rendering with variables (`{{variable}}` and dot-path support)
- Built-in expectations (`contains`, `notContains`, `matches`, `minLength`, `referenceSimilarity`)
- Fail-closed token budgets (`maxTotalTokens` / `expectMaxTotalTokens`)
- Regression modes (`record`, `assert`, `update-missing`, `off`)
- File-based snapshot store (`.evalrail/<suite>/<provider>.snapshots.json`)
- Provider comparison with pass rate, provider-call duration, reference similarity, and token usage
- Explicit baseline-versus-candidate rollout decisions with human-readable reasons
- Vitest-friendly API (`runEvalSuite`, `assertRunPassed`)

## Open Source Safety

This repository is intentionally safe for open source collaboration:

- No API keys, tokens, or provider credentials are stored in the repo.
- Tests use local/mock providers and require no external credentials.
- The real-provider example reads credentials from local environment configuration; it does not embed them in source.

## Real Provider Quickstart (After Clone)

You can still run against a real provider quickly without committing secrets.

```bash
cp .env.example .env.local
# edit .env.local with your OPENAI_API_KEY
corepack pnpm@10.34.5 install --frozen-lockfile
pnpm example:openai
```

This uses `createOpenAICompatibleProvider(...)` and reads values from `.env.local`.

## Registry Install

When the registry check returns a version, install the package with:

```bash
pnpm add -D @jamiojala/evalrail vitest
```

## Quick Start

```ts
import {
  expectContains,
  runEvalSuite,
  assertRunPassed,
  formatRunSummary,
  type PromptProvider
} from "@jamiojala/evalrail";

const provider: PromptProvider = {
  id: "mock",
  async generate(request) {
    // Keep examples local-first and credential-free in OSS.
    return { output: `Answer: ${request.renderedPrompt}` };
  }
};

const run = await runEvalSuite({
  suite: "prompt-smoke",
  fixtures: [
    {
      id: "status",
      prompt: "Summarize release {{version}}",
      variables: { version: "1.4.0" },
      expectations: [expectContains("1.4.0")]
    }
  ],
  providers: [provider],
  regression: {
    mode: "update-missing",
    storeDir: ".evalrail"
  }
});

console.log(formatRunSummary(run));
assertRunPassed(run);
```

## Fixture-First Workflow

Fixture files are plain JSON and easy to review in pull requests:

```json
{
  "fixtures": [
    {
      "id": "refund-request",
      "prompt": "Draft response for {{issue}}",
      "variables": { "issue": "Billing error" },
      "contains": ["refund"],
      "minLength": 50
    }
  ]
}
```

Load and execute:

```ts
import { loadFixturesFromFile, runEvalSuite } from "@jamiojala/evalrail";

const fixtures = await loadFixturesFromFile("examples/fixtures/support-fixtures.json");
const run = await runEvalSuite({ suite: "support", fixtures, providers: [provider] });
```

## Gate token regressions

Providers can return token usage with each response. EvalRail keeps that usage in fixture results, aggregates it per provider, and can fail a fixture when the metric is missing or over budget.

```ts
import { expectMaxTotalTokens } from "@jamiojala/evalrail";

const fixture = {
  id: "concise-answer",
  prompt: "Answer in one sentence",
  expectations: [expectMaxTotalTokens(120)]
};
```

JSON fixtures support the same gate with `"maxTotalTokens": 120`. EvalRail accepts non-negative safe integers, derives a total when both input and output tokens are present, and conservatively uses the larger value if a reported total is lower than their sum. It does not estimate missing usage or convert tokens into currency.

## Regression Modes

- `record`: overwrite snapshots for every fixture
- `assert`: fail if snapshots are missing or output drifts
- `update-missing`: create snapshots only when absent; assert existing ones
- `off`: disable regression checks

## Compare LLM providers and gate model rollouts

Use the same fixture set across providers, inspect their measured behavior, and make the rollout rule explicit:

```ts
import {
  assertRolloutPassed,
  runEvalSuite,
  buildProviderComparison,
  evaluateProviderRollout,
  formatProviderComparison,
  formatProviderRollout
} from "@jamiojala/evalrail";

const run = await runEvalSuite({
  suite: "provider-rollout",
  fixtures,
  providers: [providerA, providerB]
});

const comparison = buildProviderComparison(run);
console.log(formatProviderComparison(comparison));

const rollout = evaluateProviderRollout(run, {
  baselineProviderId: "incumbent",
  candidateProviderId: "candidate",
  thresholds: {
    maxPassRateDrop: 0,
    minReferenceSimilarityDelta: -0.02,
    maxAverageProviderDurationMultiplier: 1.5,
    maxTotalTokensMultiplier: 1.2
  }
});

console.log(formatProviderRollout(rollout));
assertRolloutPassed(rollout);
```

Every configured gate produces a pass/fail result and reason. Similarity and token gates fail closed when the required measurements are missing. EvalRail never applies a hidden cost table; callers decide what token change is acceptable for their models and use case.

## Run LLM evals with Vitest and CI

```ts
import { describe, it } from "vitest";
import { runEvalSuite, assertRunPassed } from "@jamiojala/evalrail";

describe("prompt guardrails", () => {
  it("holds baseline behavior", async () => {
    const run = await runEvalSuite({
      suite: "guardrails",
      fixtures,
      providers,
      regression: { mode: "assert", storeDir: ".evalrail" }
    });

    assertRunPassed(run);
  });
});
```

See [`docs/testing-llm-prompts-in-typescript.md`](docs/testing-llm-prompts-in-typescript.md) for an end-to-end fixture, regression, provider rollout, and GitHub Actions workflow.

## When EvalRail fits

Choose EvalRail when you want a typed library inside an existing TypeScript test workflow and prefer local, reviewable files over a hosted control plane.

EvalRail is not currently the right fit when you need a web UI, hosted traces, managed datasets, built-in model pricing, an LLM judge catalogue, RAG evaluation, red teaming, or a broad provider SDK. Those are deliberate scope boundaries, not implied future features.

## FAQ

### How do I test LLM prompts in TypeScript?

Define fixtures, implement the small `PromptProvider` interface, run `runEvalSuite`, and call `assertRunPassed` from Vitest or another test runner. Fixtures can use direct TypeScript expectations or JSON shortcuts.

### How does prompt regression testing work?

EvalRail records one local baseline per suite and provider. In `assert` mode, new output is compared with that baseline and drift fails the run. Snapshot files can be reviewed and optionally committed under the consuming repository's policy.

### Can EvalRail compare OpenAI-compatible models?

Yes. The built-in adapter targets OpenAI-compatible chat-completions endpoints. Other providers can implement `PromptProvider` without adding their SDK to EvalRail.

### Does local-first mean prompts never leave the machine?

No. Fixtures and snapshots are local by default, but a real provider adapter sends the rendered prompt to the endpoint you configure. Mock providers keep tests credential-free and offline; remote providers follow their own data-handling terms.

## Repository Layout

- `src/` package source
- `tests/` Vitest coverage for fixtures, runner, regression, comparison
- `examples/` runnable scripts and sample fixture files
- `docs/` deeper guides
- `.github/workflows/` CI and release pipelines

## Documentation

- [`docs/getting-started.md`](docs/getting-started.md)
- [`docs/fixtures-and-regression.md`](docs/fixtures-and-regression.md)
- [`docs/provider-comparison.md`](docs/provider-comparison.md)
- [`docs/provider-adapters.md`](docs/provider-adapters.md)
- [`docs/testing-llm-prompts-in-typescript.md`](docs/testing-llm-prompts-in-typescript.md)

## Scripts

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm package:check
pnpm audit:ci
pnpm example:basic
pnpm example:compare
pnpm example:vitest
pnpm example:openai
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Releases

No registry release is implied by a source version or changelog entry. Maintainer preflight and the remaining GitHub/npm gates are documented in [`docs/releasing.md`](docs/releasing.md).

## License

MIT
