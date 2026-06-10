import type {
  DijieOpenClawDialogModelBridge,
  DijieOpenClawDialogModelInput,
  DijieOpenClawDialogModelResult,
  DijieOpenClawDialogModelStreamHandlers,
} from "./dialog-model-bridge";

type UnknownRecord = Record<string, unknown>;

type OpenAiStreamingBridgeOptions = {
  apiKey: string;
  model?: string;
  fastModel?: string;
  responsesUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

const DEFAULT_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 90_000;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

function selectedModelForInput(input: DijieOpenClawDialogModelInput, options: OpenAiStreamingBridgeOptions) {
  return input.latencyClass === "fast_interaction"
    ? options.fastModel ?? options.model
    : options.model ?? options.fastModel;
}

function textFromOutputItem(value: unknown): string | undefined {
  const record = asRecord(value);
  return (
    stringField(record, "text") ??
    stringField(record, "output_text") ??
    stringField(record, "content")
  );
}

function replyFromResponse(response: UnknownRecord, fallback: string): string {
  const outputText = stringField(response, "output_text");
  if (outputText) {
    return outputText;
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return fallback;
  }

  const texts = output.flatMap((item) => {
    const itemRecord = asRecord(item);
    const directText = textFromOutputItem(itemRecord);
    if (directText) {
      return [directText];
    }
    const content = itemRecord.content;
    return Array.isArray(content)
      ? content.flatMap((contentItem) => {
          const text = textFromOutputItem(contentItem);
          return text ? [text] : [];
        })
      : [];
  });

  return texts.length > 0 ? texts.join("") : fallback;
}

function usageFromResponse(response: UnknownRecord, modelOverride: string) {
  const usage = asRecord(response.usage);
  const inputTokens =
    nonNegativeInteger(usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens) ?? 0;
  const outputTokens =
    nonNegativeInteger(usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens) ?? 0;
  const cacheDetails = asRecord(usage.input_tokens_details ?? usage.inputTokensDetails);
  const cacheReadTokens =
    nonNegativeInteger(cacheDetails.cached_tokens ?? cacheDetails.cacheReadTokens) ?? 0;

  return {
    provider: "openai",
    model: stringField(response, "model") ?? modelOverride,
    requestCount: 1,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    cacheReadTokens,
    cacheWriteTokens: 0,
    totalTokens:
      nonNegativeInteger(usage.total_tokens ?? usage.totalTokens) ??
      inputTokens + outputTokens,
    pricing: {
      pricingKnown: false,
      pricingSource: "missing",
    },
  };
}

function deltaFromStreamEvent(event: UnknownRecord): string | undefined {
  if (event.type !== "response.output_text.delta") {
    return undefined;
  }
  return stringField(event, "delta") ?? stringField(event, "text");
}

function responseFromCompletedEvent(event: UnknownRecord): UnknownRecord | undefined {
  return event.type === "response.completed" ? asRecord(event.response) : undefined;
}

function parseSseData(block: string): UnknownRecord[] {
  const dataLines = block
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());
  if (dataLines.length === 0) {
    return [];
  }

  const data = dataLines.join("\n").trim();
  if (!data || data === "[DONE]") {
    return [];
  }

  try {
    return [asRecord(JSON.parse(data))];
  } catch {
    return [];
  }
}

async function errorMessageFromResponse(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return `OpenAI Responses API returned ${response.status}.`;
  }
  try {
    const parsed = asRecord(JSON.parse(text));
    const error = asRecord(parsed.error);
    return stringField(error, "message") ?? stringField(parsed, "message") ?? text.trim().slice(0, 500);
  } catch {
    return text.trim().slice(0, 500);
  }
}

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

export function createDijieOpenAiStreamingModelBridge(
  options: OpenAiStreamingBridgeOptions,
): DijieOpenClawDialogModelBridge {
  const responsesUrl = options.responsesUrl ?? DEFAULT_RESPONSES_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? fetch;

  async function createResponse(input: DijieOpenClawDialogModelInput, stream: boolean) {
    const model = selectedModelForInput(input, options);
    if (!model) {
      throw new Error("OpenAI streaming model bridge is missing a model.");
    }

    const timeout = createTimeoutController(timeoutMs);
    let returnedResponse = false;
    try {
      const response = await fetchFn(responsesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          Accept: stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify({
          model,
          input: input.message,
          stream,
        }),
        signal: timeout.signal,
      });

      if (!response.ok) {
        throw new Error(await errorMessageFromResponse(response));
      }
      returnedResponse = true;
      return { response, model, clearTimeout: timeout.clear };
    } finally {
      if (!stream || !returnedResponse) {
        timeout.clear();
      }
    }
  }

  return {
    async completeDijieDialogMessage(input): Promise<DijieOpenClawDialogModelResult> {
      const { response, model } = await createResponse(input, false);
      const payload = asRecord(await response.json());
      return {
        reply: replyFromResponse(payload, input.fallbackReply),
        usage: usageFromResponse(payload, model),
      };
    },

    async streamDijieDialogMessage(
      input: DijieOpenClawDialogModelInput,
      handlers: DijieOpenClawDialogModelStreamHandlers = {},
    ): Promise<DijieOpenClawDialogModelResult> {
      const { response, model, clearTimeout } = await createResponse(input, true);
      if (!response.body) {
        clearTimeout();
        throw new Error("OpenAI Responses API stream did not return a readable body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let completedResponse: UnknownRecord | undefined;

      try {
        while (true) {
          // eslint-disable-next-line no-await-in-loop -- Streaming chunks must be consumed in order.
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const blocks = buffer.split(/\r?\n\r?\n/u);
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            for (const event of parseSseData(block)) {
              const delta = deltaFromStreamEvent(event);
              if (delta) {
                accumulatedText += delta;
                handlers.onDelta?.(delta);
              }
              completedResponse = responseFromCompletedEvent(event) ?? completedResponse;
            }
          }

          if (done) {
            break;
          }
        }

        if (buffer.trim()) {
          for (const event of parseSseData(buffer)) {
            const delta = deltaFromStreamEvent(event);
            if (delta) {
              accumulatedText += delta;
              handlers.onDelta?.(delta);
            }
            completedResponse = responseFromCompletedEvent(event) ?? completedResponse;
          }
        }
      } finally {
        clearTimeout();
      }

      const finalResponse = completedResponse ?? { model, usage: {} };
      return {
        reply: accumulatedText || replyFromResponse(finalResponse, input.fallbackReply),
        usage: usageFromResponse(finalResponse, model),
      };
    },
  };
}

export function createDijieOpenAiStreamingModelBridgeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DijieOpenClawDialogModelBridge | undefined {
  if (env.DIJIE_OPENAI_STREAMING_ENABLED !== "true") {
    return undefined;
  }

  const apiKey = env.DIJIE_OPENAI_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    return undefined;
  }

  return createDijieOpenAiStreamingModelBridge({
    apiKey,
    model: env.DIJIE_OPENAI_MODEL ?? "gpt-5.5",
    fastModel: env.DIJIE_OPENAI_FAST_MODEL,
    responsesUrl: env.DIJIE_OPENAI_RESPONSES_URL,
    timeoutMs: env.DIJIE_OPENAI_STREAMING_TIMEOUT_MS
      ? Number.parseInt(env.DIJIE_OPENAI_STREAMING_TIMEOUT_MS, 10)
      : undefined,
  });
}
