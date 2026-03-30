import type { AssertionContext, FixtureExpectation } from "./types";
import { jaccardSimilarity } from "./utils";

function withDescription(
  expectation: FixtureExpectation,
  description: string
): FixtureExpectation {
  expectation.description = description;
  return expectation;
}

export function expectContains(
  fragment: string,
  options: { caseSensitive?: boolean } = {}
): FixtureExpectation {
  return withDescription(
    (context: AssertionContext) => {
      const output = options.caseSensitive
        ? context.response.output
        : context.response.output.toLowerCase();
      const needle = options.caseSensitive ? fragment : fragment.toLowerCase();

      if (!output.includes(needle)) {
        throw new Error(
          `Expected output to contain \"${fragment}\" for fixture \"${context.fixture.id}\"`
        );
      }
    },
    `contains(${fragment})`
  );
}

export function expectNotContains(
  fragment: string,
  options: { caseSensitive?: boolean } = {}
): FixtureExpectation {
  return withDescription(
    (context: AssertionContext) => {
      const output = options.caseSensitive
        ? context.response.output
        : context.response.output.toLowerCase();
      const needle = options.caseSensitive ? fragment : fragment.toLowerCase();

      if (output.includes(needle)) {
        throw new Error(
          `Expected output to not contain \"${fragment}\" for fixture \"${context.fixture.id}\"`
        );
      }
    },
    `notContains(${fragment})`
  );
}

export function expectMatches(pattern: RegExp | string): FixtureExpectation {
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

  return withDescription(
    (context: AssertionContext) => {
      if (regex.global || regex.sticky) {
        regex.lastIndex = 0;
      }

      if (!regex.test(context.response.output)) {
        throw new Error(
          `Expected output to match ${regex.toString()} for fixture \"${context.fixture.id}\"`
        );
      }
    },
    `matches(${regex.toString()})`
  );
}

export function expectMinLength(minLength: number): FixtureExpectation {
  return withDescription(
    (context: AssertionContext) => {
      if (context.response.output.length < minLength) {
        throw new Error(
          `Expected output length >= ${minLength}, received ${context.response.output.length}`
        );
      }
    },
    `minLength(${minLength})`
  );
}

export function expectReferenceSimilarity(minScore = 0.7): FixtureExpectation {
  return withDescription(
    (context: AssertionContext) => {
      if (!context.fixture.referenceOutput) {
        throw new Error(
          `Fixture \"${context.fixture.id}\" has no referenceOutput for similarity expectation`
        );
      }

      const score = jaccardSimilarity(
        context.response.output,
        context.fixture.referenceOutput
      );

      if (score < minScore) {
        throw new Error(
          `Similarity ${score.toFixed(3)} is below minimum ${minScore.toFixed(3)}`
        );
      }
    },
    `referenceSimilarity(>=${minScore})`
  );
}

export function customExpectation(
  description: string,
  fn: FixtureExpectation
): FixtureExpectation {
  return withDescription(fn, description);
}
