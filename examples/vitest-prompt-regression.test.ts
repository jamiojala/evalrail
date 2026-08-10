import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertRolloutPassed,
  assertRunPassed,
  evaluateProviderRollout,
  expectContains,
  expectMaxTotalTokens,
  runEvalSuite,
  type PromptProvider
} from "../src";

const incumbent: PromptProvider = {
  id: "incumbent",
  async generate() {
    return {
      output: "The refund is available within 14 days.",
      tokenUsage: { inputTokens: 18, outputTokens: 10, totalTokens: 28 }
    };
  }
};

const candidate: PromptProvider = {
  id: "candidate",
  async generate() {
    return {
      output: "A refund is available within 14 days of purchase.",
      tokenUsage: { inputTokens: 18, outputTokens: 12, totalTokens: 30 }
    };
  }
};

describe("LLM prompt regression and provider rollout", () => {
  it("keeps the candidate inside quality and token gates", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-vitest-example-"));
    const fixtures = [
      {
        id: "refund-window",
        prompt: "State the refund window in one sentence.",
        referenceOutput: "A refund is available within 14 days of purchase.",
        expectations: [expectContains("14 days"), expectMaxTotalTokens(40)]
      }
    ];

    try {
      const recorded = await runEvalSuite({
        suite: "refund-policy",
        fixtures,
        providers: [incumbent, candidate],
        regression: { mode: "record", storeDir }
      });
      assertRunPassed(recorded);

      const run = await runEvalSuite({
        suite: "refund-policy",
        fixtures,
        providers: [incumbent, candidate],
        regression: { mode: "assert", storeDir }
      });

      assertRunPassed(run);

      const decision = evaluateProviderRollout(run, {
        baselineProviderId: "incumbent",
        candidateProviderId: "candidate",
        thresholds: {
          maxPassRateDrop: 0,
          minReferenceSimilarityDelta: -0.1,
          maxTotalTokensMultiplier: 1.2
        }
      });

      expect(decision.checks).toHaveLength(3);
      assertRolloutPassed(decision);
    } finally {
      await rm(storeDir, { recursive: true, force: true });
    }
  });
});
