import type { TokenUsage, TokenUsageSummary } from "./types";

interface TokenUsageCarrier {
  tokenUsage?: TokenUsage;
}

function isValidTokenCount(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function addTokenCounts(
  current: number | undefined,
  next: number
): number | undefined {
  if (current === undefined) {
    return undefined;
  }

  const total = current + next;
  return Number.isSafeInteger(total) ? total : undefined;
}

export function resolveTotalTokens(
  tokenUsage: TokenUsage
): number | undefined {
  const inputTokens = tokenUsage.inputTokens;
  const outputTokens = tokenUsage.outputTokens;
  const componentTotal =
    isValidTokenCount(inputTokens) && isValidTokenCount(outputTokens)
      ? inputTokens + outputTokens
      : undefined;
  const derivedTotal =
    componentTotal !== undefined && Number.isSafeInteger(componentTotal)
      ? componentTotal
      : undefined;
  const reportedTotal = isValidTokenCount(tokenUsage.totalTokens)
    ? tokenUsage.totalTokens
    : undefined;

  if (reportedTotal !== undefined && derivedTotal !== undefined) {
    return Math.max(reportedTotal, derivedTotal);
  }

  return reportedTotal ?? derivedTotal;
}

export function summarizeTokenUsage(
  values: TokenUsageCarrier[]
): TokenUsageSummary | undefined {
  const reported = values.filter(
    (value): value is { tokenUsage: TokenUsage } => value.tokenUsage !== undefined
  );

  if (reported.length === 0) {
    return undefined;
  }

  let inputTokens: number | undefined = 0;
  let outputTokens: number | undefined = 0;
  let totalTokens: number | undefined = 0;
  let inputTokenRuns = 0;
  let outputTokenRuns = 0;
  let totalTokenRuns = 0;

  for (const { tokenUsage } of reported) {
    if (isValidTokenCount(tokenUsage.inputTokens)) {
      inputTokens = addTokenCounts(inputTokens, tokenUsage.inputTokens);
      inputTokenRuns += 1;
    }

    if (isValidTokenCount(tokenUsage.outputTokens)) {
      outputTokens = addTokenCounts(outputTokens, tokenUsage.outputTokens);
      outputTokenRuns += 1;
    }

    const resolvedTotalTokens = resolveTotalTokens(tokenUsage);
    if (resolvedTotalTokens !== undefined) {
      totalTokens = addTokenCounts(totalTokens, resolvedTotalTokens);
      totalTokenRuns += 1;
    }
  }

  const summary: TokenUsageSummary = {
    measuredRuns: reported.length,
    inputTokenRuns,
    outputTokenRuns,
    totalTokenRuns
  };

  if (inputTokenRuns > 0 && inputTokens !== undefined) {
    summary.inputTokens = inputTokens;
  }

  if (outputTokenRuns > 0 && outputTokens !== undefined) {
    summary.outputTokens = outputTokens;
  }

  if (totalTokenRuns > 0 && totalTokens !== undefined) {
    summary.totalTokens = totalTokens;
  }

  return summary;
}
