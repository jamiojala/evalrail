# Provider Adapters

EvalRail ships a built-in `createOpenAICompatibleProvider(...)` adapter for OpenAI-compatible chat-completions endpoints. Other providers implement the small `PromptProvider` interface.

## Clone-and-Run Setup

```bash
cp .env.example .env.local
# fill OPENAI_API_KEY
corepack pnpm@10.34.5 install --frozen-lockfile
pnpm example:openai
```

## Environment Variables

- `OPENAI_API_KEY` required
- `OPENAI_MODEL` optional, default `gpt-4o-mini`
- `OPENAI_BASE_URL` optional, default `https://api.openai.com`
- `OPENAI_SYSTEM_PROMPT` optional
- `OPENAI_TEMPERATURE` optional, default `0`
- `EVALRAIL_MODE` optional (`off`, `record`, `assert`, `update-missing`)

## Programmatic Usage

```ts
import {
  createOpenAICompatibleProvider,
  runEvalSuite,
  type PromptFixture
} from "@jamiojala/evalrail";

const fixtures: PromptFixture[] = [
  {
    id: "status",
    prompt: "Summarize release {{version}}",
    variables: { version: "1.0.0" }
  }
];

const provider = createOpenAICompatibleProvider({
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
  temperature: 0
});

const run = await runEvalSuite({
  suite: "real-provider-smoke",
  fixtures,
  providers: [provider]
});
```

When the endpoint returns `prompt_tokens`, `completion_tokens`, or `total_tokens`, the adapter maps them to EvalRail's `tokenUsage`. Run results and provider summaries preserve valid non-negative integer counts for fixture budgets and rollout gates. If a reported total is lower than valid input plus output counts, EvalRail uses the larger value to avoid approving an undercount. No currency cost is inferred.

## Security Notes

- Never commit `.env.local`.
- Commit only `.env.example` placeholders.
- In CI, inject keys as encrypted secrets.
- Treat prompts and provider responses according to the configured endpoint's data policy.
- Prefer credential-free mock providers for untrusted pull-request workflows.
