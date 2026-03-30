import type { PromptProvider, PromptRequest, PromptResponse } from "../types";

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAIMessage {
  content?:
    | string
    | Array<{
        type?: string;
        text?: string;
      }>;
}

interface OpenAIChoice {
  message?: OpenAIMessage;
  finish_reason?: string;
}

interface OpenAIChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: OpenAIUsage;
}

export interface OpenAICompatibleProviderOptions {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  id?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

function ensureNoTrailingSlash(input: string): string {
  return input.endsWith("/") ? input.slice(0, -1) : input;
}

function readApiKey(apiKey?: string): string {
  const resolved = apiKey ?? process.env.OPENAI_API_KEY;

  if (!resolved || resolved.trim() === "") {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY in your environment or pass options.apiKey"
    );
  }

  return resolved;
}

function extractTextFromContent(content: OpenAIMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part.type === "output_text" || part.type === "text" || !part.type) {
          return part.text ?? "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function toPromptResponse(
  payload: OpenAIChatCompletionResponse,
  request: PromptRequest
): PromptResponse {
  const firstChoice = payload.choices?.[0];
  const output = extractTextFromContent(firstChoice?.message?.content);

  if (!output) {
    throw new Error(
      `OpenAI-compatible provider returned no text output for fixture \"${request.fixtureId}\"`
    );
  }

  const promptResponse: PromptResponse = {
    output,
    metadata: {
      upstreamId: payload.id,
      model: payload.model,
      finishReason: firstChoice?.finish_reason
    }
  };

  const tokenUsage: PromptResponse["tokenUsage"] = {};

  if (payload.usage?.prompt_tokens !== undefined) {
    tokenUsage.inputTokens = payload.usage.prompt_tokens;
  }

  if (payload.usage?.completion_tokens !== undefined) {
    tokenUsage.outputTokens = payload.usage.completion_tokens;
  }

  if (payload.usage?.total_tokens !== undefined) {
    tokenUsage.totalTokens = payload.usage.total_tokens;
  }

  if (Object.keys(tokenUsage).length > 0) {
    promptResponse.tokenUsage = tokenUsage;
  }

  return promptResponse;
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions
): PromptProvider {
  const fetcher = options.fetchImpl ?? globalThis.fetch;

  if (!fetcher) {
    throw new Error("No fetch implementation found. Use Node.js 18+ or pass options.fetchImpl.");
  }

  const baseUrl = ensureNoTrailingSlash(
    options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com"
  );

  return {
    id: options.id ?? "openai-compatible",
    async generate(request: PromptRequest): Promise<PromptResponse> {
      const apiKey = readApiKey(options.apiKey);

      const response = await fetcher(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          ...options.headers
        },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature ?? 0,
          max_tokens: options.maxTokens,
          messages: [
            ...(options.systemPrompt
              ? [
                  {
                    role: "system",
                    content: options.systemPrompt
                  }
                ]
              : []),
            {
              role: "user",
              content: request.renderedPrompt
            }
          ]
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenAI-compatible request failed (${response.status} ${response.statusText}): ${body}`
        );
      }

      const payload = (await response.json()) as OpenAIChatCompletionResponse;
      return toPromptResponse(payload, request);
    }
  };
}
