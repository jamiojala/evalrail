# Getting Started with EvalRail

EvalRail is designed for local TypeScript development loops first, then repeatable LLM evaluation in CI.

## 1. Choose a registry or source workflow

The npm registry is the source of truth for published versions:

```bash
npm view @jamiojala/evalrail version dist.integrity
```

When that command returns a version, install it with:

```bash
pnpm add -D @jamiojala/evalrail vitest
```

For development from the repository, clone the public source and run its checks:

```bash
git clone https://github.com/jamiojala/evalrail.git
cd evalrail
corepack pnpm@10.34.5 install --frozen-lockfile
corepack pnpm@10.34.5 check
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

If you want a fast real-provider setup after clone, use the built-in OpenAI-compatible adapter:

```bash
cp .env.example .env.local
pnpm example:openai
```

See `docs/provider-adapters.md` for details.

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

## 6. Add resource gates when usage is reported

The OpenAI-compatible adapter maps response usage into EvalRail's token metrics. Custom providers can return the same `tokenUsage` shape.

```ts
import { expectMaxTotalTokens } from "@jamiojala/evalrail";

const fixtures = [
  {
    id: "concise-release-note",
    prompt: "Summarize release {{version}} in one sentence",
    variables: { version: "2.0.0" },
    expectations: [expectMaxTotalTokens(120)]
  }
];
```

The expectation fails when total-token usage is missing or exceeds the limit. EvalRail can derive total tokens from reported input and output counts, but it does not guess missing metrics.

For provider migration gates and a complete GitHub Actions example, continue with [`testing-llm-prompts-in-typescript.md`](testing-llm-prompts-in-typescript.md).
