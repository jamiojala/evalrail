import "dotenv/config";
import { join } from "node:path";

import {
  assertRunPassed,
  createOpenAICompatibleProvider,
  formatRunSummary,
  loadFixturesFromFile,
  runEvalSuite,
  type OpenAICompatibleProviderOptions
} from "../src";

const fixtureFile = join(process.cwd(), "examples", "fixtures", "support-fixtures.json");
const fixtures = await loadFixturesFromFile(fixtureFile);

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === "") {
  throw new Error(
    "Missing OPENAI_API_KEY. Copy .env.example to .env.local and set OPENAI_API_KEY before running pnpm example:openai."
  );
}

const providerOptions: OpenAICompatibleProviderOptions = {
  id: process.env.EVALRAIL_PROVIDER_ID ?? "openai",
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  systemPrompt:
    process.env.OPENAI_SYSTEM_PROMPT ??
    "You are a concise, policy-compliant support assistant.",
  temperature: process.env.OPENAI_TEMPERATURE
    ? Number(process.env.OPENAI_TEMPERATURE)
    : 0
};

if (process.env.OPENAI_API_KEY !== undefined) {
  providerOptions.apiKey = process.env.OPENAI_API_KEY;
}

if (process.env.OPENAI_BASE_URL !== undefined) {
  providerOptions.baseUrl = process.env.OPENAI_BASE_URL;
}

const provider = createOpenAICompatibleProvider(providerOptions);

const run = await runEvalSuite({
  suite: process.env.EVALRAIL_SUITE ?? "support-quality-openai",
  fixtures,
  providers: [provider],
  regression: {
    mode: (process.env.EVALRAIL_MODE as "off" | "record" | "assert" | "update-missing") ??
      "off",
    storeDir: process.env.EVALRAIL_STORE_DIR ?? ".evalrail"
  }
});

console.log(formatRunSummary(run));
assertRunPassed(run);
