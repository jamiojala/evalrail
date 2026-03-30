# Provider Adapters

EvalRail ships a built-in `createOpenAICompatibleProvider(...)` adapter so users can start with a real provider quickly.

## Clone-and-Run Setup

```bash
cp .env.example .env.local
# fill OPENAI_API_KEY
pnpm install
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

## Security Notes

- Never commit `.env.local`.
- Commit only `.env.example` placeholders.
- In CI, inject keys as encrypted secrets.
