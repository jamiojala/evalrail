import { join } from "node:path";

import {
  assertRunPassed,
  formatRunSummary,
  loadFixturesFromFile,
  runEvalSuite,
  type PromptProvider
} from "../src";

const fixtureFile = join(process.cwd(), "examples", "fixtures", "support-fixtures.json");
const regressionMode = (process.env.EVALRAIL_MODE ?? "update-missing") as
  | "record"
  | "assert"
  | "update-missing"
  | "off";

const provider: PromptProvider = {
  id: "local-template-provider",
  async generate(request) {
    return {
      output: `Status update: ${request.renderedPrompt}. We have validated the issue, shared current status, and outlined the next support action.`
    };
  }
};

const fixtures = await loadFixturesFromFile(fixtureFile);

const run = await runEvalSuite({
  suite: "support-quality",
  fixtures,
  providers: [provider],
  regression: {
    mode: regressionMode,
    storeDir: ".evalrail"
  }
});

console.log(formatRunSummary(run));
assertRunPassed(run);
