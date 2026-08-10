# Fixtures and Regression

EvalRail is fixture-first and stores regression baselines in local files.

## Fixture Fields

Core fixture fields:

- `id`: stable unique fixture name
- `prompt`: prompt template (supports `{{variable}}` and `{{nested.value}}`)
- `variables`: template values
- `referenceOutput`: optional canonical answer for similarity scoring
- `expectations`: TypeScript expectations

JSON-only shortcuts (`loadFixturesFromFile` compiles these):

- `contains: string[]`
- `notContains: string[]`
- `matches: string[]` (regex source)
- `minLength: number`
- `maxTotalTokens: number` (fails closed when the provider reports no usable total)
- `minReferenceSimilarity: number`

## Snapshot Location

Snapshots are written to:

```txt
<storeDir>/<suite>/<provider>.snapshots.json
```

Example:

```txt
.evalrail/support-quality/local-template-provider.snapshots.json
```

## Regression Modes

### `record`

Always writes current output to snapshots. Use when intentionally resetting baselines.

### `assert`

Requires existing snapshots and fails on drift.

### `update-missing`

Creates snapshots only for missing fixture/provider pairs and asserts existing snapshots.

### `off`

No snapshot reads or writes.

## Drift Detection

Default drift comparator:

- Normalizes whitespace
- Requires exact normalized match
- Reports Jaccard similarity in failure details

You can replace it via `regression.comparator`.

```ts
const run = await runEvalSuite({
  suite: "support",
  fixtures,
  providers,
  regression: {
    mode: "assert",
    storeDir: ".evalrail",
    comparator: ({ currentOutput, baselineOutput }) => ({
      ok: currentOutput.includes("SAFE") && baselineOutput.includes("SAFE"),
      score: 1,
      reason: "Custom policy comparator"
    })
  }
});
```

## Token budgets alongside regression baselines

Output drift and token growth are separate failure modes. A response can preserve the expected text while becoming materially larger. Add `maxTotalTokens` to a JSON fixture or `expectMaxTotalTokens(...)` to a TypeScript fixture when the provider reports usage.

```json
{
  "fixtures": [
    {
      "id": "concise-support-answer",
      "prompt": "Answer {{question}} in one sentence",
      "variables": { "question": "How do I reset access?" },
      "contains": ["reset"],
      "maxTotalTokens": 120
    }
  ]
}
```

EvalRail stores usage in the run result, not in regression snapshots. Counts must be non-negative safe integers. If a provider reports both components and a lower total, EvalRail uses the component sum so a budget cannot pass on an undercount. It does not estimate provider pricing or treat token count as a quality score.
