import {
  normalizeDijieRoleProductMetadataFromProduct,
  type DijieRoleReviewState,
  type DijieRoleListingStatus,
} from "./role-product-metadata";
import { validateDijieRoleCapabilityIntegration } from "./role-capability-integration";
import {
  validateDijieRoleCategoryIntegration,
  type DijieRoleCategoryRegistry,
} from "./role-category-registry";
import type {
  DijieRoleListingStorageRecord,
  DijieStoredRoleReviewState,
} from "./role-listing-store";
import type { DijieRolePackageStorageRecord } from "./role-package-store";
import type { DijieCatalogItem } from "./role-skill-tool-planner";
import {
  createDijieAdminReviewDialogContext,
  type DijieDialogContext,
} from "./dialog-context";
import {
  centsPerMillionLabel,
  getDijieRoleTokenPricingPolicy,
  validateDijieRoleTokenPricingAgainstPlatformPolicy,
} from "./role-token-pricing-policy";

export type DijieReviewCenterQueryGraph = (query: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
}) => Promise<{ data?: unknown[] }>;

export type DijieReviewChecklistItem = {
  id:
    | "public_materials"
    | "usage_instructions"
    | "safety_summary"
    | "pricing_confirmation";
  title: string;
  description: string;
};

export type DijieReviewCheckStatus = "pass" | "warning" | "blocked";

export type DijieReviewCheckItem = {
  id: string;
  label: string;
  status: DijieReviewCheckStatus;
  note: string;
};

export type DijieReviewSummaryRow = {
  label: string;
  value: string;
  status?: DijieReviewCheckStatus;
};

export type DijieReviewPackageSummary = {
  manifest: DijieReviewSummaryRow[];
  requiredCapabilities: string[];
  skills: string[];
  templates: string[];
  validation: string[];
  readme: string;
  listing: string;
  files: string[];
  validationIssues: string[];
  packageDownload: {
    available: boolean;
    url: string | null;
  };
};

export type DijieReviewPricingSummary = {
  authorizationFee: string;
  modelUsageFee: string;
  platformExecutionFee: string;
  inputTokenFee: string;
  outputTokenFee: string;
  inputTokenMarkup: string;
  outputTokenMarkup: string;
  platformTokenCost: string;
  tokenPricingLimit: string;
  developerRevenue: string;
  hiddenFeeRisk: string;
  checks: DijieReviewCheckItem[];
};

export type DijieReviewQueueItem = {
  id: string;
  reviewId: string;
  title: string;
  subtitle: string | null;
  usageInstructions: string | null;
  categoryRef: string | null;
  developerName: string | null;
  packageId: string | null;
  packageVersion: string | null;
  reviewState: DijieRoleReviewState | DijieStoredRoleReviewState | "unknown";
  reviewStateLabel: string;
  listingStatus: DijieRoleListingStatus | "unknown";
  submittedAt: string | null;
  materialCompleteness: "待复核" | "已完整";
  safetySummary: "未命中敏感项" | "需处理";
  pricingAndBilling: "待确认" | "已配置";
  auditReadback: "脱敏";
  confirmationPoints: number;
  requiredCapabilities: string[];
  packageSummary: DijieReviewPackageSummary;
  capabilityChecks: DijieReviewCheckItem[];
  safetyChecks: DijieReviewCheckItem[];
  pricingSummary: DijieReviewPricingSummary;
  specialtyChecks: DijieReviewCheckItem[];
  allowedActions: string[];
  statusReason: string;
  priceLabel: string | null;
  evaluations: {
    roleStandard: "pending" | "pass" | "needs_changes" | "reject";
    safetyCompliance: "pending" | "pass" | "needs_changes" | "reject";
    pricingReasonability: "pending" | "pass" | "needs_changes" | "reject";
  };
  records: string[];
  finalNote: string | null;
};

type DijieReviewEvaluationDecision =
  DijieReviewQueueItem["evaluations"][keyof DijieReviewQueueItem["evaluations"]];

type DijieReviewEvaluationSet = DijieReviewQueueItem["evaluations"];

export type DijieReviewCenterReadModel = {
  title: "审核中心";
  sampleRoleTitle: string | null;
  dialogContext: DijieDialogContext | null;
  statusPanel: {
    pendingRoles: number;
    materialCompleteness: "待复核" | "已完整";
    safetySummary: "未命中敏感项" | "需处理";
    pricingAndBilling: "待确认" | "已配置";
    auditReadback: "脱敏";
    confirmationPoints: number;
  };
  reviewChecklist: DijieReviewChecklistItem[];
  queue: DijieReviewQueueItem[];
  emptyState: string | null;
};

type UnknownRecord = Record<string, unknown>;

const REVIEW_CHECKLIST: DijieReviewChecklistItem[] = [
  {
    id: "public_materials",
    title: "公开材料",
    description: "岗位介绍、业务场景、展示文案、分类。",
  },
  {
    id: "usage_instructions",
    title: "使用规范",
    description: "使用者应准备的材料、发起任务方式、失败和确认点。",
  },
  {
    id: "safety_summary",
    title: "安全摘要",
    description: "能力需求、敏感字段、审计回读。",
  },
  {
    id: "pricing_confirmation",
    title: "价格确认",
    description: "授权费、平台执行费用口径、确认点。",
  },
];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roleMetadata(product: UnknownRecord): UnknownRecord {
  return asRecord(asRecord(product.metadata).dijieRole);
}

function sellerName(product: UnknownRecord): string | null {
  return nonEmptyString(asRecord(product.seller).name) ?? null;
}

function roleReviewState(
  role: UnknownRecord,
): DijieRoleReviewState | "unknown" {
  const raw =
    nonEmptyString(role.reviewState) ?? nonEmptyString(role.review_state);
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "approved" ||
    raw === "rejected"
  ) {
    return raw;
  }
  return "unknown";
}

function storedRoleReviewState(
  role: UnknownRecord,
): DijieStoredRoleReviewState | "unknown" {
  const raw =
    nonEmptyString(role.reviewState) ?? nonEmptyString(role.review_state);
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "needs_changes" ||
    raw === "approved" ||
    raw === "rejected"
  ) {
    return raw;
  }
  return "unknown";
}

function roleListingStatus(
  role: UnknownRecord,
): DijieRoleListingStatus | "unknown" {
  const raw =
    nonEmptyString(role.listingStatus) ?? nonEmptyString(role.listing_status);
  if (
    raw === "draft" ||
    raw === "proposed" ||
    raw === "published" ||
    raw === "delisted" ||
    raw === "archived"
  ) {
    return raw;
  }
  return "unknown";
}

function reviewStateLabel(state: DijieReviewQueueItem["reviewState"]): string {
  switch (state) {
    case "submitted":
      return "待审核";
    case "approved":
      return "已通过";
    case "needs_changes":
      return "要求补充";
    case "rejected":
      return "已驳回";
    case "draft":
      return "草稿";
    default:
      return "待复核";
  }
}

function issueHintsContainSafetyProblem(issues: string[]): boolean {
  const sensitiveHints = [
    "secret",
    "token",
    "provider",
    "local absolute paths",
    "private execution",
    "prompt",
    "chat context",
  ];
  return issues.some((issue) =>
    sensitiveHints.some((hint) => issue.toLowerCase().includes(hint)),
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function uniqueStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) => asStringArray(value))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function valueLabel(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return "-";
}

function numberField(
  record: UnknownRecord,
  ...fields: string[]
): number | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function centsLabel(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未配置";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function textContainsAny(value: string, needles: string[]): boolean {
  const text = value.toLowerCase();
  return needles.some((needle) => text.includes(needle.toLowerCase()));
}

function packageFilesByPath(
  packageRecord?: DijieRolePackageStorageRecord,
): Map<string, string> {
  const files = new Map<string, string>();
  for (const file of packageRecord?.package_files ?? []) {
    if (file.content !== undefined) {
      files.set(file.path, file.content);
    }
  }
  return files;
}

function filePathsFromPackage(
  packageRecord?: DijieRolePackageStorageRecord,
): string[] {
  return (packageRecord?.file_manifest ?? [])
    .map((file) => file.path)
    .filter(
      (path): path is string =>
        typeof path === "string" && Boolean(path.trim()),
    );
}

function summarizeText(value: string | undefined, fallback: string): string {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 180
    ? `${normalized.slice(0, 180)}...`
    : normalized;
}

function packageSummary(input: {
  role: UnknownRecord;
  packageRecord?: DijieRolePackageStorageRecord;
}): DijieReviewPackageSummary {
  const manifest = asRecord(input.role.manifest_summary);
  const packageManifest = asRecord(input.packageRecord?.manifest_summary);
  const filesByPath = packageFilesByPath(input.packageRecord);
  const filePaths = filePathsFromPackage(input.packageRecord);
  const requiredCapabilities = uniqueStrings([
    manifest.requiredCapabilities,
    manifest.required_capabilities,
    packageManifest.requiredCapabilities,
    packageManifest.required_capabilities,
  ]);
  const skills = filePaths.filter((path) =>
    /(^|\/)(skills?|skill)(\/|[-_.])/iu.test(path),
  );
  const templates = filePaths.filter((path) =>
    /(^|\/)(templates?|template)(\/|[-_.])/iu.test(path),
  );
  const validation = [
    ...filePaths.filter((path) =>
      /(^|\/)(validation|tests?|smoke|checklists?)(\/|[-_.])/iu.test(path),
    ),
    ...asStringArray(input.packageRecord?.validation_issues),
  ];

  return {
    manifest: [
      {
        label: "manifest",
        value: valueLabel(manifest.entrypoint ?? packageManifest.entrypoint),
      },
      {
        label: "manifestRef",
        value: valueLabel(
          packageManifest.manifestRef ?? packageManifest.manifest_ref,
        ),
      },
      {
        label: "sandbox",
        value: valueLabel(manifest.sandbox ?? packageManifest.sandbox),
      },
      {
        label: "inputs",
        value:
          uniqueStrings([manifest.inputs, packageManifest.inputs]).join("、") ||
          "-",
      },
      {
        label: "outputs",
        value:
          uniqueStrings([manifest.outputs, packageManifest.outputs]).join(
            "、",
          ) || "-",
      },
    ],
    requiredCapabilities,
    skills: skills.length > 0 ? skills : ["未声明 skills 文件"],
    templates: templates.length > 0 ? templates : ["未声明 templates 文件"],
    validation:
      validation.length > 0 ? validation : ["未声明 validation/smoke 文件"],
    readme: summarizeText(
      filesByPath.get("role_package/README.md"),
      "未提供 README 摘要",
    ),
    listing: summarizeText(
      filesByPath.get("role_package/listing.md"),
      "未提供 listing 摘要",
    ),
    files: filePaths.slice(0, 12),
    validationIssues: asStringArray(input.packageRecord?.validation_issues),
    packageDownload: {
      available: Boolean(input.packageRecord),
      url: input.packageRecord
        ? `/vendor/dijie/role-packages/${encodeURIComponent(
            input.packageRecord.package_id,
          )}/download?version=${encodeURIComponent(input.packageRecord.package_version)}`
        : null,
    },
  };
}

function check(
  status: DijieReviewCheckStatus,
  id: string,
  label: string,
  note: string,
): DijieReviewCheckItem {
  return { id, label, status, note };
}

function hasSensitiveReviewKeys(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasSensitiveReviewKeys);
  }

  return Object.entries(value as UnknownRecord).some(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("raw") ||
      normalizedKey.includes("prompt") ||
      normalizedKey.includes("history") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("api_key") ||
      normalizedKey.includes("providerkey") ||
      normalizedKey.includes("provider_key") ||
      normalizedKey.includes("authtoken") ||
      normalizedKey.includes("auth_token") ||
      normalizedKey.includes("accesstoken") ||
      normalizedKey.includes("access_token") ||
      normalizedKey.includes("rawtoken") ||
      normalizedKey.includes("raw_token")
    ) {
      return true;
    }
    return hasSensitiveReviewKeys(nestedValue);
  });
}

function hasLocalPathValue(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\\/g, "/");
    return (
      normalized.startsWith("/") ||
      normalized.startsWith("~") ||
      /^[A-Za-z]:\//.test(normalized) ||
      normalized.startsWith("file://") ||
      normalized.split("/").includes("..")
    );
  }
  if (Array.isArray(value)) {
    return value.some(hasLocalPathValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).some(hasLocalPathValue);
  }
  return false;
}

function hasInternalIdValue(value: unknown): boolean {
  if (typeof value === "string") {
    return /\b(?:exec|cus|ent|ord|ordgrp|wallet|device|workspace|gateway|audit|settlement)_[A-Za-z0-9][A-Za-z0-9_-]*\b/i.test(
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.some(hasInternalIdValue);
  }
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).some(hasInternalIdValue);
  }
  return false;
}

function usageInstructionText(role: UnknownRecord): string | null {
  return (
    nonEmptyString(role.usage_instructions) ??
    nonEmptyString(role.usageInstructions) ??
    null
  );
}

function hasUsableInstructions(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return (
    value.length >= 10 &&
    textContainsAny(value, [
      "使用",
      "输入",
      "上传",
      "提供",
      "资料",
      "材料",
      "确认",
      "失败",
      "窗口",
      "任务",
    ])
  );
}

function capabilityChecks(
  requiredCapabilities: string[],
  capabilities: string[],
  usageInstructions: string | null,
): DijieReviewCheckItem[] {
  const declared = [...new Set([...requiredCapabilities, ...capabilities])];
  return [
    check(
      declared.length > 0 ? "pass" : "blocked",
      "required_capabilities",
      "能力声明",
      declared.length > 0 ? declared.join("、") : "未声明岗位运行能力。",
    ),
    check(
      declared.some((item) =>
        textContainsAny(item, [
          "image",
          "vision",
          "图片",
          "image.read",
          "image.understand",
        ]),
      )
        ? "pass"
        : "warning",
      "image_understanding",
      "图片理解",
      "美工岗位需要声明图片读取或图片理解能力。",
    ),
    check(
      declared.some((item) =>
        textContainsAny(item, [
          "artifact",
          "audit",
          "document",
          "report",
          "artifact.write",
        ]),
      )
        ? "pass"
        : "warning",
      "artifact_readback",
      "产物回写",
      "岗位需要声明 artifact/audit 回写能力，方便使用者中心回读。",
    ),
    check(
      hasUsableInstructions(usageInstructions) ? "pass" : "blocked",
      "usage_instructions",
      "使用规范",
      hasUsableInstructions(usageInstructions)
        ? "已说明使用者应提供的材料或任务发起方式。"
        : "必须说明使用者应准备哪些材料、在使用窗口如何发起任务，以及失败/确认边界。",
    ),
  ];
}

function safetyChecks(input: {
  role: UnknownRecord;
  packageRecord?: DijieRolePackageStorageRecord;
  requiredCapabilities: string[];
  catalogItems?: DijieCatalogItem[];
  categoryRegistry?: DijieRoleCategoryRegistry;
}): DijieReviewCheckItem[] {
  const roleManifest = asRecord(input.role.manifest_summary);
  const packageManifest = asRecord(input.packageRecord?.manifest_summary);
  const roleCategoryRef =
    nonEmptyString(input.role.category_ref) ??
    nonEmptyString(roleManifest.categoryRef) ??
    nonEmptyString(roleManifest.category_ref) ??
    nonEmptyString(packageManifest.categoryRef) ??
    nonEmptyString(packageManifest.category_ref);
  const capabilityIntegration = validateDijieRoleCapabilityIntegration({
    categoryRef: roleCategoryRef,
    category: nonEmptyString(input.role.category),
    manifestSummary:
      Object.keys(roleManifest).length > 0 ? roleManifest : packageManifest,
    categoryRegistry: input.categoryRegistry,
  });
  const scanTarget = {
    listing: input.role,
    manifest: input.packageRecord?.manifest_summary,
    files: input.packageRecord?.package_files?.map((file) => ({
      path: file.path,
      content: file.content,
    })),
  };
  const sensitiveBlocked = hasSensitiveReviewKeys(scanTarget);
  const localPathBlocked = hasLocalPathValue(scanTarget);
  const internalIdBlocked = hasInternalIdValue(scanTarget);
  const riskyCapabilities = input.requiredCapabilities.filter((capability) =>
    textContainsAny(capability, [
      "networked",
      "shell",
      "admin",
      "token",
      "secret",
      "root",
    ]),
  );
  const platformDatabaseRequested = input.requiredCapabilities.some((capability) =>
    textContainsAny(capability, ["platform.database", "platform.db", "medusa.db", "mercur.db"]),
  );

  return [
    check(
      sensitiveBlocked ? "blocked" : "pass",
      "sensitive_fields",
      "敏感字段",
      sensitiveBlocked
        ? "命中 secret/token/raw/prompt/history 等字段。"
        : "未命中敏感字段。",
    ),
    check(
      localPathBlocked ? "blocked" : "pass",
      "local_paths",
      "本地路径",
      localPathBlocked
        ? "命中本地绝对路径或不安全相对路径。"
        : "未命中本地路径。",
    ),
    check(
      internalIdBlocked ? "blocked" : "pass",
      "internal_ids",
      "内部 ID",
      internalIdBlocked
        ? "命中 execution/order/customer 等内部 ID。"
        : "未命中内部业务 ID。",
    ),
    check(
      riskyCapabilities.length > 0 ? "warning" : "pass",
      "permission_scope",
      "越权权限",
      riskyCapabilities.length > 0
        ? `需人工复核：${riskyCapabilities.join("、")}`
        : "未发现明显越权能力声明。",
    ),
    check(
      platformDatabaseRequested ? "blocked" : "pass",
      "platform_database_boundary",
      "平台数据库边界",
      platformDatabaseRequested
        ? "岗位不能直接调用平台业务数据库；必须改为独立且已审核的 adapter。"
        : "未请求平台业务数据库直连能力。",
    ),
    check(
      capabilityIntegration.ok ? "pass" : "blocked",
      "catalog_binding_review",
      "基础品类包审核",
      capabilityIntegration.ok
        ? `已继承 ${capabilityIntegration.inheritedCatalogRefs?.length ?? 0} 个平台能力引用。`
        : capabilityIntegration.error ??
          "岗位上架前必须绑定 approved 平台品类和基础品类包。",
    ),
  ];
}

function categoryCapabilityChecks(input: {
  role: UnknownRecord;
  packageRecord?: DijieRolePackageStorageRecord;
  categoryRegistry?: DijieRoleCategoryRegistry;
}): DijieReviewCheckItem[] {
  const roleManifest = asRecord(input.role.manifest_summary);
  const packageManifest = asRecord(input.packageRecord?.manifest_summary);
  const roleCategoryRef =
    nonEmptyString(input.role.category_ref) ??
    nonEmptyString(roleManifest.categoryRef) ??
    nonEmptyString(roleManifest.category_ref) ??
    nonEmptyString(packageManifest.categoryRef) ??
    nonEmptyString(packageManifest.category_ref);
  const categoryGate = validateDijieRoleCategoryIntegration({
    categoryRef: roleCategoryRef,
    category: nonEmptyString(input.role.category),
    manifestSummary:
      Object.keys(roleManifest).length > 0 ? roleManifest : packageManifest,
    registry: input.categoryRegistry,
  });

  return [
    check(
      categoryGate.ok ? "pass" : "blocked",
      "platform_category",
      "平台品类",
      categoryGate.ok
        ? `已绑定平台品类：${categoryGate.category?.name ?? roleCategoryRef ?? "unknown"}；继承 ${categoryGate.inheritedCatalogRefs.length} 个能力引用。`
        : categoryGate.error ?? "岗位必须先选择平台已启用的品类。",
    ),
  ];
}

function pricingSummary(role: UnknownRecord): DijieReviewPricingSummary {
  const pricing = asRecord(role.pricing);
  const roleTokenPricing = asRecord(
    role.role_token_pricing ?? role.roleTokenPricing,
  );
  const tokenPolicy = getDijieRoleTokenPricingPolicy();
  const tokenPolicyCheck =
    validateDijieRoleTokenPricingAgainstPlatformPolicy(roleTokenPricing);
  const authorizationFeeCents = numberField(
    pricing,
    "authorizationFeeCents",
    "authorization_fee_cents",
    "amountCents",
    "amount_cents",
  );
  const developerReceivableCents = numberField(
    pricing,
    "developerReceivableCents",
    "developer_receivable_cents",
  );
  const inputTokenCents = numberField(
    roleTokenPricing,
    "inputTokenCentsPerMillion",
    "input_token_cents_per_million",
    "inputCentsPerMillion",
    "input_cents_per_million",
  );
  const outputTokenCents = numberField(
    roleTokenPricing,
    "outputTokenCentsPerMillion",
    "output_token_cents_per_million",
    "outputCentsPerMillion",
    "output_cents_per_million",
  );
  const authorizationCurrency = nonEmptyString(pricing.currency) ?? "CNY";
  const authorizationPlatformFeeBps = numberField(
    pricing,
    "platformFeeBps",
    "platform_fee_bps",
  );
  const tokenPlatformFeeBps = numberField(
    roleTokenPricing,
    "platformFeeBps",
    "platform_fee_bps",
  );
  const developerReceivableBps = numberField(
    pricing,
    "developerReceivableBps",
    "developer_receivable_bps",
  );
  const tokenDeveloperReceivableBps = numberField(
    roleTokenPricing,
    "developerReceivableBps",
    "developer_receivable_bps",
  );

  const authorizationFee = centsLabel(authorizationFeeCents);
  const inputTokenFee =
    inputTokenCents === undefined
      ? "未配置"
      : centsPerMillionLabel(inputTokenCents);
  const outputTokenFee =
    outputTokenCents === undefined
      ? "未配置"
      : centsPerMillionLabel(outputTokenCents);
  const inputTokenMarkup =
    inputTokenCents === undefined || tokenPolicy.inputCostCentsPerMillion === 0
      ? "未配置"
      : `${(inputTokenCents / tokenPolicy.inputCostCentsPerMillion).toFixed(2)}x`;
  const outputTokenMarkup =
    outputTokenCents === undefined ||
    tokenPolicy.outputCostCentsPerMillion === 0
      ? "未配置"
      : `${(outputTokenCents / tokenPolicy.outputCostCentsPerMillion).toFixed(2)}x`;
  const platformTokenCost = `输入 ${centsPerMillionLabel(
    tokenPolicy.inputCostCentsPerMillion,
  )} / 输出 ${centsPerMillionLabel(tokenPolicy.outputCostCentsPerMillion)}`;
  const tokenPricingLimit = `成本 ${tokenPolicy.maxMarkupMultiplier}x 内`;
  const platformExecutionFee =
    inputTokenCents === undefined && outputTokenCents === undefined
      ? "未配置"
      : `输入 ${inputTokenFee} / 输出 ${outputTokenFee}`;
  const developerRevenue =
    developerReceivableCents !== undefined
      ? centsLabel(developerReceivableCents)
      : developerReceivableBps !== undefined
        ? `${developerReceivableBps} bps`
        : "未配置";
  const hiddenFeeRisk =
    authorizationFeeCents === undefined ||
    inputTokenCents === undefined ||
    outputTokenCents === undefined
      ? "需补充费用口径"
      : "未发现隐藏收费";

  return {
    authorizationFee,
    modelUsageFee: platformExecutionFee,
    platformExecutionFee,
    inputTokenFee,
    outputTokenFee,
    inputTokenMarkup,
    outputTokenMarkup,
    platformTokenCost,
    tokenPricingLimit,
    developerRevenue,
    hiddenFeeRisk,
    checks: [
      check(
        authorizationCurrency === "CNY" && authorizationFeeCents !== undefined
          ? "pass"
          : "blocked",
        "authorization_fee",
        "授权费",
        authorizationFee,
      ),
      check(
        tokenPolicyCheck.ok ? "pass" : "blocked",
        "model_usage_fee",
        "Token 使用费",
        tokenPolicyCheck.ok ? platformExecutionFee : tokenPolicyCheck.error,
      ),
      check(
        tokenPolicyCheck.ok ? "pass" : "blocked",
        "token_pricing_limit",
        "平台硬限制",
        tokenPolicyCheck.ok
          ? `${tokenPricingLimit}；输入 ${inputTokenMarkup}，输出 ${outputTokenMarkup}`
          : tokenPolicyCheck.error,
      ),
      check(
        authorizationPlatformFeeBps === 0 &&
          tokenPlatformFeeBps === 0 &&
          developerReceivableBps === 10000 &&
          tokenDeveloperReceivableBps === 10000
          ? "pass"
          : "warning",
        "developer_revenue",
        "开发者收益",
        developerRevenue,
      ),
      check(
        hiddenFeeRisk === "未发现隐藏收费" ? "pass" : "warning",
        "hidden_fee_risk",
        "隐藏收费风险",
        hiddenFeeRisk,
      ),
    ],
  };
}

function specialtyChecks(input: {
  title: string;
  description?: string | null;
  usageInstructions?: string | null;
  requiredCapabilities: string[];
  packageSummary: DijieReviewPackageSummary;
}): DijieReviewCheckItem[] {
  const combinedText = [
    input.title,
    input.description ?? "",
    input.usageInstructions ?? "",
    input.requiredCapabilities.join(" "),
    input.packageSummary.readme,
    input.packageSummary.listing,
    input.packageSummary.files.join(" "),
  ].join(" ");
  const isDesignRole = textContainsAny(combinedText, [
    "美工",
    "设计",
    "主图",
    "详情页",
    "商品图",
    "image",
  ]);
  if (!isDesignRole) {
    return [];
  }

  return [
    check(
      hasUsableInstructions(input.usageInstructions ?? null)
        ? "pass"
        : "blocked",
      "designer_usage_instructions",
      "使用规范",
      "美工岗位必须说明使用窗口里应提交哪些商品图、品牌、卖点、平台规则和确认标准。",
    ),
    check(
      textContainsAny(combinedText, [
        "商品图",
        "主图",
        "图片输入",
        "image input",
        "image.read",
        "image.upload",
      ])
        ? "pass"
        : "blocked",
      "product_image_input",
      "商品图输入",
      "美工岗位必须说明商品图/主图输入要求。",
    ),
    check(
      textContainsAny(combinedText, [
        "图片理解",
        "图片读取",
        "视觉理解",
        "巡检",
        "image.inspect",
        "image.understand",
        "vision",
        "image.read",
      ])
        ? "pass"
        : "blocked",
      "image_understanding",
      "图片理解",
      "美工岗位必须声明图片理解或巡检能力。",
    ),
    check(
      textContainsAny(combinedText, [
        "图片生成",
        "设计输出",
        "image.generate",
        "主图方案",
        "详情页优化",
      ])
        ? "pass"
        : "blocked",
      "design_output",
      "图片生成或设计输出",
      "美工岗位必须声明图片生成产物或设计方案文本输出。",
    ),
    check(
      textContainsAny(combinedText, [
        "artifact",
        "audit",
        "回写",
        "产物",
        "报告",
        "清单",
      ])
        ? "pass"
        : "blocked",
      "artifact_readback",
      "artifact 回写",
      "美工岗位必须说明 artifact/audit 回写要求。",
    ),
    check(
      textContainsAny(combinedText, [
        "失败",
        "缺输入",
        "capability_missing",
        "input_required",
        "no_artifact",
      ])
        ? "pass"
        : "warning",
      "failure_handling",
      "失败处理",
      "建议明确缺输入、缺能力和无产物时的失败状态。",
    ),
  ];
}

function isApprovedPublishedReview(item: {
  reviewState: DijieReviewQueueItem["reviewState"];
  listingStatus: DijieReviewQueueItem["listingStatus"];
}): boolean {
  return item.reviewState === "approved" && item.listingStatus === "published";
}

function publishedReviewCheckItems(
  item: {
    reviewState: DijieReviewQueueItem["reviewState"];
    listingStatus: DijieReviewQueueItem["listingStatus"];
  },
  checks: DijieReviewCheckItem[],
): DijieReviewCheckItem[] {
  if (!isApprovedPublishedReview(item)) {
    return checks;
  }

  return checks.map((checkItem) =>
    checkItem.status === "blocked"
      ? {
          ...checkItem,
          status: "warning",
          note: `已通过后复核建议：${checkItem.note}`,
        }
      : checkItem,
  );
}

function allowedActionsForItem(item: {
  reviewState: DijieReviewQueueItem["reviewState"];
  listingStatus: DijieReviewQueueItem["listingStatus"];
  evaluations: DijieReviewQueueItem["evaluations"];
  specialtyChecks: DijieReviewCheckItem[];
  safetyChecks: DijieReviewCheckItem[];
  pricingSummary: DijieReviewPricingSummary;
}): string[] {
  if (item.reviewState !== "submitted" || item.listingStatus !== "proposed") {
    return [];
  }
  const actions = ["save_evaluations"];
  const decisions = Object.values(item.evaluations);
  const hasBlockingChecks = [
    ...item.specialtyChecks,
    ...item.safetyChecks,
    ...item.pricingSummary.checks,
  ].some((checkItem) => checkItem.status === "blocked");
  if (
    decisions.every((decision) => decision === "pass") &&
    !hasBlockingChecks
  ) {
    actions.push("finalize_approved");
  }
  if (decisions.some((decision) => decision === "needs_changes")) {
    actions.push("finalize_needs_changes");
  }
  if (decisions.some((decision) => decision === "reject")) {
    actions.push("finalize_rejected");
  }
  return actions;
}

function statusReasonForItem(item: {
  reviewState: DijieReviewQueueItem["reviewState"];
  listingStatus: DijieReviewQueueItem["listingStatus"];
  specialtyChecks: DijieReviewCheckItem[];
  safetyChecks: DijieReviewCheckItem[];
  pricingSummary: DijieReviewPricingSummary;
}): string {
  const blockers = [
    ...item.specialtyChecks,
    ...item.safetyChecks,
    ...item.pricingSummary.checks,
  ].filter((checkItem) => checkItem.status === "blocked");
  if (blockers.length > 0) {
    return `需处理：${blockers.map((checkItem) => checkItem.label).join("、")}`;
  }
  if (isApprovedPublishedReview(item)) {
    const warnings = [
      ...item.specialtyChecks,
      ...item.safetyChecks,
      ...item.pricingSummary.checks,
    ].filter((checkItem) => checkItem.status === "warning");
    if (warnings.length > 0) {
      return `已通过；复核建议：${warnings
        .map((checkItem) => checkItem.label)
        .join("、")}`;
    }
  }
  if (item.reviewState === "submitted" || item.listingStatus === "proposed") {
    return "已进入人工审核，可保存三项评估后完成最终动作。";
  }
  return reviewStateLabel(item.reviewState);
}

function reviewRecords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      const record = asRecord(entry);
      const action = nonEmptyString(record.action);
      const summary = nonEmptyString(record.summary);
      if (!action && !summary) {
        return undefined;
      }
      return summary ? `${action ?? "审核记录"}：${summary}` : action;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function reviewDecision(value: unknown): DijieReviewEvaluationDecision {
  return value === "pass" || value === "needs_changes" || value === "reject"
    ? value
    : "pending";
}

function reviewDetails(roleId: string, reviewInput?: unknown): {
  reviewId: string;
  evaluations: DijieReviewEvaluationSet;
  records: string[];
  finalNote: string | null;
} {
  const review = asRecord(reviewInput);
  return {
    reviewId: `review_${roleId}`,
    evaluations: {
      roleStandard: reviewDecision(review.role_standard_decision),
      safetyCompliance: reviewDecision(review.safety_compliance_decision),
      pricingReasonability: reviewDecision(review.pricing_reasonability_decision),
    },
    records: reviewRecords(review.records),
    finalNote: nonEmptyString(review.summary) ?? null,
  };
}

function priceLabelFromPricing(value: unknown): string | null {
  const pricing = asRecord(value);
  const cents = pricing.authorizationFeeCents;
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return null;
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function isStoredRoleListing(
  value: UnknownRecord,
): value is DijieRoleListingStorageRecord & {
  id: string;
} {
  return Boolean(
    nonEmptyString(value.id) &&
    nonEmptyString(value.package_id) &&
    nonEmptyString(value.package_version) &&
    nonEmptyString(value.title),
  );
}

function createStoredReviewQueueItem(
  roleInput: unknown,
  reviewsByRoleId: Map<string, unknown> = new Map(),
  packagesByListingPackage: Map<
    string,
    DijieRolePackageStorageRecord
  > = new Map(),
  options: {
    catalogItems?: DijieCatalogItem[];
    categoryRegistry?: DijieRoleCategoryRegistry;
  } = {},
): DijieReviewQueueItem | undefined {
  const role = asRecord(roleInput);
  if (!isStoredRoleListing(role)) {
    return undefined;
  }

  const reviewState = storedRoleReviewState(role);
  const listingStatus = roleListingStatus(role);
  const manifest = asRecord(role.manifest_summary);
  const requiredCapabilities = uniqueStrings([
    manifest.requiredCapabilities,
    manifest.required_capabilities,
  ]);
  const pricing = asRecord(role.pricing);
  const hasPricing = Object.keys(pricing).length > 0;
  const usageInstructions = usageInstructionText(role);
  const review = reviewDetails(role.id, reviewsByRoleId.get(role.id));
  const packageRecord = packagesByListingPackage.get(
    `${role.package_id}:${role.package_version}`,
  );
  const pkgSummary = packageSummary({ role, packageRecord });
  const capChecks = [
    ...categoryCapabilityChecks({
      role,
      packageRecord,
      categoryRegistry: options.categoryRegistry,
    }),
    ...capabilityChecks(
      requiredCapabilities,
      asStringArray(role.capabilities),
      usageInstructions,
    ),
  ];
  const secChecks = safetyChecks({
    role,
    packageRecord,
    requiredCapabilities,
    catalogItems: options.catalogItems,
    categoryRegistry: options.categoryRegistry,
  });
  const priceSummary = pricingSummary(role);
  const designChecks = specialtyChecks({
    title: role.title,
    description: nonEmptyString(role.description) ?? null,
    usageInstructions,
    requiredCapabilities,
    packageSummary: pkgSummary,
  });
  const displayCapChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    capChecks,
  );
  const displaySecChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    secChecks,
  );
  const displayPriceSummary = {
    ...priceSummary,
    checks: publishedReviewCheckItems(
      { reviewState, listingStatus },
      priceSummary.checks,
    ),
  };
  const displayDesignChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    designChecks,
  );
  const baseItem = {
    reviewState,
    listingStatus,
    evaluations: review.evaluations,
    specialtyChecks: displayDesignChecks,
    safetyChecks: displaySecChecks,
    pricingSummary: displayPriceSummary,
  };

  return {
    id: role.id,
    reviewId: review.reviewId,
    title: role.title,
    subtitle: nonEmptyString(role.subtitle) ?? null,
    usageInstructions,
    categoryRef:
      nonEmptyString(role.category_ref) ??
      nonEmptyString(manifest.categoryRef) ??
      nonEmptyString(manifest.category_ref) ??
      null,
    developerName: nonEmptyString(role.developer_ref) ?? null,
    packageId: role.package_id,
    packageVersion: role.package_version,
    reviewState,
    reviewStateLabel: reviewStateLabel(reviewState),
    listingStatus,
    submittedAt:
      role.submitted_at instanceof Date
        ? role.submitted_at.toISOString()
        : (nonEmptyString(role.submitted_at) ?? null),
    materialCompleteness:
      pkgSummary.validationIssues.length > 0 || pkgSummary.files.length === 0
        ? "待复核"
        : "已完整",
    safetySummary: secChecks.some((item) => item.status === "blocked")
      ? "需处理"
      : "未命中敏感项",
    pricingAndBilling:
      hasPricing && priceSummary.checks.every((item) => item.status === "pass")
        ? "已配置"
        : "待确认",
    auditReadback: "脱敏",
    confirmationPoints: Number.isInteger(role.confirmation_points)
      ? Math.max(0, Number(role.confirmation_points))
      : 0,
    requiredCapabilities,
    packageSummary: pkgSummary,
    capabilityChecks: displayCapChecks,
    safetyChecks: displaySecChecks,
    pricingSummary: displayPriceSummary,
    specialtyChecks: displayDesignChecks,
    allowedActions: allowedActionsForItem(baseItem),
    statusReason: statusReasonForItem(baseItem),
    priceLabel: priceLabelFromPricing(role.pricing),
    evaluations: review.evaluations,
    records: review.records,
    finalNote: review.finalNote,
  };
}

function createReviewQueueItem(
  productInput: unknown,
  reviewsByRoleId: Map<string, unknown> = new Map(),
  packagesByListingPackage: Map<
    string,
    DijieRolePackageStorageRecord
  > = new Map(),
  options: {
    catalogItems?: DijieCatalogItem[];
    categoryRegistry?: DijieRoleCategoryRegistry;
  } = {},
): DijieReviewQueueItem | undefined {
  const storedItem = createStoredReviewQueueItem(
    productInput,
    reviewsByRoleId,
    packagesByListingPackage,
    options,
  );
  if (storedItem) {
    return storedItem;
  }

  const product = asRecord(productInput);
  const id = nonEmptyString(product.id);
  const role = roleMetadata(product);

  if (!id || Object.keys(role).length === 0) {
    return undefined;
  }

  const normalized = normalizeDijieRoleProductMetadataFromProduct(product);
  const issues = normalized.ok ? [] : normalized.issues;
  const reviewState = normalized.ok
    ? normalized.value.reviewState
    : roleReviewState(role);
  const listingStatus = normalized.ok
    ? normalized.value.listingStatus
    : roleListingStatus(role);
  const requiredCapabilities = normalized.ok
    ? (normalized.value.manifestSummary.requiredCapabilities ?? [])
    : [];

  const hasMaterialIssues = issues.length > 0;
  const hasSafetyIssues = issueHintsContainSafetyProblem(issues);
  const packageId = normalized.ok
    ? normalized.value.packageId
    : (nonEmptyString(role.packageId) ?? null);
  const packageVersion = normalized.ok
    ? normalized.value.packageVersion
    : (nonEmptyString(role.packageVersion) ?? null);
  const packageRecord =
    packageId && packageVersion
      ? packagesByListingPackage.get(`${packageId}:${packageVersion}`)
      : undefined;
  const roleForSummary = {
    ...role,
    manifest_summary: normalized.ok
      ? normalized.value.manifestSummary
      : asRecord(role.manifestSummary ?? role.manifest_summary),
    pricing: normalized.ok ? normalized.value.pricing : role.pricing,
    role_token_pricing: normalized.ok
      ? normalized.value.roleTokenPricing
      : role.roleTokenPricing,
    capabilities: normalized.ok
      ? normalized.value.capabilities
      : role.capabilities,
    usage_instructions: normalized.ok
      ? normalized.value.usageInstructions
      : usageInstructionText(role),
  };
  const usageInstructions = usageInstructionText(roleForSummary);
  const pkgSummary = packageSummary({ role: roleForSummary, packageRecord });
  const capChecks = [
    ...categoryCapabilityChecks({
      role: roleForSummary,
      packageRecord,
      categoryRegistry: options.categoryRegistry,
    }),
    ...capabilityChecks(
      requiredCapabilities,
      asStringArray(roleForSummary.capabilities),
      usageInstructions,
    ),
  ];
  const secChecks = safetyChecks({
    role: roleForSummary,
    packageRecord,
    requiredCapabilities,
    catalogItems: options.catalogItems,
    categoryRegistry: options.categoryRegistry,
  });
  const priceSummary = pricingSummary(roleForSummary);
  const designChecks = specialtyChecks({
    title:
      (normalized.ok ? normalized.value.title : nonEmptyString(role.title)) ??
      nonEmptyString(product.title) ??
      "未命名岗位",
    description:
      (normalized.ok
        ? normalized.value.description
        : nonEmptyString(role.description)) ??
      nonEmptyString(product.description) ??
      null,
    usageInstructions,
    requiredCapabilities,
    packageSummary: pkgSummary,
  });
  const review = reviewDetails(id, reviewsByRoleId.get(id));
  const displayCapChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    capChecks,
  );
  const displaySecChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    secChecks,
  );
  const displayPriceSummary = {
    ...priceSummary,
    checks: publishedReviewCheckItems(
      { reviewState, listingStatus },
      priceSummary.checks,
    ),
  };
  const displayDesignChecks = publishedReviewCheckItems(
    { reviewState, listingStatus },
    designChecks,
  );
  const baseItem = {
    reviewState,
    listingStatus,
    evaluations: review.evaluations,
    specialtyChecks: displayDesignChecks,
    safetyChecks: displaySecChecks,
    pricingSummary: displayPriceSummary,
  };

  return {
    id,
    reviewId: review.reviewId,
    title:
      (normalized.ok ? normalized.value.title : nonEmptyString(role.title)) ??
      nonEmptyString(product.title) ??
      "未命名岗位",
    subtitle:
      (normalized.ok
        ? normalized.value.subtitle
        : nonEmptyString(role.subtitle)) ??
      nonEmptyString(product.subtitle) ??
      null,
    usageInstructions,
    categoryRef:
      (normalized.ok
        ? normalized.value.manifestSummary.categoryRef
        : nonEmptyString(role.categoryRef) ?? nonEmptyString(role.category_ref)) ?? null,
    developerName: sellerName(product),
    packageId,
    packageVersion,
    reviewState,
    reviewStateLabel: reviewStateLabel(reviewState),
    listingStatus,
    submittedAt: null,
    materialCompleteness: hasMaterialIssues ? "待复核" : "已完整",
    safetySummary: hasSafetyIssues ? "需处理" : "未命中敏感项",
    pricingAndBilling: hasMaterialIssues ? "待确认" : "已配置",
    auditReadback: "脱敏",
    confirmationPoints:
      hasMaterialIssues || reviewState === "submitted" ? 2 : 0,
    requiredCapabilities,
    packageSummary: pkgSummary,
    capabilityChecks: displayCapChecks,
    safetyChecks: displaySecChecks,
    pricingSummary: displayPriceSummary,
    specialtyChecks: displayDesignChecks,
    allowedActions: allowedActionsForItem(baseItem),
    statusReason: statusReasonForItem(baseItem),
    priceLabel: null,
    evaluations: review.evaluations,
    records:
      review.records.length > 0
        ? review.records
        : ["旧商品元数据兼容队列项，建议迁移到云端岗位商品。"],
    finalNote: review.finalNote,
  };
}

export function createDijieReviewCenterReadModel(
  products: unknown[],
  options: {
    adminAccountId?: string;
    reviews?: unknown[];
    packages?: Array<DijieRolePackageStorageRecord>;
    catalogItems?: DijieCatalogItem[];
    categoryRegistry?: DijieRoleCategoryRegistry;
  } = {},
): DijieReviewCenterReadModel {
  const reviewsByRoleId = new Map(
    (options.reviews ?? [])
      .map((review) => {
        const record = asRecord(review);
        const roleListingId = nonEmptyString(record.role_listing_id);
        return roleListingId ? ([roleListingId, review] as const) : undefined;
      })
      .filter((entry): entry is readonly [string, unknown] => Boolean(entry)),
  );
  const packagesByListingPackage = new Map(
    (options.packages ?? []).map(
      (rolePackage) =>
        [
          `${rolePackage.package_id}:${rolePackage.package_version}`,
          rolePackage,
        ] as const,
    ),
  );
  const queue = products
    .map((product) =>
      createReviewQueueItem(product, reviewsByRoleId, packagesByListingPackage, {
        catalogItems: options.catalogItems,
        categoryRegistry: options.categoryRegistry,
      }),
    )
    .filter((item): item is DijieReviewQueueItem => Boolean(item));

  const pendingQueue = queue.filter(
    (item) =>
      item.reviewState === "submitted" || item.listingStatus === "proposed",
  );
  const visibleQueue = pendingQueue.length > 0 ? pendingQueue : queue;
  const hasMaterialIssues = visibleQueue.some(
    (item) => item.materialCompleteness === "待复核",
  );
  const hasSafetyIssues = visibleQueue.some(
    (item) => item.safetySummary === "需处理",
  );
  const hasPricingIssues = visibleQueue.some(
    (item) => item.pricingAndBilling === "待确认",
  );

  return {
    title: "审核中心",
    sampleRoleTitle: visibleQueue[0]?.title ?? null,
    dialogContext: options.adminAccountId
      ? createDijieAdminReviewDialogContext({
          adminAccountId: options.adminAccountId,
          roleListingId: visibleQueue[0]?.id,
          packageId: visibleQueue[0]?.packageId ?? undefined,
          reviewId: visibleQueue[0]?.id
            ? `review_${visibleQueue[0].id}`
            : undefined,
        })
      : null,
    statusPanel: {
      pendingRoles: pendingQueue.length,
      materialCompleteness: hasMaterialIssues ? "待复核" : "已完整",
      safetySummary: hasSafetyIssues ? "需处理" : "未命中敏感项",
      pricingAndBilling: hasPricingIssues ? "待确认" : "已配置",
      auditReadback: "脱敏",
      confirmationPoints: visibleQueue.reduce(
        (sum, item) => sum + item.confirmationPoints,
        0,
      ),
    },
    reviewChecklist: REVIEW_CHECKLIST,
    queue: visibleQueue,
    emptyState:
      queue.length === 0
        ? "暂无岗位审核提交，后端接入后会显示真实审核队列。"
        : null,
  };
}

export async function getDijieReviewCenterReadModel(
  queryGraph: DijieReviewCenterQueryGraph,
  options: {
    adminAccountId?: string;
    catalogItems?: DijieCatalogItem[];
    categoryRegistry?: DijieRoleCategoryRegistry;
  } = {},
): Promise<DijieReviewCenterReadModel> {
  const storedListings = await queryGraph({
    entity: "dijie_role_listing",
    fields: [
      "id",
      "package_id",
      "package_version",
      "developer_ref",
      "title",
      "subtitle",
      "description",
      "usage_instructions",
      "category",
      "listing_status",
      "review_state",
      "capabilities",
      "manifest_summary",
      "pricing",
      "role_token_pricing",
      "scopes",
      "confirmation_points",
      "submitted_at",
    ],
    pagination: { take: 100 },
  }).catch(() => ({ data: [] }));
  const storedReviews = await queryGraph({
    entity: "dijie_role_review",
    fields: [
      "id",
      "role_listing_id",
      "role_standard_decision",
      "safety_compliance_decision",
      "pricing_reasonability_decision",
      "final_result",
      "summary",
      "records",
      "finalized_at",
    ],
    pagination: { take: 100 },
  }).catch(() => ({ data: [] }));
  const storedPackages = await queryGraph({
    entity: "dijie_role_package",
    fields: [
      "id",
      "package_id",
      "package_version",
      "owner_id",
      "uploaded_at",
      "manifest_summary",
      "file_manifest",
      "package_files",
      "validation_issues",
    ],
    pagination: { take: 100 },
  }).catch(() => ({ data: [] }));
  const storedQueue = createDijieReviewCenterReadModel(
    storedListings.data ?? [],
    {
      ...options,
      reviews: storedReviews.data ?? [],
      packages: storedPackages.data as
        | DijieRolePackageStorageRecord[]
        | undefined,
    },
  );
  if (storedQueue.queue.length > 0) {
    return storedQueue;
  }

  const { data = [] } = await queryGraph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "status",
      "metadata",
      "seller.id",
      "seller.name",
    ],
    pagination: { take: 100 },
  });

  return createDijieReviewCenterReadModel(data, {
    ...options,
    packages: storedPackages.data as
      | DijieRolePackageStorageRecord[]
      | undefined,
  });
}
