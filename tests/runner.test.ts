import { describe, expect, it } from "vitest";

import {
  assertRunPassed,
  expectContains,
  expectMaxTotalTokens,
  expectMatches,
  expectReferenceSimilarity,
  formatRunSummary,
  runEvalSuite
} from "../src";
import { createProvider } from "./helpers";

describe("runEvalSuite", () => {
  it("runs fixtures against providers and reports passing suites", async () => {
    const fixtures = [
      {
        id: "release-note",
        prompt: "Write release notes for version {{version}}",
        variables: { version: "1.2.3" },
        referenceOutput: "Release 1.2.3 includes stability improvements",
        expectations: [expectContains("1.2.3"), expectReferenceSimilarity(0.2)]
      }
    ];

    const provider = createProvider(
      "stable-provider",
      () => "Release 1.2.3 includes stability improvements and bug fixes"
    );

    const run = await runEvalSuite({
      suite: "smoke-suite",
      fixtures,
      providers: [provider]
    });

    expect(run.totals.passed).toBe(1);
    expect(() => assertRunPassed(run)).not.toThrow();
    expect(formatRunSummary(run)).toContain("smoke-suite");
  });

  it("marks runs as failed when expectations fail", async () => {
    const fixtures = [
      {
        id: "guardrail",
        prompt: "Respond with exactly SAFE",
        expectations: [expectMatches("^SAFE$")]
      }
    ];

    const provider = createProvider("unsafe-provider", () => "UNSAFE");

    const run = await runEvalSuite({
      suite: "failure-suite",
      fixtures,
      providers: [provider]
    });

    expect(run.totals.failed).toBe(1);
    expect(() => assertRunPassed(run)).toThrowError(/failed with/);
  });

  it("preserves token usage, aggregates it, and enforces fixture budgets", async () => {
    const provider = {
      id: "metered-provider",
      async generate() {
        return {
          output: "Budget respected",
          tokenUsage: {
            inputTokens: 10,
            outputTokens: 5
          }
        };
      }
    };

    const run = await runEvalSuite({
      suite: "token-budget-suite",
      fixtures: [
        {
          id: "within-budget",
          prompt: "Keep this concise",
          expectations: [expectMaxTotalTokens(15)]
        }
      ],
      providers: [provider]
    });

    expect(run.totals.failed).toBe(0);
    expect(run.fixtureResults[0]?.tokenUsage).toEqual({
      inputTokens: 10,
      outputTokens: 5
    });
    expect(run.providerSummaries[0]?.tokenUsage).toEqual({
      measuredRuns: 1,
      inputTokenRuns: 1,
      outputTokenRuns: 1,
      totalTokenRuns: 1,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    });
    expect(formatRunSummary(run)).toContain("tokens=15 (reported 1/1)");
  });

  it("fails token budgets when usage is missing or exceeds the limit", async () => {
    const missingUsageRun = await runEvalSuite({
      suite: "missing-token-usage",
      fixtures: [
        {
          id: "missing-usage",
          prompt: "Return text",
          expectations: [expectMaxTotalTokens(10)]
        }
      ],
      providers: [createProvider("unmetered", () => "No usage metadata")]
    });

    expect(missingUsageRun.totals.failed).toBe(1);
    expect(missingUsageRun.fixtureResults[0]?.expectationOutcomes[0]?.error).toMatch(
      /Token usage is unavailable/
    );

    const overBudgetRun = await runEvalSuite({
      suite: "exceeded-token-budget",
      fixtures: [
        {
          id: "over-budget",
          prompt: "Return text",
          expectations: [expectMaxTotalTokens(10)]
        }
      ],
      providers: [
        {
          id: "metered",
          async generate() {
            return {
              output: "Too many tokens",
              tokenUsage: { totalTokens: 11 }
            };
          }
        }
      ]
    });

    expect(overBudgetRun.totals.failed).toBe(1);
    expect(overBudgetRun.fixtureResults[0]?.expectationOutcomes[0]?.error).toMatch(
      /received 11/
    );

    const inconsistentUsageRun = await runEvalSuite({
      suite: "inconsistent-token-usage",
      fixtures: [
        {
          id: "undercounted-total",
          prompt: "Return text",
          expectations: [expectMaxTotalTokens(10)]
        }
      ],
      providers: [
        {
          id: "inconsistent-meter",
          async generate() {
            return {
              output: "Conservative count",
              tokenUsage: { inputTokens: 8, outputTokens: 4, totalTokens: 10 }
            };
          }
        }
      ]
    });

    expect(inconsistentUsageRun.totals.failed).toBe(1);
    expect(
      inconsistentUsageRun.fixtureResults[0]?.expectationOutcomes[0]?.error
    ).toMatch(/received 12/);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid token budgets: %s",
    (budget) => {
      expect(() => expectMaxTotalTokens(budget)).toThrowError(
        /non-negative safe integer/
      );
    }
  );

  it("rejects duplicate provider ids before running fixtures", async () => {
    await expect(
      runEvalSuite({
        suite: "duplicate-providers",
        fixtures: [{ id: "fixture", prompt: "Test" }],
        providers: [
          createProvider("duplicate", () => "first"),
          createProvider("duplicate", () => "second")
        ]
      })
    ).rejects.toThrowError(/Duplicate provider id/);
  });

  it.each(["", "   "])("rejects blank provider ids: %j", async (providerId) => {
    await expect(
      runEvalSuite({
        suite: "blank-provider-id",
        fixtures: [{ id: "fixture", prompt: "Test" }],
        providers: [createProvider(providerId, () => "output")]
      })
    ).rejects.toThrowError(/Provider id is required and cannot be empty/);
  });
});
