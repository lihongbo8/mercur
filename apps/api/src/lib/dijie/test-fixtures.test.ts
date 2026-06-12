import { getDijieDialogCapabilityPolicy } from "./dialog-capability-policy";
import {
  createDijieDeveloperDialogContext,
  getDijieDialogBillingPolicy,
  type DijieDialogContext,
} from "./dialog-context";
import type { DijieDialogModelUsage } from "./dialog-model-bridge";
import {
  createDijieDialogOrchestration,
  type DijieDialogArtifact,
  type DijieDialogIntent,
  type DijieDialogOrchestration,
  type DijieDialogRequiredConfirmation,
} from "./dialog-orchestrator";
import type { DijieDialogAction } from "./dialog-actions";
import type { DijieDialogMessageResponse } from "./dialog-messages";
import type {
  DijieExecutionTokenPricing,
  DijieRoleTokenPricing,
} from "./execution-token";
import type {
  DijieRoleListingReader,
  DijieRoleListingStorageRecord,
  DijieRoleListingStore,
} from "./role-listing-store";
import type {
  DijieRoleEntitlementSource,
  DijieRoleEntitlementStatus,
  DijieRoleEntitlementStorageRecord,
} from "./role-entitlement-store";
import type {
  DijieRolePackageReader,
  DijieRolePackageStorageRecord,
} from "./role-package-store";
import type {
  DijieRolePackageUploadSummary,
} from "./role-package-upload";
import type {
  DijieReviewPricingSummary,
  DijieReviewQueueItem,
} from "./role-review-center";
import type {
  DijieRoleReviewDecision,
  DijieRoleReviewFinalResult,
  DijieRoleReviewStorageRecord,
} from "./role-review-store";
import type { DijieRoleListing } from "./role-listings";

type WithId<T, TId extends string | undefined = string> = T & { id: TId };

export const testUsageInstructions =
  "使用者需要提供商品图、目标平台、品牌卖点和人工确认标准后再发起任务。";

export function testDijieExecutionTokenPricing(
  overrides: Partial<DijieExecutionTokenPricing> = {},
): DijieExecutionTokenPricing {
  return {
    kind: "one_time_authorization",
    authorizationFeeCents: 0,
    currency: "CNY",
    platformFeeBps: 0,
    developerReceivableCents: 0,
    ...overrides,
  };
}

export function testDijieRoleTokenPricing(
  overrides: Partial<DijieRoleTokenPricing> = {},
): DijieRoleTokenPricing {
  return {
    inputTokenCentsPerMillion: 120,
    outputTokenCentsPerMillion: 360,
    currency: "CNY",
    developerReceivableBps: 10000,
    platformFeeBps: 0,
    ...overrides,
  };
}

export function testDijieRolePackageManifestSummary(
  overrides: Partial<DijieRolePackageUploadSummary["manifestSummary"]> = {},
): DijieRolePackageUploadSummary["manifestSummary"] {
  return {
    entrypoint: "role_package/README.md",
    manifestRef: "role_package/manifest.json",
    name: "商品图检查岗位",
    permissions: ["workspace.read"],
    requiredCapabilities: ["workspace.read", "image.inspect"],
    fileCount: 1,
    ...overrides,
  };
}

export function testDijieRolePackageStorageRecord(
  overrides: Partial<WithId<DijieRolePackageStorageRecord, string>> = {},
): WithId<DijieRolePackageStorageRecord, string> {
  return {
    id: "djpkg_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    uploaded_at: new Date("2026-06-04T10:00:00.000Z"),
    manifest_summary: testDijieRolePackageManifestSummary(),
    file_manifest: [],
    package_files: [],
    validation_issues: null,
    ...overrides,
  };
}

export function testDijieRolePackageReader(input: {
  record?: (DijieRolePackageStorageRecord & { id?: string }) | undefined;
  records?: Array<DijieRolePackageStorageRecord & { id?: string }>;
  retrieve?: DijieRolePackageReader["retrieveDijieRolePackage"];
  list?: DijieRolePackageReader["listDijieRolePackages"];
} = {}): DijieRolePackageReader {
  const record = input.record ?? testDijieRolePackageStorageRecord();
  return {
    retrieveDijieRolePackage:
      input.retrieve ??
      (async () => record),
    listDijieRolePackages:
      input.list ??
      (async () => input.records ?? (record ? [record] : [])),
  };
}

export function testDijieRoleListingStorageRecord(
  overrides: Partial<WithId<DijieRoleListingStorageRecord, string>> = {},
): WithId<DijieRoleListingStorageRecord, string> {
  return {
    id: "djrole_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    developer_ref: "sel_001",
    listing_owner_ref: "sel_001",
    billing_beneficiary_ref: "sel_001",
    title: "商品图检查岗位",
    subtitle: null,
    description: null,
    usage_instructions: testUsageInstructions,
    category: null,
    listing_status: "draft",
    review_state: "draft",
    capabilities: ["workspace.read", "image.inspect"],
    manifest_summary: {
      entrypoint: "role_package/manifest.json",
      permissions: ["workspace.read"],
      requiredCapabilities: ["workspace.read", "image.inspect"],
      sandbox: "workspace-write",
    },
    pricing: testDijieExecutionTokenPricing(),
    role_token_pricing: testDijieRoleTokenPricing(),
    scopes: ["role.execute", "audit.write"],
    confirmation_points: 0,
    submitted_at: null,
    published_at: null,
    ...overrides,
  };
}

export function testDijieRoleListing(
  overrides: Partial<DijieRoleListing> = {},
): DijieRoleListing {
  return {
    id: "djrole_image_review",
    title: "商品图检查岗位",
    subtitle: "检查商品图是否清晰、合规、适合上架。",
    description: "适合商品图、美工初审和图片质量检查。",
    usageInstructions: "使用者需要提供商品图、目标平台和人工确认标准。",
    category: null,
    categoryRef: null,
    handle: "djrole_image_review",
    listingStatus: "published",
    reviewState: "approved",
    developerId: "acct_dev",
    developerName: "迭界开发者",
    packageId: "djpkg_image_review",
    packageVersion: "1.0.0",
    protocolVersion: "2026-05",
    manifestSummary: null,
    capabilities: ["视觉检查", "商品图检查"],
    pricing: testDijieExecutionTokenPricing(),
    roleTokenPricing: testDijieRoleTokenPricing(),
    scopes: ["role.execute", "audit.write"],
    ...overrides,
  };
}

export function testDijieRoleListingReader(input: {
  record?: WithId<DijieRoleListingStorageRecord, string> | undefined;
  records?: Array<WithId<DijieRoleListingStorageRecord, string>>;
  retrieve?: DijieRoleListingReader["retrieveDijieRoleListing"];
  list?: DijieRoleListingReader["listDijieStoredRoleListings"];
} = {}): DijieRoleListingReader {
  const record = input.record ?? testDijieRoleListingStorageRecord();
  return {
    retrieveDijieRoleListing:
      input.retrieve ??
      (async () => record),
    listDijieStoredRoleListings:
      input.list ??
      (async () => input.records ?? (record ? [record] : [])),
  };
}

export function testDijieRoleListingStore(
  overrides: Partial<DijieRoleListingStore> = {},
): DijieRoleListingStore {
  return {
    async createDijieRoleListing() {
      throw new Error("createDijieRoleListing fixture not implemented");
    },
    async updateDijieRoleListingDraft() {
      throw new Error("updateDijieRoleListingDraft fixture not implemented");
    },
    async submitDijieRoleListingForReview() {
      throw new Error("submitDijieRoleListingForReview fixture not implemented");
    },
    async publishDijieRoleListing() {
      throw new Error("publishDijieRoleListing fixture not implemented");
    },
    async delistDijieRoleListing() {
      throw new Error("delistDijieRoleListing fixture not implemented");
    },
    ...overrides,
  };
}

export function testDijieRoleEntitlementStorageRecord(
  overrides: Partial<WithId<DijieRoleEntitlementStorageRecord, string>> = {},
): WithId<DijieRoleEntitlementStorageRecord, string> {
  return {
    id: "djent_image_review",
    actor_id: "cus_001",
    role_listing_id: "djrole_image_qc",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    developer_ref: "member_123",
    listing_owner_ref: "seller_123",
    billing_beneficiary_ref: "member_123",
    entitlement_status: "authorized",
    source: "zero_price",
    order_id: null,
    pricing: testDijieExecutionTokenPricing(),
    role_token_pricing: testDijieRoleTokenPricing(),
    authorized_at: new Date("2026-06-04T00:00:00.000Z"),
    ...overrides,
  };
}

export function testDijieReviewStorageRecord(
  overrides: Partial<WithId<DijieRoleReviewStorageRecord, string>> = {},
): WithId<DijieRoleReviewStorageRecord, string> {
  return {
    id: "djreview_djrole_image_review",
    role_listing_id: "djrole_image_review",
    reviewer_id: null,
    role_standard_decision: "pending",
    safety_compliance_decision: "pending",
    pricing_reasonability_decision: "pending",
    final_result: "pending",
    summary: null,
    records: [],
    finalized_at: null,
    ...overrides,
  };
}

export function testDijieReviewPricingSummary(
  overrides: Partial<DijieReviewPricingSummary> = {},
): DijieReviewPricingSummary {
  return {
    authorizationFee: "¥299.00",
    modelUsageFee: "平台默认",
    platformExecutionFee: "平台统一账本核算",
    inputTokenFee: "输入 120 CNY / 百万 tokens",
    outputTokenFee: "输出 360 CNY / 百万 tokens",
    inputTokenMarkup: "0%",
    outputTokenMarkup: "0%",
    platformTokenCost: "平台成本账本核算",
    tokenPricingLimit: "开发者按平台统一 token 定价，不允许额外加价。",
    developerRevenue: "¥299.00",
    hiddenFeeRisk: "未发现隐藏收费",
    checks: [],
    ...overrides,
  };
}

export function testDijieReviewQueueItem(
  overrides: Partial<DijieReviewQueueItem> = {},
): DijieReviewQueueItem {
  return {
    id: "djrole_visual_lock",
    reviewId: "review_djrole_visual_lock",
    title: "智能门锁电商美工岗位",
    subtitle: "主图巡检与方案输出",
    usageInstructions: testUsageInstructions,
    categoryRef: null,
    developerName: "迭界开发者",
    packageId: "pkg_visual_lock",
    packageVersion: "1.0.0",
    reviewState: "submitted",
    reviewStateLabel: "待审核",
    listingStatus: "proposed",
    submittedAt: "2026-06-07T10:00:00.000Z",
    materialCompleteness: "已完整",
    safetySummary: "未命中敏感项",
    pricingAndBilling: "已配置",
    auditReadback: "脱敏",
    confirmationPoints: 2,
    requiredCapabilities: ["image.inspect", "image.generate", "audit.record"],
    packageSummary: {
      manifest: [],
      requiredCapabilities: ["image.inspect", "image.generate", "audit.record"],
      skills: [],
      templates: [],
      validation: ["role_package/validation.md"],
      readme: "已读取",
      listing: "已读取",
      files: [],
      validationIssues: [],
      packageDownload: { available: false, url: null },
    },
    capabilityChecks: [],
    safetyChecks: [],
    pricingSummary: testDijieReviewPricingSummary(),
    specialtyChecks: [],
    allowedActions: ["save_evaluations", "finalize_needs_changes"],
    statusReason: "待人工审核",
    priceLabel: "¥299.00",
    evaluations: {
      roleStandard: "pending",
      safetyCompliance: "pending",
      pricingReasonability: "pending",
    },
    records: ["进入审核队列。"],
    finalNote: null,
    ...overrides,
  };
}

export function testDijieDialogMessageResponse(input: {
  context?: DijieDialogContext;
  reply?: string;
  grounding?: DijieDialogMessageResponse["grounding"];
  billingPolicy?: DijieDialogMessageResponse["billingPolicy"];
  modelUsage?: DijieDialogModelUsage | null;
  modelCalled?: boolean;
  actions?: DijieDialogAction[];
  intent?: DijieDialogIntent;
  allowedActions?: string[];
  proposedActions?: DijieDialogAction[];
  requiredConfirmations?: DijieDialogRequiredConfirmation[];
  artifacts?: DijieDialogArtifact[];
  orchestration?: DijieDialogOrchestration;
} = {}): DijieDialogMessageResponse {
  const context =
    input.context ??
    createDijieDeveloperDialogContext({
      developerAccountId: "acct_dev",
    });
  const actions = input.actions ?? [];
  const capabilityPolicy = getDijieDialogCapabilityPolicy(context);
  const orchestration =
    input.orchestration ??
    createDijieDialogOrchestration({
      context,
      capabilityPolicy,
      message: "测试消息",
      actions,
    });

  return {
    reply: input.reply ?? "测试回复",
    grounding: input.grounding ?? { roles: [], source: "dialog_context" },
    billingPolicy: input.billingPolicy ?? getDijieDialogBillingPolicy(context),
    modelUsage: input.modelUsage ?? null,
    modelCalled: input.modelCalled ?? Boolean(input.modelUsage),
    actions,
    intent: input.intent ?? orchestration.intent,
    allowedActions: input.allowedActions ?? orchestration.allowedActions,
    proposedActions: input.proposedActions ?? orchestration.proposedActions,
    requiredConfirmations:
      input.requiredConfirmations ?? orchestration.requiredConfirmations,
    artifacts: input.artifacts ?? orchestration.artifacts,
    orchestration,
  };
}

export type TestDijieRoleReviewRepository = {
  createDijieRoleReviews: (
    data: Omit<DijieRoleReviewStorageRecord, "id">,
  ) => Promise<WithId<DijieRoleReviewStorageRecord, string>>;
  listDijieRoleReviews: (
    filters?: Record<string, unknown>,
  ) => Promise<Array<WithId<DijieRoleReviewStorageRecord, string>>>;
  updateDijieRoleReviews: (
    data: Partial<Omit<DijieRoleReviewStorageRecord, "id">> & { id: string },
  ) => Promise<WithId<DijieRoleReviewStorageRecord, string>>;
  listDijieRoleListings: (
    filters?: Record<string, unknown>,
  ) => Promise<Array<WithId<DijieRoleListingStorageRecord, string>>>;
  updateDijieRoleListings: (
    data: Partial<Omit<DijieRoleListingStorageRecord, "id">> & { id: string },
  ) => Promise<WithId<DijieRoleListingStorageRecord, string>>;
};

export type TestRoleEntitlementStatus = DijieRoleEntitlementStatus;
export type TestRoleEntitlementSource = DijieRoleEntitlementSource;
export type TestRoleReviewDecision = DijieRoleReviewDecision;
export type TestRoleReviewFinalResult = DijieRoleReviewFinalResult;
