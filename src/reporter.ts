import type { EvalRunResult, FixtureRunResult } from "./types";
import type { ProviderComparisonResult } from "./comparison";

function toPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatFailure(result: FixtureRunResult): string {
  const reasons = [
    ...result.errors,
    ...result.expectationOutcomes
      .filter((expectation) => !expectation.passed)
      .map((expectation) => expectation.error ?? `${expectation.name} failed`)
  ];

  if (result.regressionOutcome?.status === "failed") {
    reasons.push(result.regressionOutcome.reason ?? "Regression drift detected");
  }

  if (result.regressionOutcome?.status === "missing-baseline") {
    reasons.push("Missing baseline snapshot");
  }

  const joinedReasons = reasons.length > 0 ? reasons.join(" | ") : "Unknown failure";

  return `- ${result.providerId}:${result.fixtureId} -> ${joinedReasons}`;
}

export function hasFailures(run: EvalRunResult): boolean {
  return run.totals.failed > 0;
}

export function assertRunPassed(run: EvalRunResult): void {
  const failures = run.fixtureResults.filter((result) => !result.passed);

  if (failures.length === 0) {
    return;
  }

  const details = failures.map((failure) => formatFailure(failure)).join("\n");
  throw new Error(
    `Eval suite \"${run.suite}\" failed with ${failures.length} failing checks\n${details}`
  );
}

export function formatRunSummary(run: EvalRunResult): string {
  const lines: string[] = [];
  lines.push(`EvalRail Suite: ${run.suite}`);
  lines.push(`Started: ${run.startedAt}`);
  lines.push(`Completed: ${run.completedAt}`);
  lines.push(`Results: ${run.totals.passed}/${run.totals.total} passed`);
  lines.push("");
  lines.push("Provider summary:");

  for (const summary of run.providerSummaries) {
    const similarity =
      typeof summary.averageReferenceSimilarity === "number"
        ? ` similarity=${summary.averageReferenceSimilarity.toFixed(3)}`
        : "";

    lines.push(
      `- ${summary.providerId}: ${summary.passed}/${summary.total} passed (${toPercent(summary.passRate)}), avg latency=${summary.averageDurationMs.toFixed(1)}ms${similarity}`
    );
  }

  const failures = run.fixtureResults.filter((result) => !result.passed);

  if (failures.length > 0) {
    lines.push("");
    lines.push("Failures:");
    for (const failure of failures) {
      lines.push(formatFailure(failure));
    }
  }

  return lines.join("\n");
}

export function formatProviderComparison(
  comparison: ProviderComparisonResult
): string {
  if (comparison.rows.length === 0) {
    return "No provider data available";
  }

  const lines: string[] = ["Provider comparison:"];

  comparison.rows.forEach((row, index) => {
    const crown = index === 0 ? "(winner) " : "";
    const similarity =
      typeof row.averageReferenceSimilarity === "number"
        ? row.averageReferenceSimilarity.toFixed(3)
        : "n/a";

    lines.push(
      `- ${crown}${row.providerId}: pass=${toPercent(row.passRate)}, latency=${row.averageDurationMs.toFixed(1)}ms, similarity=${similarity}, expectationFailures=${row.expectationFailures}, regressionFailures=${row.regressionFailures}`
    );
  });

  return lines.join("\n");
}
