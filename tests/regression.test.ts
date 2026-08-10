import { access, mkdtemp, readFile } from "node:fs/promises";
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

  it("preserves sanitization for ordinary suite and provider names", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-sanitized-path-"));

    const run = await runEvalSuite({
      suite: "support / nightly",
      fixtures: [{ id: "path-case", prompt: "Check snapshot path" }],
      providers: [createProvider("provider:v1", () => "safe output")],
      regression: {
        mode: "record",
        storeDir
      }
    });

    expect(run.totals.failed).toBe(0);
    const raw = await readFile(
      join(storeDir, "support_nightly", "provider_v1.snapshots.json"),
      "utf8"
    );
    expect(raw).toContain("safe output");
  });

  it.each([".", ".."])(
    "rejects suite %j without creating an unsafe snapshot",
    async (suite) => {
      const sandboxDir = await mkdtemp(join(tmpdir(), "evalrail-suite-path-"));
      const storeDir = join(sandboxDir, "snapshots");
      const invalidSnapshot =
        suite === ".."
          ? join(sandboxDir, "baseline.snapshots.json")
          : join(storeDir, "baseline.snapshots.json");

      const run = await runEvalSuite({
        suite,
        fixtures: [{ id: "path-case", prompt: "Check snapshot path" }],
        providers: [createProvider("baseline", () => "safe output")],
        regression: {
          mode: "record",
          storeDir
        }
      });

      expect(run.totals.failed).toBe(1);
      expect(run.fixtureResults[0]?.errors).toContainEqual(
        expect.stringMatching(/Invalid regression suite/)
      );
      await expect(access(invalidSnapshot)).rejects.toMatchObject({ code: "ENOENT" });
    }
  );

  const reservedProviderIds = [".", ".."] as const;
  it.each(reservedProviderIds)(
    "rejects provider id %j without creating a snapshot",
    async (providerId) => {
      const sandboxDir = await mkdtemp(join(tmpdir(), "evalrail-provider-path-"));
      const storeDir = join(sandboxDir, "snapshots");
      const invalidSnapshot = join(
        storeDir,
        "valid-suite",
        providerId === ".."
          ? "...snapshots.json"
          : providerId === "."
            ? "..snapshots.json"
            : ".snapshots.json"
      );

      const run = await runEvalSuite({
        suite: "valid-suite",
        fixtures: [{ id: "path-case", prompt: "Check snapshot path" }],
        providers: [createProvider(providerId, () => "safe output")],
        regression: {
          mode: "record",
          storeDir
        }
      });

      expect(run.totals.failed).toBe(1);
      expect(run.fixtureResults[0]?.errors).toContainEqual(
        expect.stringMatching(/Invalid regression provider id/)
      );
      await expect(access(invalidSnapshot)).rejects.toMatchObject({ code: "ENOENT" });
    }
  );

  it("rejects provider ids that sanitize to the same snapshot path", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-provider-collision-"));

    const run = await runEvalSuite({
      suite: "collision-suite",
      fixtures: [{ id: "path-case", prompt: "Check snapshot identity" }],
      providers: [
        createProvider("a/b", () => "first provider output"),
        createProvider("a:b", () => "second provider output")
      ],
      regression: {
        mode: "record",
        storeDir
      }
    });

    expect(run.totals).toEqual({ total: 2, passed: 1, failed: 1 });
    expect(run.fixtureResults[1]?.errors).toContainEqual(
      expect.stringMatching(/resolve to the same portable snapshot path/)
    );

    const raw = await readFile(
      join(storeDir, "collision-suite", "a_b.snapshots.json"),
      "utf8"
    );
    expect(raw).toContain("first provider output");
    expect(raw).not.toContain("second provider output");
  });

  it("rejects case-only provider collisions for portable snapshot paths", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-provider-case-"));

    const run = await runEvalSuite({
      suite: "portable-suite",
      fixtures: [{ id: "path-case", prompt: "Check portable snapshot identity" }],
      providers: [
        createProvider("Provider", () => "uppercase provider output"),
        createProvider("provider", () => "lowercase provider output")
      ],
      regression: {
        mode: "record",
        storeDir
      }
    });

    expect(run.totals).toEqual({ total: 2, passed: 1, failed: 1 });
    expect(run.fixtureResults[1]?.errors).toContainEqual(
      expect.stringMatching(/same portable snapshot path/)
    );

    const raw = await readFile(
      join(storeDir, "portable-suite", "Provider.snapshots.json"),
      "utf8"
    );
    expect(raw).toContain("uppercase provider output");
    expect(raw).not.toContain("lowercase provider output");
  });

  it("rejects an existing snapshot owned by a colliding suite name", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "evalrail-suite-collision-"));
    const fixtures = [{ id: "path-case", prompt: "Check snapshot identity" }];

    const firstRun = await runEvalSuite({
      suite: "a/b",
      fixtures,
      providers: [createProvider("baseline", () => "first suite output")],
      regression: {
        mode: "record",
        storeDir
      }
    });
    expect(firstRun.totals.failed).toBe(0);

    const secondRun = await runEvalSuite({
      suite: "a:b",
      fixtures,
      providers: [createProvider("baseline", () => "second suite output")],
      regression: {
        mode: "record",
        storeDir
      }
    });

    expect(secondRun.totals.failed).toBe(1);
    expect(secondRun.fixtureResults[0]?.errors).toContainEqual(
      expect.stringMatching(/snapshot identity does not match/)
    );

    const raw = await readFile(
      join(storeDir, "a_b", "baseline.snapshots.json"),
      "utf8"
    );
    expect(raw).toContain("first suite output");
    expect(raw).not.toContain("second suite output");
  });
});
