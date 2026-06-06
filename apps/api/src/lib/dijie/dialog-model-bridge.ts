import type { DijieDialogBillingPolicy, DijieDialogContext } from "./dialog-context";
import type { DijieRoleListing } from "./role-listings";

export type DijieDialogModelPricingSnapshot = {
  pricingKnown: boolean;
  pricingSource: "openclaw_usage_cost" | "openclaw_model_cost" | "platform_review_config" | "missing";
  providerCostCents?: number;
  providerCostCurrency?: string;
  grossAmountCents?: number;
  platformReceivableCents?: number;
  developerReceivableCents?: number;
};

export type DijieDialogModelUsage = {
  provider: string;
  model: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  pricing: DijieDialogModelPricingSnapshot;
};

export type DijieOpenClawDialogModelResult = {
  reply: string;
  usage: DijieDialogModelUsage | Record<string, unknown>;
};

export type DijieOpenClawDialogModelBridge = {
  completeDijieDialogMessage: (input: {
    context: DijieDialogContext;
    billingPolicy: DijieDialogBillingPolicy;
    message: string;
    fallbackReply: string;
    roles: Array<Pick<DijieRoleListing, "id" | "title" | "subtitle" | "handle">>;
  }) => Promise<DijieOpenClawDialogModelResult>;
};

export const DIJIE_OPENCLAW_MODEL_BRIDGE = "dijie_openclaw_model_bridge";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

function nonNegativeAmount(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

function safeIdentifier(value: unknown): string | undefined {
  const text = nonEmptyString(value);
  if (!text) {
    return undefined;
  }
  return text.replace(/[^a-z0-9._:/-]+/giu, "_").slice(0, 120);
}

function pricingSource(value: unknown): DijieDialogModelPricingSnapshot["pricingSource"] {
  return value === "openclaw_usage_cost" ||
    value === "openclaw_model_cost" ||
    value === "platform_review_config" ||
    value === "missing"
    ? value
    : "missing";
}

export function normalizeDijieDialogModelUsage(value: unknown): DijieDialogModelUsage | null {
  const input = asRecord(value);
  const usage = asRecord(input.usage);
  const pricingInput = asRecord(input.pricing ?? usage.pricing ?? usage.cost);
  const provider = safeIdentifier(input.provider ?? usage.provider);
  const model = safeIdentifier(input.model ?? usage.model);
  if (!provider || !model) {
    return null;
  }

  const promptTokens =
    nonNegativeInteger(
      input.promptTokens ?? input.inputTokens ?? input.input ?? usage.promptTokens ?? usage.input,
    ) ??
    0;
  const completionTokens =
    nonNegativeInteger(
      input.completionTokens ??
        input.outputTokens ??
        input.output ??
        usage.completionTokens ??
        usage.output,
    ) ?? 0;
  const cacheReadTokens =
    nonNegativeInteger(input.cacheReadTokens ?? input.cacheRead ?? usage.cacheReadTokens ?? usage.cacheRead) ??
    0;
  const cacheWriteTokens =
    nonNegativeInteger(
      input.cacheWriteTokens ?? input.cacheWrite ?? usage.cacheWriteTokens ?? usage.cacheWrite,
    ) ?? 0;
  const totalTokens =
    nonNegativeInteger(input.totalTokens ?? usage.totalTokens ?? usage.total) ??
    promptTokens + completionTokens + cacheReadTokens + cacheWriteTokens;

  const pricingKnown = pricingInput.pricingKnown ?? pricingInput.known;
  const pricing: DijieDialogModelPricingSnapshot = {
    pricingKnown: pricingKnown === true,
    pricingSource: pricingSource(pricingInput.pricingSource ?? pricingInput.source),
    ...(nonNegativeAmount(pricingInput.providerCostCents) !== undefined
      ? { providerCostCents: nonNegativeAmount(pricingInput.providerCostCents) }
      : {}),
    ...(nonEmptyString(pricingInput.providerCostCurrency)
      ? { providerCostCurrency: nonEmptyString(pricingInput.providerCostCurrency) }
      : {}),
    ...(nonNegativeAmount(pricingInput.grossAmountCents) !== undefined
      ? { grossAmountCents: nonNegativeAmount(pricingInput.grossAmountCents) }
      : {}),
    ...(nonNegativeAmount(pricingInput.platformReceivableCents) !== undefined
      ? { platformReceivableCents: nonNegativeAmount(pricingInput.platformReceivableCents) }
      : {}),
    ...(nonNegativeAmount(pricingInput.developerReceivableCents) !== undefined
      ? { developerReceivableCents: nonNegativeAmount(pricingInput.developerReceivableCents) }
      : {}),
  };

  if (!pricing.pricingKnown) {
    pricing.pricingSource = "missing";
  }

  return {
    provider,
    model,
    requestCount: nonNegativeInteger(input.requestCount ?? usage.requestCount) ?? 1,
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    pricing,
  };
}

export function createDijieDialogModelUsageMeters(
  usage: DijieDialogModelUsage,
) {
  return [
    { name: "request_count", quantity: usage.requestCount, unit: "request" },
    { name: "input_tokens", quantity: usage.promptTokens, unit: "token" },
    { name: "output_tokens", quantity: usage.completionTokens, unit: "token" },
    { name: "cache_read_tokens", quantity: usage.cacheReadTokens, unit: "token" },
    { name: "cache_write_tokens", quantity: usage.cacheWriteTokens, unit: "token" },
    { name: "total_tokens", quantity: usage.totalTokens, unit: "token" },
  ];
}

export function createDijieDialogModelBillingAmounts(usage: DijieDialogModelUsage) {
  const platformReceivableCents = usage.pricing.platformReceivableCents ?? 0;
  const developerReceivableCents = usage.pricing.developerReceivableCents ?? 0;
  return {
    grossAmountCents:
      usage.pricing.grossAmountCents ?? platformReceivableCents + developerReceivableCents,
    platformReceivableCents,
    developerReceivableCents,
  };
}
