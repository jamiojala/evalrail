import { describe, expect, it } from "vitest";

import {
  buildProviderComparison,
  assertRolloutPassed,
  evaluateProviderRollout,
  expectContains,
  formatProviderComparison,
  formatProviderRollout,
  runEvalSuite
} from "../src";
import type { EvalRunResult, ProviderSummary } from "../src";
import type { ProviderRolloutThresholds } from "../src";
import { createProvider } from "./helpers";

describe("provider comparison", () => {
  it("ranks providers by pass rate and quality", async () => {
    const fixtures = [
      {
        id: "ops-update",
        prompt: "Summarize ops incident",
        referenceOutput: "Incident resolved after rollback",
        expectations: [expectContains("resolved")]
      },
      {
        id: "support-update",
        prompt: "Write support status",
        referenceOutput: "Support backlog is healthy",
        expectations: [expectContains("Support")]
      }
    ];

    const reliable = createProvider("reliable", (request) => {
      if (request.fixtureId === "ops-update") {
        return "Incident resolved after rollback and monitoring checks.";
      }

      return "Support backlog is healthy and response times are stable.";
    });

    const weak = createProvider("weak", (request) => {
      if (request.fixtureId === "ops-update") {
        return "No update";
      }

      return "backlog looks okay";
    });

    const run = await runEvalSuite({
      suite: "compare-suite",
      fixtures,
      providers: [reliable, weak]
    });

    const comparison = buildProviderComparison(run);

    expect(comparison.rows[0]?.providerId).toBe("reliable");
    expect(comparison.rows[1]?.providerId).toBe("weak");
    expect(formatProviderComparison(comparison)).toContain("winner");
  });

  it("includes reported token usage in provider comparison rows", async () => {
    const run = await runEvalSuite({
      suite: "token-comparison",
      fixtures: [{ id: "token-case", prompt: "Answer briefly" }],
      providers: [
        {
          id: "metered",
          async generate() {
            return {
              output: "Brief answer",
              tokenUsage: { inputTokens: 8, outputTokens: 3 }
            };
          }
        }
      ]
    });

    const comparison = buildProviderComparison(run);

    expect(comparison.rows[0]?.tokenUsage).toMatchObject({
      totalTokens: 11,
      totalTokenRuns: 1
    });
    expect(formatProviderComparison(comparison)).toContain(
      "tokens=11 (reported 1/1)"
    );
  });

  it("uses lexicographic ranking instead of letting latency outweigh pass rate", () => {
    const run: EvalRunResult = {
      suite: "ranking-priority",
      startedAt: "2026-08-10T00:00:00.000Z",
      completedAt: "2026-08-10T00:00:01.000Z",
      fixtureResults: [
        fixtureResult("higher-pass-rate", true, 1_000_000),
        fixtureResult("lower-pass-rate", false, 1)
      ],
      providerSummaries: [],
      totals: { total: 2, passed: 1, failed: 1 }
    };

    expect(buildProviderComparison(run).winner?.providerId).toBe(
      "higher-pass-rate"
    );
  });

  it("makes provider rollout decisions from explicit quality and resource gates", () => {
    const run = rolloutRun();
    const decision = evaluateProviderRollout(run, {
      baselineProviderId: "incumbent",
      candidateProviderId: "candidate",
      thresholds: {
        maxPassRateDrop: 0,
        minReferenceSimilarityDelta: -0.02,
        maxAverageProviderDurationMultiplier: 1.5,
        maxTotalTokensMultiplier: 1.2
      }
    });

    expect(decision.passed).toBe(true);
    expect(decision.checks).toHaveLength(4);
    expect(formatProviderRollout(decision)).toContain(
      "Provider rollout: candidate vs incumbent -> PASS"
    );
    expect(() => assertRolloutPassed(decision)).not.toThrow();
  });

  it.each([
    ["pass-rate", { passed: 89, failed: 11, passRate: 0.89 }],
    ["reference-similarity", { averageReferenceSimilarity: 0.77 }],
    ["average-provider-duration", { averageProviderDurationMs: 151 }],
    [
      "total-tokens",
      {
        tokenUsage: {
          measuredRuns: 100,
          inputTokenRuns: 100,
          outputTokenRuns: 100,
          totalTokenRuns: 100,
          inputTokens: 900,
          outputTokens: 400,
          totalTokens: 1300
        }
      }
    ]
  ] as const)("fails the %s rollout gate independently", (metric, override) => {
    const run = rolloutRun(override);
    const decision = evaluateProviderRollout(run, {
      baselineProviderId: "incumbent",
      candidateProviderId: "candidate",
      thresholds: {
        maxPassRateDrop: 0,
        minReferenceSimilarityDelta: -0.02,
        maxAverageProviderDurationMultiplier: 1.5,
        maxTotalTokensMultiplier: 1.2
      }
    });

    expect(decision.passed).toBe(false);
    expect(decision.checks.find((check) => check.metric === metric)?.passed).toBe(
      false
    );
    expect(() => assertRolloutPassed(decision)).toThrowError(/-> FAIL/);
  });

  it("fails closed when total-token coverage is incomplete", () => {
    const run = rolloutRun({
      tokenUsage: {
        measuredRuns: 99,
        inputTokenRuns: 99,
        outputTokenRuns: 99,
        totalTokenRuns: 99,
        inputTokens: 792,
        outputTokens: 297,
        totalTokens: 1089
      }
    });

    const decision = evaluateProviderRollout(run, {
      baselineProviderId: "incumbent",
      candidateProviderId: "candidate",
      thresholds: { maxTotalTokensMultiplier: 1.2 }
    });

    expect(decision.passed).toBe(false);
    expect(decision.checks[0]?.reason).toMatch(/coverage/);
  });

  it("fails closed when reference-similarity coverage is incomplete", () => {
    const run = rolloutRun({ referenceSimilarityRuns: 99 });
    const decision = evaluateProviderRollout(run, {
      baselineProviderId: "incumbent",
      candidateProviderId: "candidate",
      thresholds: { minReferenceSimilarityDelta: -0.02 }
    });

    expect(decision.passed).toBe(false);
    expect(decision.checks[0]?.reason).toMatch(/coverage/);
  });

  it("rejects rollout decisions without evaluated fixtures", () => {
    const run = rolloutRun({
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      providerDurationRuns: 0,
      referenceSimilarityExpectedRuns: 0,
      referenceSimilarityRuns: 0
    });

    expect(() =>
      evaluateProviderRollout(run, {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: { maxPassRateDrop: 0 }
      })
    ).toThrowError(/at least one evaluated fixture/);
  });

  it("rejects unknown rollout thresholds instead of passing with zero checks", () => {
    expect(() =>
      evaluateProviderRollout(rolloutRun(), {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: {
          maxTotalTokenMultiplier: 1.2
        } as unknown as ProviderRolloutThresholds
      })
    ).toThrowError(/Unknown provider rollout threshold: maxTotalTokenMultiplier/);
  });

  it("fails the provider-duration gate explicitly when the baseline is zero", () => {
    const decision = evaluateProviderRollout(
      rolloutRun({}, { averageProviderDurationMs: 0 }),
      {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: { maxAverageProviderDurationMultiplier: 1.5 }
      }
    );

    expect(decision.passed).toBe(false);
    expect(decision.checks[0]?.reason).toMatch(/greater than zero/);
  });

  it("supports a fully measured reference subset in a mixed suite", async () => {
    const run = await runEvalSuite({
      suite: "mixed-reference-suite",
      fixtures: [
        {
          id: "reference-case",
          prompt: "Reference case",
          referenceOutput: "stable answer"
        },
        { id: "assertion-only-case", prompt: "Assertion only" }
      ],
      providers: [
        meteredProvider("incumbent"),
        meteredProvider("candidate")
      ]
    });

    expect(run.providerSummaries[0]).toMatchObject({
      referenceSimilarityExpectedRuns: 1,
      referenceSimilarityRuns: 1
    });
    expect(
      evaluateProviderRollout(run, {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: { minReferenceSimilarityDelta: 0 }
      }).passed
    ).toBe(true);
  });

  it("fails similarity and token gates when a provider errors on measured coverage", async () => {
    const run = await runEvalSuite({
      suite: "partial-provider-coverage",
      fixtures: [
        {
          id: "reference-case",
          prompt: "Reference case",
          referenceOutput: "stable answer"
        },
        { id: "assertion-only-case", prompt: "Assertion only" }
      ],
      providers: [
        meteredProvider("incumbent"),
        {
          id: "candidate",
          async generate(request) {
            if (request.fixtureId === "reference-case") {
              throw new Error("provider unavailable");
            }

            return {
              output: "stable answer",
              tokenUsage: { inputTokens: 5, outputTokens: 5 }
            };
          }
        }
      ]
    });

    const decision = evaluateProviderRollout(run, {
      baselineProviderId: "incumbent",
      candidateProviderId: "candidate",
      thresholds: {
        minReferenceSimilarityDelta: 0,
        maxTotalTokensMultiplier: 1.2
      }
    });

    expect(decision.passed).toBe(false);
    expect(decision.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "reference-similarity", passed: false }),
        expect.objectContaining({ metric: "total-tokens", passed: false })
      ])
    );
  });
});

function providerSummary(
  providerId: string,
  overrides: Partial<ProviderSummary> = {}
): ProviderSummary {
  return {
    providerId,
    total: 100,
    passed: 90,
    failed: 10,
    passRate: 0.9,
    averageDurationMs: 125,
    providerDurationRuns: 100,
    averageProviderDurationMs: 100,
    referenceSimilarityExpectedRuns: 100,
    referenceSimilarityRuns: 100,
    averageReferenceSimilarity: 0.8,
    tokenUsage: {
      measuredRuns: 100,
      inputTokenRuns: 100,
      outputTokenRuns: 100,
      totalTokenRuns: 100,
      inputTokens: 700,
      outputTokens: 300,
      totalTokens: 1000
    },
    ...overrides
  };
}

function fixtureResult(
  providerId: string,
  passed: boolean,
  durationMs: number
): EvalRunResult["fixtureResults"][number] {
  return {
    suite: "ranking-priority",
    fixtureId: `${providerId}-fixture`,
    providerId,
    renderedPrompt: "Prompt",
    output: "Output",
    durationMs,
    providerDurationMs: durationMs,
    passed,
    expectationOutcomes: [],
    referenceSimilarityExpected: false,
    errors: []
  };
}

function rolloutRun(
  candidateOverrides: Partial<ProviderSummary> = {},
  baselineOverrides: Partial<ProviderSummary> = {}
): EvalRunResult {
  const summaries = [
    providerSummary("incumbent", baselineOverrides),
    providerSummary("candidate", {
      averageReferenceSimilarity: 0.79,
      averageDurationMs: 145,
      averageProviderDurationMs: 120,
      tokenUsage: {
        measuredRuns: 100,
        inputTokenRuns: 100,
        outputTokenRuns: 100,
        totalTokenRuns: 100,
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100
      },
      ...candidateOverrides
    })
  ];
  const fixtureResults = summaries.flatMap(fixtureResultsForSummary);

  return {
    suite: "rollout-suite",
    startedAt: "2026-08-10T00:00:00.000Z",
    completedAt: "2026-08-10T00:00:01.000Z",
    fixtureResults,
    providerSummaries: summaries,
    totals: {
      total: fixtureResults.length,
      passed: fixtureResults.filter((result) => result.passed).length,
      failed: fixtureResults.filter((result) => !result.passed).length
    }
  };
}

function fixtureResultsForSummary(
  summary: ProviderSummary
): EvalRunResult["fixtureResults"] {
  return Array.from({ length: summary.total }, (_, index) => {
    const result = fixtureResult(
      summary.providerId,
      index < summary.passed,
      summary.averageDurationMs
    );
    result.fixtureId = `${summary.providerId}-${index}`;
    result.referenceSimilarityExpected =
      index < summary.referenceSimilarityExpectedRuns;

    if (
      index < summary.referenceSimilarityRuns &&
      summary.averageReferenceSimilarity !== undefined
    ) {
      result.referenceSimilarity = summary.averageReferenceSimilarity;
    }

    if (summary.averageProviderDurationMs !== undefined) {
      result.providerDurationMs = summary.averageProviderDurationMs;
    }

    return result;
  });
}

function meteredProvider(providerId: string) {
  return {
    id: providerId,
    async generate() {
      return {
        output: "stable answer",
        tokenUsage: { inputTokens: 5, outputTokens: 5 }
      };
    }
  };
}
