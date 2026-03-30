import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runEvalSuite } from "../src";
import { createProvider } from "./helpers";

describe("regression checks", () => {
  it("records and reuses local snapshots", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-regression-"));

    const fixtures = [
      {
        id: "policy",
        prompt: "State policy summary"
      }
    ];

    const provider = createProvider("baseline", () => "Policy summary v1");

    const recordRun = await runEvalSuite({
      suite: "regression-suite",
      fixtures,
      providers: [provider],
      regression: {
        mode: "record",
        storeDir
      }
    });

    expect(recordRun.totals.failed).toBe(0);

    const assertRun = await runEvalSuite({
      suite: "regression-suite",
      fixtures,
      providers: [provider],
      regression: {
        mode: "assert",
        storeDir
      }
    });

    expect(assertRun.totals.failed).toBe(0);

    const snapshotFile = join(
      storeDir,
      "regression-suite",
      "baseline.snapshots.json"
    );
    const raw = await readFile(snapshotFile, "utf8");

    expect(raw).toContain("Policy summary v1");
  });

  it("fails when output drifts from baseline", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-drift-"));

    const fixtures = [
      {
        id: "drift-case",
        prompt: "Explain risk posture"
      }
    ];

    await runEvalSuite({
      suite: "drift-suite",
      fixtures,
      providers: [createProvider("primary", () => "Risk posture is conservative")],
      regression: {
        mode: "record",
        storeDir
      }
    });

    const driftRun = await runEvalSuite({
      suite: "drift-suite",
      fixtures,
      providers: [createProvider("primary", () => "Totally different answer")],
      regression: {
        mode: "assert",
        storeDir
      }
    });

    expect(driftRun.totals.failed).toBe(1);
    expect(driftRun.fixtureResults[0]?.regressionOutcome?.status).toBe("failed");
  });
});
