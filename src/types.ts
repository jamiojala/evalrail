export type PromptValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: PromptValue };
export type PromptVariables = Record<string, PromptValue>;

export interface PromptFixture {
  id: string;
  prompt: string;
  variables?: PromptVariables;
  referenceOutput?: string;
  expectations?: FixtureExpectation[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PromptRequest {
  fixtureId: string;
  prompt: string;
  renderedPrompt: string;
  variables: PromptVariables;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface PromptResponse {
  output: string;
  metadata?: Record<string, unknown>;
  tokenUsage?: TokenUsage;
}

export interface PromptProvider {
  id: string;
  description?: string;
  generate(request: PromptRequest): Promise<PromptResponse>;
}

export interface RegressionSnapshot {
  fixtureId: string;
  output: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AssertionContext {
  fixture: PromptFixture;
  provider: PromptProvider;
  request: PromptRequest;
  response: PromptResponse;
  baseline?: RegressionSnapshot;
}

export interface FixtureExpectation {
  (context: AssertionContext): void | Promise<void>;
  description?: string;
}

export type RegressionMode = "off" | "record" | "assert" | "update-missing";

export interface RegressionComparatorResult {
  ok: boolean;
  score: number;
  reason: string;
}

export interface RegressionComparatorInput {
  fixture: PromptFixture;
  provider: PromptProvider;
  currentOutput: string;
  baselineOutput: string;
}

export type RegressionComparator = (
  input: RegressionComparatorInput
) => RegressionComparatorResult | Promise<RegressionComparatorResult>;

export interface RegressionConfig {
  mode?: RegressionMode;
  storeDir?: string;
  comparator?: RegressionComparator;
}

export interface ExpectationOutcome {
  name: string;
  passed: boolean;
  error?: string;
}

export type RegressionStatus =
  | "skipped"
  | "recorded"
  | "passed"
  | "failed"
  | "missing-baseline";

export interface RegressionOutcome {
  status: RegressionStatus;
  score?: number;
  reason?: string;
  baselineOutput?: string;
}

export interface FixtureRunResult {
  suite: string;
  fixtureId: string;
  providerId: string;
  renderedPrompt: string;
  output: string;
  durationMs: number;
  passed: boolean;
  expectationOutcomes: ExpectationOutcome[];
  regressionOutcome?: RegressionOutcome;
  referenceSimilarity?: number;
  errors: string[];
}

export interface ProviderSummary {
  providerId: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  averageDurationMs: number;
  averageReferenceSimilarity?: number;
}

export interface EvalTotals {
  total: number;
  passed: number;
  failed: number;
}

export interface EvalRunResult {
  suite: string;
  startedAt: string;
  completedAt: string;
  fixtureResults: FixtureRunResult[];
  providerSummaries: ProviderSummary[];
  totals: EvalTotals;
}

export interface RunEvalSuiteOptions {
  suite: string;
  fixtures: PromptFixture[];
  providers: PromptProvider[];
  regression?: RegressionConfig;
  onFixtureComplete?: (result: FixtureRunResult) => void | Promise<void>;
}
