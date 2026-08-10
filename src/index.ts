export {
  expectContains,
  expectMatches,
  expectMaxTotalTokens,
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

export {
  buildProviderComparison,
  evaluateProviderRollout
} from "./comparison";

export {
  hasFailures,
  assertRunPassed,
  formatRunSummary,
  formatProviderComparison,
  formatProviderRollout,
  assertRolloutPassed
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
  ProviderSummary,
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
  TokenUsage,
  TokenUsageSummary
} from "./types";

export type { OpenAICompatibleProviderOptions } from "./providers/openai-compatible";

export type {
  ProviderComparisonResult,
  ProviderComparisonRow,
  ProviderRolloutCheck,
  ProviderRolloutDecision,
  ProviderRolloutMetric,
  ProviderRolloutOptions,
  ProviderRolloutThresholds
} from "./comparison";

export type {
  FixtureFile,
  SerializedPromptFixture
} from "./fixtures";
