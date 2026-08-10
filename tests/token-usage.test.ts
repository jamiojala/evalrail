import { describe, expect, it } from "vitest";

import { resolveTotalTokens, summarizeTokenUsage } from "../src/token-usage";

describe("token usage", () => {
  it("uses a valid reported total when component counts are absent", () => {
    expect(resolveTotalTokens({ totalTokens: 12 })).toBe(12);
  });

  it("derives a total from valid input and output counts", () => {
    expect(resolveTotalTokens({ inputTokens: 8, outputTokens: 4 })).toBe(12);
  });

  it("uses the conservative larger total when reported counts disagree", () => {
    expect(
      resolveTotalTokens({ inputTokens: 8, outputTokens: 4, totalTokens: 10 })
    ).toBe(12);
    expect(
      resolveTotalTokens({ inputTokens: 8, outputTokens: 4, totalTokens: 14 })
    ).toBe(14);
  });

  it.each([
    { totalTokens: -1 },
    { totalTokens: 1.5 },
    { totalTokens: Number.NaN },
    { totalTokens: Number.POSITIVE_INFINITY },
    { totalTokens: Number.MAX_SAFE_INTEGER + 1 },
    { inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 1 }
  ])("rejects invalid token counts: %j", (usage) => {
    expect(resolveTotalTokens(usage)).toBeUndefined();
  });

  it("accepts zero and excludes invalid components from summaries", () => {
    expect(resolveTotalTokens({ totalTokens: 0 })).toBe(0);
    expect(
      summarizeTokenUsage([
        { tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
        { tokenUsage: { inputTokens: -1, outputTokens: 1.5 } }
      ])
    ).toEqual({
      measuredRuns: 2,
      inputTokenRuns: 1,
      outputTokenRuns: 1,
      totalTokenRuns: 1,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    });
  });

  it("withholds an aggregate that would exceed safe integer precision", () => {
    expect(
      summarizeTokenUsage([
        { tokenUsage: { totalTokens: Number.MAX_SAFE_INTEGER } },
        { tokenUsage: { totalTokens: 1 } }
      ])
    ).toEqual({
      measuredRuns: 2,
      inputTokenRuns: 0,
      outputTokenRuns: 0,
      totalTokenRuns: 2
    });
  });
});
