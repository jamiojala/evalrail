import type {
  EvalRunResult,
  ExpectationOutcome,
  FixtureExpectation,
  FixtureRunResult,
  PromptFixture,
  PromptProvider,
  PromptRequest,
  PromptResponse,
  ProviderSummary,
  RegressionMode,
  RegressionOutcome,
  RunEvalSuiteOptions
} from "./types";
import { defineFixtures } from "./fixtures";
import {
  FileRegressionStore,
  defaultRegressionComparator
} from "./regression";
import { renderPromptTemplate } from "./template";
import { summarizeTokenUsage } from "./token-usage";
import { mean, jaccardSimilarity } from "./utils";

function getExpectationName(expectation: FixtureExpectation, index: number): string {
  if (expectation.description) {
    return expectation.description;
  }

  if (expectation.name && expectation.name !== "") {
    return expectation.name;
  }

  return `expectation#${index + 1}`;
}

function isPassingRegressionOutcome(outcome?: RegressionOutcome): boolean {
  if (!outcome) {
    return true;
  }

  return (
    outcome.status === "skipped" ||
    outcome.status === "recorded" ||
    outcome.status === "passed"
  );
}

function hasPassingExpectations(expectationOutcomes: ExpectationOutcome[]): boolean {
  return expectationOutcomes.every((expectation) => expectation.passed);
}

async function runExpectations(
  fixture: PromptFixture,
  provider: PromptProvider,
  request: PromptRequest,
  response: PromptResponse
): Promise<ExpectationOutcome[]> {
  const expectations = fixture.expectations ?? [];

  const outcomes: ExpectationOutcome[] = [];

  for (const [index, expectation] of expectations.entries()) {
    const name = getExpectationName(expectation, index);

    try {
      await expectation({
        fixture,
        provider,
        request,
        response
      });

      outcomes.push({
        name,
        passed: true
      });
    } catch (error) {
      outcomes.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return outcomes;
}

async function runRegression(
  mode: RegressionMode,
  store: FileRegressionStore,
  options: RunEvalSuiteOptions,
  fixture: PromptFixture,
  provider: PromptProvider,
  output: string,
  metadata?: Record<string, unknown>
): Promise<RegressionOutcome> {
  if (mode === "record") {
    await store.setSnapshot(provider.id, fixture.id, output, metadata);
    return {
      status: "recorded",
      reason: "Snapshot recorded"
    };
  }

  const baseline = await store.getSnapshot(provider.id, fixture.id);

  if (!baseline && mode === "update-missing") {
    await store.setSnapshot(provider.id, fixture.id, output, metadata);
    return {
      status: "recorded",
      reason: "Baseline was missing and has been recorded"
    };
  }

  if (!baseline) {
    return {
      status: "missing-baseline",
      reason: "Missing baseline snapshot"
    };
  }

  const comparator = options.regression?.comparator ?? defaultRegressionComparator;
  const comparison = await comparator({
    fixture,
    provider,
    currentOutput: output,
    baselineOutput: baseline.output
  });

  return {
    status: comparison.ok ? "passed" : "failed",
    score: comparison.score,
    reason: comparison.reason,
    baselineOutput: baseline.output
  };
}

function summarizeProviderResults(
  providerId: string,
  results: FixtureRunResult[]
): ProviderSummary {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;

  const referenceScores = results
    .map((result) => result.referenceSimilarity)
    .filter((value): value is number => typeof value === "number");
  const providerDurations = results
    .map((result) => result.providerDurationMs)
    .filter((value): value is number => typeof value === "number");
  const referenceSimilarityExpectedRuns = results.filter(
    (result) => result.referenceSimilarityExpected
  ).length;

  const summary: ProviderSummary = {
    providerId,
    total,
    passed,
    failed,
    passRate: total === 0 ? 0 : passed / total,
    averageDurationMs: mean(results.map((result) => result.durationMs)),
    providerDurationRuns: providerDurations.length,
    referenceSimilarityExpectedRuns,
    referenceSimilarityRuns: referenceScores.length
  };

  if (providerDurations.length > 0) {
    summary.averageProviderDurationMs = mean(providerDurations);
  }

  if (referenceScores.length > 0) {
    summary.averageReferenceSimilarity = mean(referenceScores);
  }

  const tokenUsage = summarizeTokenUsage(results);
  if (tokenUsage !== undefined) {
    summary.tokenUsage = tokenUsage;
  }

  return summary;
}

export async function runEvalSuite(
  options: RunEvalSuiteOptions
): Promise<EvalRunResult> {
  if (!options.suite || options.suite.trim() === "") {
    throw new Error("options.suite is required");
  }

  if (options.providers.length === 0) {
    throw new Error("runEvalSuite requires at least one provider");
  }

  const providerIds = new Set<string>();
  for (const provider of options.providers) {
    if (!provider.id || provider.id.trim() === "") {
      throw new Error("Provider id is required and cannot be empty");
    }

    if (providerIds.has(provider.id)) {
      throw new Error(`Duplicate provider id: ${provider.id}`);
    }
    providerIds.add(provider.id);
  }

  defineFixtures(options.fixtures);

  const regressionMode = options.regression?.mode ?? "off";
  const regressionStore =
    regressionMode === "off"
      ? undefined
      : new FileRegressionStore({
          suite: options.suite,
          storeDir: options.regression?.storeDir ?? ".evalrail"
        });

  const startedAt = new Date().toISOString();
  const fixtureResults: FixtureRunResult[] = [];

  for (const provider of options.providers) {
    for (const fixture of options.fixtures) {
      const errors: string[] = [];
      let regressionOutcome: RegressionOutcome | undefined;

      const start = performance.now();
      const variables = fixture.variables ?? {};
      let renderedPrompt = "";
      let output = "";
      let tokenUsage: PromptResponse["tokenUsage"];
      let providerDurationMs: number | undefined;
      const referenceOutput = fixture.referenceOutput;
      const referenceSimilarityExpected = referenceOutput !== undefined;

      try {
        renderedPrompt = renderPromptTemplate(fixture.prompt, variables);

        const request: PromptRequest = {
          fixtureId: fixture.id,
          prompt: fixture.prompt,
          renderedPrompt,
          variables
        };

        if (fixture.metadata !== undefined) {
          request.metadata = fixture.metadata;
        }

        let response: PromptResponse;
        const providerStartedAt = performance.now();
        try {
          response = await provider.generate(request);
        } finally {
          providerDurationMs = performance.now() - providerStartedAt;
        }
        output = response.output;
        tokenUsage = response.tokenUsage;

        const expectationOutcomes = await runExpectations(
          fixture,
          provider,
          request,
          response
        );

        if (regressionMode !== "off" && regressionStore) {
          regressionOutcome = await runRegression(
            regressionMode,
            regressionStore,
            options,
            fixture,
            provider,
            output,
            response.metadata
          );

          if (regressionOutcome.status === "missing-baseline") {
            errors.push(regressionOutcome.reason ?? "Missing baseline snapshot");
          }
        } else {
          regressionOutcome = {
            status: "skipped",
            reason: "Regression checks disabled"
          };
        }

        const durationMs = performance.now() - start;
        const referenceSimilarity = referenceOutput !== undefined
          ? jaccardSimilarity(output, referenceOutput)
          : undefined;

        const passed =
          errors.length === 0 &&
          hasPassingExpectations(expectationOutcomes) &&
          isPassingRegressionOutcome(regressionOutcome);

        const result: FixtureRunResult = {
          suite: options.suite,
          fixtureId: fixture.id,
          providerId: provider.id,
          renderedPrompt,
          output,
          durationMs,
          passed,
          expectationOutcomes,
          referenceSimilarityExpected,
          errors
        };

        if (providerDurationMs !== undefined) {
          result.providerDurationMs = providerDurationMs;
        }

        if (regressionOutcome !== undefined) {
          result.regressionOutcome = regressionOutcome;
        }

        if (referenceSimilarity !== undefined) {
          result.referenceSimilarity = referenceSimilarity;
        }

        if (tokenUsage !== undefined) {
          result.tokenUsage = tokenUsage;
        }

        fixtureResults.push(result);

        if (options.onFixtureComplete) {
          await options.onFixtureComplete(result);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));

        const durationMs = performance.now() - start;
        const result: FixtureRunResult = {
          suite: options.suite,
          fixtureId: fixture.id,
          providerId: provider.id,
          renderedPrompt,
          output,
          durationMs,
          passed: false,
          expectationOutcomes: [],
          referenceSimilarityExpected,
          errors
        };

        if (providerDurationMs !== undefined) {
          result.providerDurationMs = providerDurationMs;
        }

        if (regressionOutcome !== undefined) {
          result.regressionOutcome = regressionOutcome;
        }

        if (tokenUsage !== undefined) {
          result.tokenUsage = tokenUsage;
        }

        fixtureResults.push(result);

        if (options.onFixtureComplete) {
          await options.onFixtureComplete(result);
        }
      }
    }
  }

  if (regressionStore) {
    await regressionStore.flush();
  }

  const completedAt = new Date().toISOString();

  const providerSummaries = options.providers.map((provider) => {
    const providerResults = fixtureResults.filter(
      (result) => result.providerId === provider.id
    );

    return summarizeProviderResults(provider.id, providerResults);
  });

  const totals = {
    total: fixtureResults.length,
    passed: fixtureResults.filter((result) => result.passed).length,
    failed: fixtureResults.filter((result) => !result.passed).length
  };

  return {
    suite: options.suite,
    startedAt,
    completedAt,
    fixtureResults,
    providerSummaries,
    totals
  };
}
