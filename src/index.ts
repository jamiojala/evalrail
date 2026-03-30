export {
  expectContains,
  expectMatches,
  expectMinLength,
  expectNotContains,
  expectReferenceSimilarity,
  customExpectation
} from "./expectations";

export {
  defineFixtures,
  loadFixturesFromFile,
  writeFixtureFile
} from "./fixtures";

export { buildProviderComparison } from "./comparison";

export {
  hasFailures,
  assertRunPassed,
  formatRunSummary,
  formatProviderComparison
} from "./reporter";

export { runEvalSuite } from "./runner";

export {
  FileRegressionStore,
  defaultRegressionComparator
} from "./regression";

export { createOpenAICompatibleProvider } from "./providers/openai-compatible";

export { renderPromptTemplate } from "./template";

export type {
  AssertionContext,
  EvalRunResult,
  EvalTotals,
  ExpectationOutcome,
  FixtureExpectation,
  FixtureRunResult,
  PromptFixture,
  PromptProvider,
  PromptRequest,
  PromptResponse,
  PromptValue,
  PromptVariables,
  RegressionComparator,
  RegressionComparatorInput,
  RegressionComparatorResult,
  RegressionConfig,
  RegressionMode,
  RegressionOutcome,
  RegressionSnapshot,
  RegressionStatus,
  RunEvalSuiteOptions,
  TokenUsage
} from "./types";

export type { OpenAICompatibleProviderOptions } from "./providers/openai-compatible";

export type {
  ProviderComparisonResult,
  ProviderComparisonRow
} from "./comparison";

export type {
  FixtureFile,
  SerializedPromptFixture
} from "./fixtures";
