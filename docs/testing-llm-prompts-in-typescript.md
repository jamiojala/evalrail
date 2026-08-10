# Testing LLM Prompts in TypeScript

This guide builds a local-first LLM evaluation workflow with typed fixtures, prompt regression snapshots, explicit token budgets, provider comparison, and a GitHub Actions gate.

The examples use the package import expected in a consuming project. Verify the current registry version with `npm view @jamiojala/evalrail version`; inside the EvalRail repository, use `../src` as shown in [`examples/vitest-prompt-regression.test.ts`](../examples/vitest-prompt-regression.test.ts).

## What this workflow proves

A useful prompt test should answer more than “did the request return text?” This workflow checks four separate risks:

1. Required behavior still appears in the output.
2. Reviewable output baselines have not drifted unexpectedly.
3. A candidate provider does not lose measured quality or exceed resource limits.
4. Missing measurements fail the gate instead of silently passing.

It does not make an LLM deterministic. It makes the acceptance criteria and observed changes explicit.

## 1. Define a small provider adapter

EvalRail does not require a provider SDK. Implement `PromptProvider` around the API or local model you already use.

```ts
import type { PromptProvider } from "@jamiojala/evalrail";

export const candidate: PromptProvider = {
  id: "candidate",
  async generate(request) {
    const response = await yourModelClient.generate(request.renderedPrompt);

    return {
      output: response.text,
      tokenUsage: {
        inputTokens: response.usage.input,
        outputTokens: response.usage.output,
        totalTokens: response.usage.total
      }
    };
  }
};
```

Do not put API keys in the adapter. Read credentials from the consuming project's environment or use a credential-free mock in pull-request tests.

## 2. Write behavior and resource expectations

```ts
import {
  expectContains,
  expectMaxTotalTokens,
  type PromptFixture
} from "@jamiojala/evalrail";

export const fixtures: PromptFixture[] = [
  {
    id: "refund-window",
    prompt: "State the refund window in one sentence.",
    referenceOutput: "Refunds are available within 14 days.",
    expectations: [
      expectContains("14 days"),
      expectMaxTotalTokens(120)
    ]
  }
];
```

`expectMaxTotalTokens` fails when usage is absent or over budget. If the provider reports both input and output counts but no total, EvalRail derives the total. It does not estimate missing counts or model prices.

## 3. Record and review a prompt regression baseline

Use `record` only when intentionally replacing every baseline. For day-to-day work, `update-missing` creates absent snapshots but checks existing ones.

```ts
import { runEvalSuite } from "@jamiojala/evalrail";

const run = await runEvalSuite({
  suite: "support-policy",
  fixtures,
  providers: [incumbent, candidate],
  regression: {
    mode: "update-missing",
    storeDir: ".evalrail"
  }
});
```

After a maintainer reviews the generated files, CI should use `mode: "assert"`. Commit snapshots only when that matches the consuming repository's data and review policy. Never put secrets or private provider output into a public baseline.

## 4. Gate a model or provider rollout

The convenience comparison ranks observed results. A rollout needs explicit acceptance limits instead of an opaque winner.

```ts
import {
  assertRolloutPassed,
  assertRunPassed,
  evaluateProviderRollout,
  formatProviderRollout
} from "@jamiojala/evalrail";

assertRunPassed(run);

const decision = evaluateProviderRollout(run, {
  baselineProviderId: "incumbent",
  candidateProviderId: "candidate",
  thresholds: {
    maxPassRateDrop: 0,
    minReferenceSimilarityDelta: -0.02,
    maxAverageProviderDurationMultiplier: 1.5,
    maxTotalTokensMultiplier: 1.2
  }
});

console.log(formatProviderRollout(decision));
assertRolloutPassed(decision);
```

Choose thresholds before inspecting a candidate's results. Similarity checks require complete measurements for the intended reference-scored subset. Provider-duration and total-token checks require complete measurements for equal run counts. EvalRail does not decide whether a 20% token increase is worth a quality change; the maintainer owns that tradeoff.

## 5. Run the evaluation from Vitest

Create a test such as `tests/llm-prompt-regression.test.ts`:

```ts
import { describe, it } from "vitest";
import {
  assertRolloutPassed,
  assertRunPassed,
  evaluateProviderRollout,
  runEvalSuite
} from "@jamiojala/evalrail";

describe("support prompt rollout", () => {
  it("keeps the candidate inside agreed gates", async () => {
    const run = await runEvalSuite({
      suite: "support-policy",
      fixtures,
      providers: [incumbent, candidate],
      regression: { mode: "assert", storeDir: ".evalrail" }
    });

    assertRunPassed(run);
    assertRolloutPassed(
      evaluateProviderRollout(run, {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: {
          maxPassRateDrop: 0,
          maxTotalTokensMultiplier: 1.2
        }
      })
    );
  });
});
```

## 6. Add a read-only GitHub Actions gate

This workflow assumes the consuming repository pins pnpm in `packageManager` and keeps the eval test credential-free. Pin action commits according to your own dependency policy.

```yaml
name: LLM prompt regression

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  prompt-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false

      - name: Setup pnpm
        uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10

      - name: Setup Node.js
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run prompt regression gate
        run: pnpm vitest run tests/llm-prompt-regression.test.ts
```

For real-provider evaluations, use a separate protected workflow or environment, minimum credentials, synthetic or approved fixtures, and explicit spend limits. Do not expose provider secrets to untrusted pull-request code.

## What to review when a gate fails

- Read the individual expectation and regression reasons before changing a threshold.
- Confirm the baseline and candidate ran the same fixture set.
- Check token coverage before comparing aggregate totals.
- Inspect whether the prompt, variables, provider settings, or model changed.
- Update a snapshot only after the output change is intentional and safe.

The goal is a reviewable model-change decision, not a green check at any cost.
