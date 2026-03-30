import { describe, expect, it } from "vitest";

import {
  buildProviderComparison,
  expectContains,
  formatProviderComparison,
  runEvalSuite
} from "../src";
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
});
