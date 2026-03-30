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
