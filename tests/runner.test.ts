import { describe, expect, it } from "vitest";

import {
  assertRunPassed,
  expectContains,
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
});
