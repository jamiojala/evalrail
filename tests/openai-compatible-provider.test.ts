import { describe, expect, it } from "vitest";

import {
  createOpenAICompatibleProvider,
  type PromptRequest
} from "../src";

describe("createOpenAICompatibleProvider", () => {
  const request: PromptRequest = {
    fixtureId: "f1",
    prompt: "Hello {{name}}",
    renderedPrompt: "Hello team",
    variables: { name: "team" }
  };

  it("converts chat completion payload into PromptResponse", async () => {
    let seenBody: Record<string, unknown> | undefined;

    const provider = createOpenAICompatibleProvider({
      model: "gpt-test",
      apiKey: "test-key",
      fetchImpl: async (_input, init) => {
        seenBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

        return new Response(
          JSON.stringify({
            id: "cmpl_123",
            model: "gpt-test",
            choices: [
              {
                message: {
                  content: "It works"
                },
                finish_reason: "stop"
              }
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    });

    const response = await provider.generate(request);

    expect(seenBody?.model).toBe("gpt-test");
    expect(response.output).toBe("It works");
    expect(response.tokenUsage?.totalTokens).toBe(15);
    expect(response.metadata).toMatchObject({
      upstreamId: "cmpl_123",
      model: "gpt-test",
      finishReason: "stop"
    });
  });

  it("throws when api key is missing", async () => {
    const provider = createOpenAICompatibleProvider({
      model: "gpt-test",
      apiKey: "",
      fetchImpl: async () => new Response("{}", { status: 200 })
    });

    await expect(provider.generate(request)).rejects.toThrowError(/Missing OpenAI API key/);
  });

  it("throws useful error on non-2xx upstream response", async () => {
    const provider = createOpenAICompatibleProvider({
      model: "gpt-test",
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "Rate limited" } }), {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "content-type": "application/json" }
        })
    });

    await expect(provider.generate(request)).rejects.toThrowError(
      /OpenAI-compatible request failed \(429 Too Many Requests\)/
    );
  });
});
