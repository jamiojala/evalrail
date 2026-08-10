import type {
  EvalRunResult,
  FixtureRunResult,
  ProviderSummary,
  TokenUsageSummary
} from "./types";
import { summarizeTokenUsage } from "./token-usage";
import { mean } from "./utils";

export interface ProviderComparisonRow {
  providerId: string;
  totalRuns: number;
  failedRuns: number;
  passRate: number;
  averageDurationMs: number;
  providerDurationRuns: number;
  averageProviderDurationMs?: number;
  referenceSimilarityExpectedRuns: number;
  referenceSimilarityRuns: number;
  averageReferenceSimilarity?: number;
  tokenUsage?: TokenUsageSummary;
  expectationFailures: number;
  regressionFailures: number;
}

export interface ProviderComparisonResult {
  rows: ProviderComparisonRow[];
  winner?: ProviderComparisonRow;
}

export interface ProviderRolloutThresholds {
  maxPassRateDrop?: number;
  minReferenceSimilarityDelta?: number;
  maxAverageProviderDurationMultiplier?: number;
  maxTotalTokensMultiplier?: number;
}

export interface ProviderRolloutOptions {
  baselineProviderId: string;
  candidateProviderId: string;
  thresholds: ProviderRolloutThresholds;
}

export type ProviderRolloutMetric =
  | "pass-rate"
  | "reference-similarity"
  | "average-provider-duration"
  | "total-tokens";

export interface ProviderRolloutCheck {
  metric: ProviderRolloutMetric;
  passed: boolean;
  baselineValue: number | null;
  candidateValue: number | null;
  thresholdValue: number;
  reason: string;
}

export interface ProviderRolloutDecision {
  baselineProviderId: string;
  candidateProviderId: string;
  passed: boolean;
  checks: ProviderRolloutCheck[];
}

const providerRolloutThresholdNames = [
  "maxPassRateDrop",
  "minReferenceSimilarityDelta",
  "maxAverageProviderDurationMultiplier",
  "maxTotalTokensMultiplier"
] as const satisfies readonly (keyof ProviderRolloutThresholds)[];

function compareProviderRows(
  left: ProviderComparisonRow,
  right: ProviderComparisonRow
): number {
  if (left.passRate !== right.passRate) {
    return right.passRate - left.passRate;
  }

  const leftHasSimilarity = left.averageReferenceSimilarity !== undefined;
  const rightHasSimilarity = right.averageReferenceSimilarity !== undefined;
  if (leftHasSimilarity !== rightHasSimilarity) {
    return leftHasSimilarity ? -1 : 1;
  }

  if (
    left.averageReferenceSimilarity !== undefined &&
    right.averageReferenceSimilarity !== undefined &&
    left.averageReferenceSimilarity !== right.averageReferenceSimilarity
  ) {
    return right.averageReferenceSimilarity - left.averageReferenceSimilarity;
  }

  const leftHasProviderDuration = left.averageProviderDurationMs !== undefined;
  const rightHasProviderDuration = right.averageProviderDurationMs !== undefined;
  if (leftHasProviderDuration !== rightHasProviderDuration) {
    return leftHasProviderDuration ? -1 : 1;
  }

  if (
    left.averageProviderDurationMs !== undefined &&
    right.averageProviderDurationMs !== undefined &&
    left.averageProviderDurationMs !== right.averageProviderDurationMs
  ) {
    return left.averageProviderDurationMs - right.averageProviderDurationMs;
  }

  return left.providerId.localeCompare(right.providerId);
}

function summarizeProvider(
  providerId: string,
  fixtureResults: FixtureRunResult[]
): ProviderComparisonRow {
  const totalRuns = fixtureResults.length;
  const failedRuns = fixtureResults.filter((result) => !result.passed).length;
  const expectationFailures = fixtureResults.reduce((count, result) => {
    return (
      count +
      result.expectationOutcomes.filter((expectation) => !expectation.passed).length
    );
  }, 0);

  const regressionFailures = fixtureResults.filter(
    (result) => result.regressionOutcome?.status === "failed"
  ).length;

  const referenceSimilarities = fixtureResults
    .map((result) => result.referenceSimilarity)
    .filter((value): value is number => typeof value === "number");
  const providerDurations = fixtureResults
    .map((result) => result.providerDurationMs)
    .filter((value): value is number => typeof value === "number");
  const referenceSimilarityExpectedRuns = fixtureResults.filter(
    (result) => result.referenceSimilarityExpected
  ).length;

  const row: ProviderComparisonRow = {
    providerId,
    totalRuns,
    failedRuns,
    passRate: totalRuns === 0 ? 0 : (totalRuns - failedRuns) / totalRuns,
    averageDurationMs: mean(fixtureResults.map((result) => result.durationMs)),
    providerDurationRuns: providerDurations.length,
    referenceSimilarityExpectedRuns,
    referenceSimilarityRuns: referenceSimilarities.length,
    expectationFailures,
    regressionFailures
  };

  if (referenceSimilarities.length > 0) {
    row.averageReferenceSimilarity = mean(referenceSimilarities);
  }

  if (providerDurations.length > 0) {
    row.averageProviderDurationMs = mean(providerDurations);
  }

  const tokenUsage = summarizeTokenUsage(fixtureResults);
  if (tokenUsage !== undefined) {
    row.tokenUsage = tokenUsage;
  }

  return row;
}

export function buildProviderComparison(
  run: EvalRunResult
): ProviderComparisonResult {
  const byProvider = new Map<string, FixtureRunResult[]>();

  for (const result of run.fixtureResults) {
    const existing = byProvider.get(result.providerId);

    if (existing) {
      existing.push(result);
      continue;
    }

    byProvider.set(result.providerId, [result]);
  }

  const rows = [...byProvider.entries()]
    .map(([providerId, results]) => summarizeProvider(providerId, results))
    .sort(compareProviderRows);

  const comparison: ProviderComparisonResult = { rows };

  if (rows[0]) {
    comparison.winner = rows[0];
  }

  return comparison;
}

function requireProviderSummary(
  run: EvalRunResult,
  providerId: string
): ProviderSummary {
  const summary = run.providerSummaries.find(
    (candidate) => candidate.providerId === providerId
  );

  if (!summary) {
    throw new Error(`Provider summary not found: ${providerId}`);
  }

  return summary;
}

function assertThreshold(
  value: number,
  name: string,
  options: { minimum: number; maximum?: number; exclusiveMinimum?: boolean }
): void {
  const aboveMinimum = options.exclusiveMinimum
    ? value > options.minimum
    : value >= options.minimum;
  const belowMaximum =
    options.maximum === undefined || value <= options.maximum;

  if (!Number.isFinite(value) || !aboveMinimum || !belowMaximum) {
    const lowerBound = options.exclusiveMinimum ? ">" : ">=";
    const upperBound =
      options.maximum === undefined ? "" : ` and <= ${options.maximum}`;
    throw new Error(
      `${name} must be finite, ${lowerBound} ${options.minimum}${upperBound}`
    );
  }
}

function tokenCoverageIsComplete(summary: ProviderSummary): boolean {
  return (
    summary.tokenUsage?.totalTokens !== undefined &&
    summary.tokenUsage.totalTokenRuns === summary.total
  );
}

function similarityCoverageIsComplete(summary: ProviderSummary): boolean {
  return (
    summary.referenceSimilarityExpectedRuns > 0 &&
    summary.averageReferenceSimilarity !== undefined &&
    summary.referenceSimilarityRuns === summary.referenceSimilarityExpectedRuns
  );
}

function providerDurationCoverageIsComplete(summary: ProviderSummary): boolean {
  return (
    summary.averageProviderDurationMs !== undefined &&
    summary.providerDurationRuns === summary.total
  );
}

export function evaluateProviderRollout(
  run: EvalRunResult,
  options: ProviderRolloutOptions
): ProviderRolloutDecision {
  if (options.baselineProviderId === options.candidateProviderId) {
    throw new Error("Baseline and candidate provider ids must be different");
  }

  for (const thresholdName of Object.keys(options.thresholds)) {
    if (
      !providerRolloutThresholdNames.includes(
        thresholdName as keyof ProviderRolloutThresholds
      )
    ) {
      throw new Error(`Unknown provider rollout threshold: ${thresholdName}`);
    }
  }

  const thresholdCount = providerRolloutThresholdNames.filter(
    (thresholdName) => options.thresholds[thresholdName] !== undefined
  ).length;
  if (thresholdCount === 0) {
    throw new Error("Provider rollout requires at least one threshold");
  }

  const baseline = requireProviderSummary(run, options.baselineProviderId);
  const candidate = requireProviderSummary(run, options.candidateProviderId);
  if (baseline.total === 0 || candidate.total === 0) {
    throw new Error(
      "Provider rollout requires at least one evaluated fixture for both providers"
    );
  }
  const checks: ProviderRolloutCheck[] = [];

  const { maxPassRateDrop } = options.thresholds;
  if (maxPassRateDrop !== undefined) {
    assertThreshold(maxPassRateDrop, "maxPassRateDrop", {
      minimum: 0,
      maximum: 1
    });
    const delta = candidate.passRate - baseline.passRate;
    const passed = delta >= -maxPassRateDrop;
    checks.push({
      metric: "pass-rate",
      passed,
      baselineValue: baseline.passRate,
      candidateValue: candidate.passRate,
      thresholdValue: maxPassRateDrop,
      reason: passed
        ? `Candidate pass rate drop ${Math.max(0, -delta).toFixed(3)} is within ${maxPassRateDrop.toFixed(3)}`
        : `Candidate pass rate drop ${Math.max(0, -delta).toFixed(3)} exceeds ${maxPassRateDrop.toFixed(3)}`
    });
  }

  const { minReferenceSimilarityDelta } = options.thresholds;
  if (minReferenceSimilarityDelta !== undefined) {
    assertThreshold(
      minReferenceSimilarityDelta,
      "minReferenceSimilarityDelta",
      { minimum: -1, maximum: 1 }
    );
    const baselineValue = similarityCoverageIsComplete(baseline)
      ? (baseline.averageReferenceSimilarity ?? null)
      : null;
    const candidateValue = similarityCoverageIsComplete(candidate)
      ? (candidate.averageReferenceSimilarity ?? null)
      : null;
    const hasValues =
      baselineValue !== null &&
      candidateValue !== null &&
      baseline.referenceSimilarityExpectedRuns ===
        candidate.referenceSimilarityExpectedRuns;
    const delta = hasValues ? candidateValue - baselineValue : null;
    const passed = delta !== null && delta >= minReferenceSimilarityDelta;
    checks.push({
      metric: "reference-similarity",
      passed,
      baselineValue,
      candidateValue,
      thresholdValue: minReferenceSimilarityDelta,
      reason:
        delta === null
          ? "Complete reference-similarity coverage for matching expected reference subsets is unavailable for the baseline or candidate"
          : passed
            ? `Candidate similarity delta ${delta.toFixed(3)} meets ${minReferenceSimilarityDelta.toFixed(3)}`
            : `Candidate similarity delta ${delta.toFixed(3)} is below ${minReferenceSimilarityDelta.toFixed(3)}`
    });
  }

  const { maxAverageProviderDurationMultiplier } = options.thresholds;
  if (maxAverageProviderDurationMultiplier !== undefined) {
    assertThreshold(
      maxAverageProviderDurationMultiplier,
      "maxAverageProviderDurationMultiplier",
      { minimum: 0, exclusiveMinimum: true }
    );
    const baselineValue = providerDurationCoverageIsComplete(baseline)
      ? (baseline.averageProviderDurationMs ?? null)
      : null;
    const candidateValue = providerDurationCoverageIsComplete(candidate)
      ? (candidate.averageProviderDurationMs ?? null)
      : null;
    const hasValues =
      baselineValue !== null &&
      candidateValue !== null &&
      baseline.total === candidate.total;
    const durationLimit =
      hasValues && baselineValue > 0
        ? baselineValue * maxAverageProviderDurationMultiplier
        : null;
    const passed =
      durationLimit !== null &&
      candidateValue !== null &&
      candidateValue <= durationLimit;
    checks.push({
      metric: "average-provider-duration",
      passed,
      baselineValue,
      candidateValue,
      thresholdValue: maxAverageProviderDurationMultiplier,
      reason:
        !hasValues
          ? "Complete provider-duration coverage for equal run counts is unavailable for the baseline or candidate"
          : baselineValue <= 0
            ? "Baseline average provider duration must be greater than zero"
            : passed
              ? `Candidate average provider duration ${candidateValue.toFixed(3)}ms is within ${maxAverageProviderDurationMultiplier.toFixed(3)}x baseline`
              : `Candidate average provider duration ${candidateValue.toFixed(3)}ms exceeds ${maxAverageProviderDurationMultiplier.toFixed(3)}x baseline`
    });
  }

  const { maxTotalTokensMultiplier } = options.thresholds;
  if (maxTotalTokensMultiplier !== undefined) {
    assertThreshold(maxTotalTokensMultiplier, "maxTotalTokensMultiplier", {
      minimum: 0,
      exclusiveMinimum: true
    });
    const baselineValue = tokenCoverageIsComplete(baseline)
      ? (baseline.tokenUsage?.totalTokens ?? null)
      : null;
    const candidateValue = tokenCoverageIsComplete(candidate)
      ? (candidate.tokenUsage?.totalTokens ?? null)
      : null;
    const hasValues =
      baselineValue !== null &&
      candidateValue !== null &&
      baseline.total === candidate.total;
    const tokenLimit = hasValues
      ? baselineValue * maxTotalTokensMultiplier
      : null;
    const passed =
      tokenLimit !== null && candidateValue !== null && candidateValue <= tokenLimit;
    checks.push({
      metric: "total-tokens",
      passed,
      baselineValue,
      candidateValue,
      thresholdValue: maxTotalTokensMultiplier,
      reason:
        tokenLimit === null || candidateValue === null
          ? "Complete total-token coverage for equal run counts is unavailable for the baseline or candidate"
          : passed
            ? `Candidate total tokens ${candidateValue} are within ${maxTotalTokensMultiplier.toFixed(3)}x baseline`
            : `Candidate total tokens ${candidateValue} exceed ${maxTotalTokensMultiplier.toFixed(3)}x baseline`
    });
  }

  if (checks.length === 0) {
    throw new Error("Provider rollout produced no checks");
  }

  return {
    baselineProviderId: options.baselineProviderId,
    candidateProviderId: options.candidateProviderId,
    passed: checks.every((check) => check.passed),
    checks
  };
}
