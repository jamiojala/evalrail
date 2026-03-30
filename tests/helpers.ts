import type { PromptProvider, PromptRequest } from "../src";

export function createProvider(
  id: string,
  responder: (request: PromptRequest) => Promise<string> | string
): PromptProvider {
  return {
    id,
    async generate(request) {
      const output = await responder(request);
      return {
        output
      };
    }
  };
}
