export type DijieDialogAccountType = "buyer" | "developer" | "admin";
export type DijieDialogSurface =
  | "buyer_storefront"
  | "user_center"
  | "developer_center"
  | "admin_review"
  | "openclaw_main"
  | "openclaw_local";
export type DijieDialogMode = "user" | "developer" | "review";

export type DijieDialogSubject = {
  roleListingId?: string;
  packageId?: string;
  entitlementId?: string;
  executionId?: string;
  reviewId?: string;
};

export type DijieDialogContext = {
  accountId: string;
  accountType: DijieDialogAccountType;
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  subject: DijieDialogSubject;
  billingAccountId: string;
};

export type DijieDialogBillingPolicy = {
  billingAccountId: string;
  payerAccountId: string;
  metered: true;
  modelAllowed: boolean;
  chargedBy: "system_platform";
  billableModelUsage: boolean;
  ledgerSource:
    | "marketplace_assist"
    | "developer_assist"
    | "admin_review_assist"
    | "user_assist"
    | "role_usage";
  requiresEntitlement: boolean;
  note: string;
};

export type DijieDialogBillingSurfacePolicy = {
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  accountType: DijieDialogAccountType;
  billableModelUsage: boolean;
  ledgerSource: DijieDialogBillingPolicy["ledgerSource"];
  requiresEntitlement: boolean;
};

type UnknownRecord = Record<string, unknown>;

const ACCOUNT_TYPES = new Set<DijieDialogAccountType>(["buyer", "developer", "admin"]);
const SURFACES = new Set<DijieDialogSurface>([
  "buyer_storefront",
  "user_center",
  "developer_center",
  "admin_review",
  "openclaw_main",
  "openclaw_local",
]);
const MODES = new Set<DijieDialogMode>(["user", "developer", "review"]);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function subjectFromInput(value: unknown): DijieDialogSubject {
  const input = asRecord(value);
  return {
    ...(nonEmptyString(input.roleListingId ?? input.role_listing_id)
      ? { roleListingId: nonEmptyString(input.roleListingId ?? input.role_listing_id) }
      : {}),
    ...(nonEmptyString(input.packageId ?? input.package_id)
      ? { packageId: nonEmptyString(input.packageId ?? input.package_id) }
      : {}),
    ...(nonEmptyString(input.entitlementId ?? input.entitlement_id)
      ? { entitlementId: nonEmptyString(input.entitlementId ?? input.entitlement_id) }
      : {}),
    ...(nonEmptyString(input.executionId ?? input.execution_id)
      ? { executionId: nonEmptyString(input.executionId ?? input.execution_id) }
      : {}),
    ...(nonEmptyString(input.reviewId ?? input.review_id)
      ? { reviewId: nonEmptyString(input.reviewId ?? input.review_id) }
      : {}),
  };
}

export function createDijieDialogContext(input: {
  accountId: string;
  accountType: DijieDialogAccountType;
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  subject?: DijieDialogSubject;
  billingAccountId?: string;
}): DijieDialogContext {
  return {
    accountId: input.accountId,
    accountType: input.accountType,
    surface: input.surface,
    mode: input.mode,
    subject: input.subject ?? {},
    billingAccountId: input.billingAccountId ?? input.accountId,
  };
}

export function normalizeDijieDialogContext(value: unknown): DijieDialogContext | null {
  const input = asRecord(value);
  const accountId = nonEmptyString(input.accountId ?? input.account_id);
  const accountType = nonEmptyString(input.accountType ?? input.account_type);
  const surface = nonEmptyString(input.surface);
  const mode = nonEmptyString(input.mode);

  if (
    !accountId ||
    !accountType ||
    !surface ||
    !mode ||
    !ACCOUNT_TYPES.has(accountType as DijieDialogAccountType) ||
    !SURFACES.has(surface as DijieDialogSurface) ||
    !MODES.has(mode as DijieDialogMode)
  ) {
    return null;
  }

  return createDijieDialogContext({
    accountId,
    accountType: accountType as DijieDialogAccountType,
    surface: surface as DijieDialogSurface,
    mode: mode as DijieDialogMode,
    subject: subjectFromInput(input.subject),
    billingAccountId: nonEmptyString(input.billingAccountId ?? input.billing_account_id),
  });
}

export function createDijieAdminReviewDialogContext(params: {
  adminAccountId: string;
  roleListingId?: string;
  packageId?: string;
  reviewId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.adminAccountId,
    accountType: "admin",
    surface: "admin_review",
    mode: "review",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
      ...(params.packageId ? { packageId: params.packageId } : {}),
      ...(params.reviewId ? { reviewId: params.reviewId } : {}),
    },
  });
}

export function createDijieOpenClawUserDialogContext(params: {
  buyerAccountId: string;
  roleListingId?: string;
  entitlementId?: string;
  executionId?: string;
}): DijieDialogContext {
  return createDijieOpenClawMainDialogContext(params);
}

export function createDijieOpenClawMainDialogContext(params: {
  buyerAccountId: string;
  roleListingId?: string;
  entitlementId?: string;
  executionId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.buyerAccountId,
    accountType: "buyer",
    surface: "openclaw_main",
    mode: "user",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
      ...(params.entitlementId ? { entitlementId: params.entitlementId } : {}),
      ...(params.executionId ? { executionId: params.executionId } : {}),
    },
  });
}

export function createDijieDeveloperDialogContext(params: {
  developerAccountId: string;
  surface?: Extract<DijieDialogSurface, "developer_center" | "openclaw_local">;
  packageId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.developerAccountId,
    accountType: "developer",
    surface: params.surface ?? "developer_center",
    mode: "developer",
    subject: {
      ...(params.packageId ? { packageId: params.packageId } : {}),
    },
  });
}

export function createDijieBuyerStorefrontDialogContext(params: {
  buyerAccountId: string;
  roleListingId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.buyerAccountId,
    accountType: "buyer",
    surface: "buyer_storefront",
    mode: "user",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
    },
  });
}

export function createDijieUserCenterDialogContext(params: {
  buyerAccountId: string;
  roleListingId?: string;
  entitlementId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.buyerAccountId,
    accountType: "buyer",
    surface: "user_center",
    mode: "user",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
      ...(params.entitlementId ? { entitlementId: params.entitlementId } : {}),
    },
  });
}

export const DIJIE_DIALOG_BILLING_SURFACE_MATRIX: DijieDialogBillingSurfacePolicy[] = [
  {
    surface: "buyer_storefront",
    mode: "user",
    accountType: "buyer",
    billableModelUsage: true,
    ledgerSource: "marketplace_assist",
    requiresEntitlement: false,
  },
  {
    surface: "user_center",
    mode: "user",
    accountType: "buyer",
    billableModelUsage: true,
    ledgerSource: "user_assist",
    requiresEntitlement: false,
  },
  {
    surface: "developer_center",
    mode: "developer",
    accountType: "developer",
    billableModelUsage: true,
    ledgerSource: "developer_assist",
    requiresEntitlement: false,
  },
  {
    surface: "openclaw_local",
    mode: "developer",
    accountType: "developer",
    billableModelUsage: true,
    ledgerSource: "developer_assist",
    requiresEntitlement: false,
  },
  {
    surface: "admin_review",
    mode: "review",
    accountType: "admin",
    billableModelUsage: true,
    ledgerSource: "admin_review_assist",
    requiresEntitlement: false,
  },
  {
    surface: "openclaw_main",
    mode: "user",
    accountType: "buyer",
    billableModelUsage: true,
    ledgerSource: "role_usage",
    requiresEntitlement: true,
  },
  {
    surface: "openclaw_local",
    mode: "user",
    accountType: "buyer",
    billableModelUsage: true,
    ledgerSource: "role_usage",
    requiresEntitlement: true,
  },
];

export function getDijieDialogBillingPolicy(
  context: DijieDialogContext,
): DijieDialogBillingPolicy {
  const base = {
    billingAccountId: context.billingAccountId,
    payerAccountId: context.billingAccountId,
    metered: true as const,
    chargedBy: "system_platform" as const,
  };

  if (context.surface === "admin_review") {
    return {
      ...base,
      modelAllowed: true,
      billableModelUsage: true,
      ledgerSource: "admin_review_assist",
      requiresEntitlement: false,
      note: "审核助手费用归平台审核账号，不自动改变审核结论。",
    };
  }

  if (context.surface === "developer_center") {
    return {
      ...base,
      modelAllowed: true,
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
      note: "开发者中心 AI 开发助手费用归开发者账号，用于岗位包生成、能力匹配和上传前验收。",
    };
  }

  if (context.surface === "openclaw_local" && context.mode === "developer") {
    return {
      ...base,
      modelAllowed: true,
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
      note: "本地端开发者模式助手费用归开发者账号，只辅助岗位包生成和调试。",
    };
  }

  if (context.surface === "buyer_storefront") {
    return {
      ...base,
      modelAllowed: true,
      billableModelUsage: true,
      ledgerSource: "marketplace_assist",
      requiresEntitlement: false,
      note: "商城对话只做购买前咨询和入口引导；若调用模型，费用归当前登录账号，不写入岗位执行用量。",
    };
  }

  if (
    context.surface === "openclaw_main" ||
    (context.surface === "openclaw_local" && context.mode === "user")
  ) {
    return {
      ...base,
      modelAllowed: true,
      billableModelUsage: true,
      ledgerSource: "role_usage",
      requiresEntitlement: true,
      note:
        context.surface === "openclaw_main"
          ? "OpenClaw 主流程层进入正式岗位执行链路，必须校验授权、确认点、费用归属并写入岗位用量。"
          : "本地端使用者模式进入正式岗位执行链路，必须校验授权并写入岗位用量。",
    };
  }

  return {
    ...base,
    modelAllowed: true,
    billableModelUsage: true,
    ledgerSource: "user_assist",
    requiresEntitlement: false,
    note: "使用者中心普通助手费用归当前使用者账号，不写入岗位执行用量。",
  };
}
