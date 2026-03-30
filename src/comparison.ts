import type { EvalRunResult, FixtureRunResult } from "./types";
import { mean } from "./utils";

export interface ProviderComparisonRow {
  providerId: string;
  totalRuns: number;
  failedRuns: number;
  passRate: number;
  averageDurationMs: number;
  averageReferenceSimilarity?: number;
  expectationFailures: number;
  regressionFailures: number;
}

export interface ProviderComparisonResult {
  rows: ProviderComparisonRow[];
  winner?: ProviderComparisonRow;
}

function getComparisonSortScore(row: ProviderComparisonRow): number {
  const similarity = row.averageReferenceSimilarity ?? 0;
  return row.passRate * 1000 + similarity * 10 - row.averageDurationMs * 0.001;
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

  const row: ProviderComparisonRow = {
    providerId,
    totalRuns,
    failedRuns,
    passRate: totalRuns === 0 ? 0 : (totalRuns - failedRuns) / totalRuns,
    averageDurationMs: mean(fixtureResults.map((result) => result.durationMs)),
    expectationFailures,
    regressionFailures
  };

  if (referenceSimilarities.length > 0) {
    row.averageReferenceSimilarity = mean(referenceSimilarities);
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
    .sort((left, right) => getComparisonSortScore(right) - getComparisonSortScore(left));

  const comparison: ProviderComparisonResult = { rows };

  if (rows[0]) {
    comparison.winner = rows[0];
  }

  return comparison;
}
