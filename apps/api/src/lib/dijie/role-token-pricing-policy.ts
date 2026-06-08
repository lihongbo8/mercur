import {
  normalizeRoleTokenPricing,
  type DijieRoleTokenPricing,
} from "./execution-token";

export type DijieRoleTokenPricingPolicy = {
  inputCostCentsPerMillion: number;
  outputCostCentsPerMillion: number;
  maxMarkupMultiplier: number;
};

export type DijieRoleTokenPricingValidationResult =
  | {
      ok: true;
      value: DijieRoleTokenPricing;
      policy: DijieRoleTokenPricingPolicy;
    }
  | {
      ok: false;
      error: string;
      policy: DijieRoleTokenPricingPolicy;
    };

const DEFAULT_INPUT_COST_CENTS_PER_MILLION = 120;
const DEFAULT_OUTPUT_COST_CENTS_PER_MILLION = 360;
const DEFAULT_MAX_MARKUP_MULTIPLIER = 20;

function parsePositiveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDijieRoleTokenPricingPolicy(
  env: Record<string, string | undefined> = process.env,
): DijieRoleTokenPricingPolicy {
  return {
    inputCostCentsPerMillion: parsePositiveIntegerEnv(
      env.DIJIE_ROLE_INPUT_TOKEN_COST_CENTS_PER_MILLION,
      DEFAULT_INPUT_COST_CENTS_PER_MILLION,
    ),
    outputCostCentsPerMillion: parsePositiveIntegerEnv(
      env.DIJIE_ROLE_OUTPUT_TOKEN_COST_CENTS_PER_MILLION,
      DEFAULT_OUTPUT_COST_CENTS_PER_MILLION,
    ),
    maxMarkupMultiplier: parsePositiveNumberEnv(
      env.DIJIE_ROLE_TOKEN_MAX_MARKUP_MULTIPLIER,
      DEFAULT_MAX_MARKUP_MULTIPLIER,
    ),
  };
}

export function centsPerMillionLabel(value: number): string {
  return `¥${(value / 100).toFixed(2)}/百万 Token`;
}

function exceedsMax(value: number, cost: number, multiplier: number): boolean {
  return value > Math.round(cost * multiplier);
}

export function validateDijieRoleTokenPricingAgainstPlatformPolicy(
  value: unknown,
  policy = getDijieRoleTokenPricingPolicy(),
): DijieRoleTokenPricingValidationResult {
  const pricing = normalizeRoleTokenPricing(value);
  if (!pricing) {
    return {
      ok: false,
      policy,
      error:
        "岗位 Token 使用费必须配置 CNY 输入/输出百万 Token 单价，平台抽成为 0，开发者收益为 100%。",
    };
  }

  if (pricing.inputTokenCentsPerMillion < policy.inputCostCentsPerMillion) {
    return {
      ok: false,
      policy,
      error: `输入 Token 使用费不能低于平台成本 ${centsPerMillionLabel(
        policy.inputCostCentsPerMillion,
      )}。`,
    };
  }

  if (pricing.outputTokenCentsPerMillion < policy.outputCostCentsPerMillion) {
    return {
      ok: false,
      policy,
      error: `输出 Token 使用费不能低于平台成本 ${centsPerMillionLabel(
        policy.outputCostCentsPerMillion,
      )}。`,
    };
  }

  if (
    exceedsMax(
      pricing.inputTokenCentsPerMillion,
      policy.inputCostCentsPerMillion,
      policy.maxMarkupMultiplier,
    )
  ) {
    return {
      ok: false,
      policy,
      error: `输入 Token 使用费不能超过平台成本 ${policy.maxMarkupMultiplier}x（最高 ${centsPerMillionLabel(
        Math.round(policy.inputCostCentsPerMillion * policy.maxMarkupMultiplier),
      )}）。`,
    };
  }

  if (
    exceedsMax(
      pricing.outputTokenCentsPerMillion,
      policy.outputCostCentsPerMillion,
      policy.maxMarkupMultiplier,
    )
  ) {
    return {
      ok: false,
      policy,
      error: `输出 Token 使用费不能超过平台成本 ${policy.maxMarkupMultiplier}x（最高 ${centsPerMillionLabel(
        Math.round(policy.outputCostCentsPerMillion * policy.maxMarkupMultiplier),
      )}）。`,
    };
  }

  return {
    ok: true,
    value: pricing,
    policy,
  };
}
