# EvalRail

`@jamiojala/evalrail` is a serious, local-first TypeScript framework for prompt testing and evaluation.

It is built for teams that ship: fixture-driven prompt tests, regression snapshots committed to your repo, and provider comparisons you can use during model rollouts.

## Why EvalRail

Shipping prompts without tests creates the same risk as shipping code without tests. EvalRail gives teams a workflow that feels familiar:

- Define fixtures as JSON or TypeScript
- Run deterministic checks in Vitest and CI
- Record and assert regression baselines locally
- Compare provider behavior on the same fixture set
- Keep all critical artifacts in your repository

## Features

- Local-first fixture files (`loadFixturesFromFile` / `writeFixtureFile`)
- Template rendering with variables (`{{variable}}` and dot-path support)
- Built-in expectations (`contains`, `notContains`, `matches`, `minLength`, `referenceSimilarity`)
- Regression modes (`record`, `assert`, `update-missing`, `off`)
- File-based snapshot store (`.evalrail/<suite>/<provider>.snapshots.json`)
- Provider comparison ranking with pass rate, latency, and reference similarity
- Vitest-friendly API (`runEvalSuite`, `assertRunPassed`)

## Open Source Safety

This repository is intentionally safe for open source collaboration:

- No API keys, tokens, or provider credentials are stored in the repo.
- Examples and tests use local/mock providers only.
- Real provider integrations belong in each team's private runtime code or environment configuration.

## Real Provider Quickstart (After Clone)

You can still run against a real provider quickly without committing secrets.

```bash
cp .env.example .env.local
# edit .env.local with your OPENAI_API_KEY
pnpm install
pnpm example:openai
```

This uses `createOpenAICompatibleProvider(...)` and reads values from `.env.local`.

## Install

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

## Regression Modes

- `record`: overwrite snapshots for every fixture
- `assert`: fail if snapshots are missing or output drifts
- `update-missing`: create snapshots only when absent; assert existing ones
- `off`: disable regression checks

## Provider Comparison

Use the same fixture set across providers and rank outputs:

```ts
import {
  runEvalSuite,
  buildProviderComparison,
  formatProviderComparison
} from "@jamiojala/evalrail";

const run = await runEvalSuite({
  suite: "provider-rollout",
  fixtures,
  providers: [providerA, providerB]
});

const comparison = buildProviderComparison(run);
console.log(formatProviderComparison(comparison));
```

## Vitest Integration

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

## Scripts

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm example:basic
pnpm example:compare
pnpm example:openai
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Release Setup Notes

If release PR creation fails with:

`GitHub Actions is not permitted to create or approve pull requests`

enable this repository setting:

- `Settings` -> `Actions` -> `General` -> `Workflow permissions` ->
  `Allow GitHub Actions to create and approve pull requests`

If your org policy still blocks this, create a fine-grained PAT with repository
write access and store it as `CHANGESETS_GITHUB_TOKEN` for the release workflow.

## License

MIT
