import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadFixturesFromFile,
  runEvalSuite,
  writeFixtureFile
} from "../src";
import { createProvider } from "./helpers";

describe("fixture files", () => {
  it("loads fixtures and compiles expectation shortcuts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evalrail-fixtures-"));
    const fixturePath = join(dir, "fixtures.json");

    await writeFixtureFile(fixturePath, [
      {
        id: "faq",
        prompt: "Answer the question: {{question}}",
        variables: { question: "What is EvalRail?" },
        contains: ["EvalRail"],
        minLength: 10
      }
    ]);

    const fixtures = await loadFixturesFromFile(fixturePath);

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.expectations).toHaveLength(2);

    const provider = createProvider("mock", () =>
      "EvalRail is a local-first prompt testing framework."
    );

    const run = await runEvalSuite({
      suite: "fixture-loader",
      fixtures,
      providers: [provider]
    });

    expect(run.totals.failed).toBe(0);
  });
});
