# Getting Started

EvalRail is designed for local development loops first, then CI.

## 1. Install

```bash
pnpm add -D @jamiojala/evalrail vitest
```

## 2. Define Fixtures

You can define fixtures in TypeScript or JSON.

TypeScript fixture:

```ts
import { expectContains, type PromptFixture } from "@jamiojala/evalrail";

export const fixtures: PromptFixture[] = [
  {
    id: "release-summary",
    prompt: "Summarize release {{version}}",
    variables: { version: "2.0.0" },
    expectations: [expectContains("2.0.0")]
  }
];
```

JSON fixture file:

```json
{
  "fixtures": [
    {
      "id": "release-summary",
      "prompt": "Summarize release {{version}}",
      "variables": { "version": "2.0.0" },
      "contains": ["2.0.0"]
    }
  ]
}
```

## 3. Add Provider Adapter

EvalRail does not force provider SDK choices. You provide a `generate` function.
In open source repositories, keep this adapter credential-free and use mock/local behavior by default.

```ts
import type { PromptProvider } from "@jamiojala/evalrail";

export const provider: PromptProvider = {
  id: "my-provider",
  async generate(request) {
    // In private project code, call your model/provider SDK here.
    // Do not commit API keys or secrets to source control.
    return { output: `Generated: ${request.renderedPrompt}` };
  }
};
```

## 4. Run Suite

```ts
import {
  runEvalSuite,
  formatRunSummary,
  assertRunPassed
} from "@jamiojala/evalrail";

const run = await runEvalSuite({
  suite: "release-checks",
  fixtures,
  providers: [provider],
  regression: {
    mode: "update-missing",
    storeDir: ".evalrail"
  }
});

console.log(formatRunSummary(run));
assertRunPassed(run);
```

## 5. Use in Vitest

```ts
import { describe, it } from "vitest";
import { runEvalSuite, assertRunPassed } from "@jamiojala/evalrail";

describe("prompt suite", () => {
  it("matches expected behavior", async () => {
    const run = await runEvalSuite({
      suite: "release-checks",
      fixtures,
      providers: [provider],
      regression: { mode: "assert", storeDir: ".evalrail" }
    });

    assertRunPassed(run);
  });
});
```
