import { describe, expect, it } from "bun:test";
import {
  createDijieDialogModelBillingAmounts,
  createDijieDialogModelUsageMeters,
  normalizeDijieDialogModelUsage,
} from "./dialog-model-bridge";

describe("Dijie OpenClaw dialog model bridge", () => {
  it("normalizes OpenClaw-style usage aliases without prompt or raw response storage", () => {
    const usage = normalizeDijieDialogModelUsage({
      provider: "openai",
      model: "gpt-5.4",
      usage: {
        input: 1200,
        output: 300,
        cacheRead: 50,
        cacheWrite: 0,
        totalTokens: 1550,
      },
      pricing: {
        known: true,
        source: "platform_review_config",
        grossAmountCents: 3,
        platformReceivableCents: 3,
        providerCostCents: 2,
        providerCostCurrency: "CNY",
      },
      rawResponse: { secret: "must not be copied" },
      prompt: "must not be copied",
    });

    expect(usage).toEqual({
      provider: "openai",
      model: "gpt-5.4",
      requestCount: 1,
      promptTokens: 1200,
      completionTokens: 300,
      cacheReadTokens: 50,
      cacheWriteTokens: 0,
      totalTokens: 1550,
      pricing: {
        pricingKnown: true,
        pricingSource: "platform_review_config",
        grossAmountCents: 3,
        platformReceivableCents: 3,
        providerCostCents: 2,
        providerCostCurrency: "CNY",
      },
    });
    expect(JSON.stringify(usage)).not.toContain("must not be copied");
  });

  it("marks missing pricing as missing instead of treating model use as free", () => {
    const usage = normalizeDijieDialogModelUsage({
      provider: "deepseek",
      model: "deepseek-chat",
      inputTokens: 100,
      outputTokens: 50,
      pricing: {
        pricingKnown: false,
        source: "openclaw_model_cost",
      },
    });

    expect(usage?.pricing).toMatchObject({
      pricingKnown: false,
      pricingSource: "missing",
    });
    expect(usage && createDijieDialogModelBillingAmounts(usage)).toEqual({
      grossAmountCents: 0,
      platformReceivableCents: 0,
      developerReceivableCents: 0,
    });
  });

  it("turns model usage into ledger meters", () => {
    const usage = normalizeDijieDialogModelUsage({
      provider: "openai",
      model: "gpt-5.4",
      promptTokens: 1200,
      completionTokens: 300,
      totalTokens: 1500,
      pricing: { pricingKnown: true, source: "platform_review_config" },
    });

    expect(usage && createDijieDialogModelUsageMeters(usage)).toEqual([
      { name: "request_count", quantity: 1, unit: "request" },
      { name: "input_tokens", quantity: 1200, unit: "token" },
      { name: "output_tokens", quantity: 300, unit: "token" },
      { name: "cache_read_tokens", quantity: 0, unit: "token" },
      { name: "cache_write_tokens", quantity: 0, unit: "token" },
      { name: "total_tokens", quantity: 1500, unit: "token" },
    ]);
  });
});
