import {
  buildProviderComparison,
  formatProviderComparison,
  runEvalSuite,
  expectContains,
  type PromptFixture,
  type PromptProvider
} from "../src";

const fixtures: PromptFixture[] = [
  {
    id: "status-note",
    prompt: "Write a short status note for leadership",
    referenceOutput: "The migration is stable and no customer impact has been observed.",
    expectations: [expectContains("stable")]
  },
  {
    id: "postmortem-line",
    prompt: "Write one postmortem sentence about mitigation",
    referenceOutput: "Mitigation was rolled out and error rates returned to baseline.",
    expectations: [expectContains("Mitigation")]
  }
];

const conciseProvider: PromptProvider = {
  id: "concise",
  async generate(request) {
    if (request.fixtureId === "status-note") {
      return {
        output: "The migration is stable and we observed no customer impact."
      };
    }

    return {
      output: "Mitigation was rolled out and error rates returned to baseline."
    };
  }
};

const noisyProvider: PromptProvider = {
  id: "noisy",
  async generate(request) {
    if (request.fixtureId === "status-note") {
      return {
        output: "Everything is probably okay, still checking."
      };
    }

    return {
      output: "We did something but no details."
    };
  }
};

const run = await runEvalSuite({
  suite: "provider-benchmark",
  fixtures,
  providers: [conciseProvider, noisyProvider]
});

const comparison = buildProviderComparison(run);

console.log(formatProviderComparison(comparison));
