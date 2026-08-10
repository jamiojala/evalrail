# LLM Provider Comparison and Rollout Gates

EvalRail can evaluate multiple providers using identical fixtures, summarize their measured behavior, and make a baseline-to-candidate rollout decision from explicit thresholds.

For this open source package, examples stay local/mock. Teams can plug in real provider adapters in their own private runtime code.

## Run Multiple Providers

```ts
const run = await runEvalSuite({
  suite: "provider-rollout",
  fixtures,
  providers: [providerA, providerB, providerC]
});
```

## Build Comparison

```ts
import { buildProviderComparison, formatProviderComparison } from "@jamiojala/evalrail";

const comparison = buildProviderComparison(run);
console.log(formatProviderComparison(comparison));
```

## Ranking Signals

Each provider row includes:

- `passRate`
- `averageDurationMs` for the complete fixture evaluation
- `averageProviderDurationMs` and `providerDurationRuns` for measured provider calls
- `averageReferenceSimilarity` (when fixtures include `referenceOutput`)
- `referenceSimilarityExpectedRuns` and `referenceSimilarityRuns` so coverage is visible
- `expectationFailures`
- `regressionFailures`
- aggregated input, output, and total tokens when providers report usage

The convenience ranking orders providers by pass rate, then available reference similarity, then measured provider-call duration. Do not use the ranking alone as a production migration decision: the ordering is intentionally generic and cannot know your quality, latency, or resource budget.

## Make the rollout decision explicit

```ts
import {
  assertRolloutPassed,
  evaluateProviderRollout,
  formatProviderRollout
} from "@jamiojala/evalrail";

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

Threshold semantics:

- `maxPassRateDrop`: maximum allowed candidate pass-rate loss, from `0` to `1`.
- `minReferenceSimilarityDelta`: minimum candidate-minus-baseline change, from `-1` to `1`.
- `maxAverageProviderDurationMultiplier`: maximum candidate average provider-call duration relative to the baseline.
- `maxTotalTokensMultiplier`: maximum candidate aggregate tokens relative to the baseline.

At least one recognized threshold is required and unknown keys are rejected. The similarity check requires complete measurements for the intended `referenceOutput` subset on both providers. The provider-duration and token checks require complete coverage for equal run counts, and duration comparison also requires a baseline greater than zero. EvalRail derives a token total when both input and output counts are present, conservatively keeps the larger value when a reported total disagrees, and never invents missing measurements.

`assertRolloutPassed` throws with the same human-readable check report that `formatProviderRollout` returns. This makes the decision usable as a CI gate while keeping its evidence visible in logs.

## Rollout Strategy

Suggested rollout sequence:

1. Record baselines for the incumbent provider.
2. Add challenger providers with the same fixture set.
3. Set explicit quality and resource thresholds before looking at results.
4. Run the comparison and rollout decision in CI.
5. Inspect every failed gate and regression before promotion.
6. Promote the candidate only after the configured decision passes and a maintainer reviews the evidence.

## Tips

- Keep fixture IDs stable over time.
- Use tagged fixture subsets for domain-specific checks.
- Avoid overfitting by mixing strict and flexible expectations.
- Treat token usage as a resource signal, not a currency estimate.
- Keep caller-owned model prices outside EvalRail so stale price tables cannot silently approve a rollout.
