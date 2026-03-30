# Provider Comparison

EvalRail can evaluate multiple providers using identical fixtures and summarize relative performance.

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
- `averageDurationMs`
- `averageReferenceSimilarity` (when fixtures include `referenceOutput`)
- `expectationFailures`
- `regressionFailures`

Current ranking prioritizes pass rate, then quality similarity, then latency.

## Rollout Strategy

Suggested rollout sequence:

1. Record baselines for the incumbent provider.
2. Add challenger providers with the same fixture set.
3. Run comparison in CI for every PR.
4. Inspect failures and drift details before promotion.
5. Promote challenger provider once pass rate and quality hold.

## Tips

- Keep fixture IDs stable over time.
- Use tagged fixture subsets for domain-specific checks.
- Avoid overfitting by mixing strict and flexible expectations.
