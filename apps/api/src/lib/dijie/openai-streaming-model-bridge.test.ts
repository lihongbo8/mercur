import { describe, expect, it } from "bun:test";
import {
  createDijieOpenAiStreamingModelBridge,
  createDijieOpenAiStreamingModelBridgeFromEnv,
} from "./openai-streaming-model-bridge";
import { createDijieDeveloperDialogContext, getDijieDialogBillingPolicy } from "./dialog-context";

function streamResponseFromText(text: string) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

function dialogInput() {
  const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });
  return {
    context,
    billingPolicy: getDijieDialogBillingPolicy(context),
    latencyClass: "fast_interaction" as const,
    message: "普通对话",
    fallbackReply: "fallback",
    roles: [],
  };
}

describe("Dijie OpenAI streaming model bridge", () => {
  it("stays disabled unless explicitly enabled with an API key", () => {
    expect(createDijieOpenAiStreamingModelBridgeFromEnv({})).toBeUndefined();
    expect(
      createDijieOpenAiStreamingModelBridgeFromEnv({
        DIJIE_OPENAI_STREAMING_ENABLED: "true",
      }),
    ).toBeUndefined();
    expect(
      createDijieOpenAiStreamingModelBridgeFromEnv({
        DIJIE_OPENAI_STREAMING_ENABLED: "true",
        DIJIE_OPENAI_API_KEY: "test-key",
      }),
    ).toBeDefined();
  });

  it("streams Responses API output_text deltas before returning final usage", async () => {
    const calls: unknown[] = [];
    const bridge = createDijieOpenAiStreamingModelBridge({
      apiKey: "test-key",
      fastModel: "gpt-fast",
      fetchFn: async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return streamResponseFromText(
          [
            'data: {"type":"response.created"}',
            "",
            'data: {"type":"response.output_text.delta","delta":"第一段"}',
            "",
            'data: {"type":"response.output_text.delta","delta":"第二段"}',
            "",
            'data: {"type":"response.completed","response":{"model":"gpt-fast","usage":{"input_tokens":5,"output_tokens":7,"total_tokens":12}}}',
            "",
          ].join("\n"),
        );
      },
    });
    const deltas: string[] = [];

    const result = await bridge.streamDijieDialogMessage?.(dialogInput(), {
      onDelta: (text) => deltas.push(text),
    });

    expect(calls).toEqual([
      {
        model: "gpt-fast",
        input: "普通对话",
        stream: true,
      },
    ]);
    expect(deltas).toEqual(["第一段", "第二段"]);
    expect(result?.reply).toBe("第一段第二段");
    expect(result?.usage).toMatchObject({
      provider: "openai",
      model: "gpt-fast",
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
    });
  });

  it("normalizes non-stream Responses API replies for fallback completion", async () => {
    const bridge = createDijieOpenAiStreamingModelBridge({
      apiKey: "test-key",
      model: "gpt-standard",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            model: "gpt-standard",
            output_text: "完整回复",
            usage: {
              input_tokens: 11,
              output_tokens: 13,
              total_tokens: 24,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    });

    const result = await bridge.completeDijieDialogMessage({
      ...dialogInput(),
      latencyClass: "standard",
    });

    expect(result.reply).toBe("完整回复");
    expect(result.usage).toMatchObject({
      provider: "openai",
      model: "gpt-standard",
      promptTokens: 11,
      completionTokens: 13,
      totalTokens: 24,
    });
  });
});
