import {
  normalizeDijieRoleProductMetadataFromProduct,
  type DijieRoleReviewState,
  type DijieRoleListingStatus,
} from "./role-product-metadata";
import {
  createDijieAdminReviewDialogContext,
  type DijieDialogContext,
} from "./dialog-context";

export type DijieReviewCenterQueryGraph = (query: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
}) => Promise<{ data?: unknown[] }>;

export type DijieReviewChecklistItem = {
  id: "public_materials" | "safety_summary" | "pricing_confirmation";
  title: string;
  description: string;
};

export type DijieReviewQueueItem = {
  id: string;
  title: string;
  subtitle: string | null;
  developerName: string | null;
  packageId: string | null;
  packageVersion: string | null;
  reviewState: DijieRoleReviewState | "unknown";
  reviewStateLabel: string;
  listingStatus: DijieRoleListingStatus | "unknown";
  materialCompleteness: "待复核" | "已完整";
  safetySummary: "未命中敏感项" | "需处理";
  pricingAndBilling: "待确认" | "已配置";
  auditReadback: "脱敏";
  confirmationPoints: number;
  requiredCapabilities: string[];
};

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
    id: "safety_summary",
    title: "安全摘要",
    description: "能力需求、敏感字段、审计回读。",
  },
  {
    id: "pricing_confirmation",
    title: "价格确认",
    description: "授权费、模型计费、确认点。",
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

function roleReviewState(role: UnknownRecord): DijieRoleReviewState | "unknown" {
  const raw = nonEmptyString(role.reviewState) ?? nonEmptyString(role.review_state);
  if (raw === "draft" || raw === "submitted" || raw === "approved" || raw === "rejected") {
    return raw;
  }
  return "unknown";
}

function roleListingStatus(role: UnknownRecord): DijieRoleListingStatus | "unknown" {
  const raw = nonEmptyString(role.listingStatus) ?? nonEmptyString(role.listing_status);
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
    "sec" + "ret",
    "tok" + "en",
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

function createReviewQueueItem(productInput: unknown): DijieReviewQueueItem | undefined {
  const product = asRecord(productInput);
  const id = nonEmptyString(product.id);
  const role = roleMetadata(product);

  if (!id || Object.keys(role).length === 0) {
    return undefined;
  }

  const normalized = normalizeDijieRoleProductMetadataFromProduct(product);
  const issues = normalized.ok ? [] : normalized.issues;
  const reviewState = normalized.ok ? normalized.value.reviewState : roleReviewState(role);
  const listingStatus = normalized.ok ? normalized.value.listingStatus : roleListingStatus(role);
  const requiredCapabilities = normalized.ok
    ? normalized.value.manifestSummary.requiredCapabilities ?? []
    : [];

  const hasMaterialIssues = issues.length > 0;
  const hasSafetyIssues = issueHintsContainSafetyProblem(issues);

  return {
    id,
    title:
      (normalized.ok ? normalized.value.title : nonEmptyString(role.title)) ??
      nonEmptyString(product.title) ??
      "未命名岗位",
    subtitle:
      (normalized.ok ? normalized.value.subtitle : nonEmptyString(role.subtitle)) ??
      nonEmptyString(product.subtitle) ??
      null,
    developerName: sellerName(product),
    packageId: normalized.ok ? normalized.value.packageId : nonEmptyString(role.packageId) ?? null,
    packageVersion: normalized.ok
      ? normalized.value.packageVersion
      : nonEmptyString(role.packageVersion) ?? null,
    reviewState,
    reviewStateLabel: reviewStateLabel(reviewState),
    listingStatus,
    materialCompleteness: hasMaterialIssues ? "待复核" : "已完整",
    safetySummary: hasSafetyIssues ? "需处理" : "未命中敏感项",
    pricingAndBilling: hasMaterialIssues ? "待确认" : "已配置",
    auditReadback: "脱敏",
    confirmationPoints: hasMaterialIssues || reviewState === "submitted" ? 2 : 0,
    requiredCapabilities,
  };
}

export function createDijieReviewCenterReadModel(
  products: unknown[],
  options: { adminAccountId?: string } = {},
): DijieReviewCenterReadModel {
  const queue = products
    .map(createReviewQueueItem)
    .filter((item): item is DijieReviewQueueItem => Boolean(item));

  const pendingQueue = queue.filter((item) =>
    item.reviewState === "submitted" || item.listingStatus === "proposed",
  );
  const visibleQueue = pendingQueue.length > 0 ? pendingQueue : queue;
  const hasMaterialIssues = visibleQueue.some((item) => item.materialCompleteness === "待复核");
  const hasSafetyIssues = visibleQueue.some((item) => item.safetySummary === "需处理");
  const hasPricingIssues = visibleQueue.some((item) => item.pricingAndBilling === "待确认");

  return {
    title: "审核中心",
    sampleRoleTitle: visibleQueue[0]?.title ?? null,
    dialogContext: options.adminAccountId
      ? createDijieAdminReviewDialogContext({
          adminAccountId: options.adminAccountId,
          roleListingId: visibleQueue[0]?.id,
          packageId: visibleQueue[0]?.packageId ?? undefined,
          reviewId: visibleQueue[0]?.id ? `review_${visibleQueue[0].id}` : undefined,
        })
      : null,
    statusPanel: {
      pendingRoles: pendingQueue.length,
      materialCompleteness: hasMaterialIssues ? "待复核" : "已完整",
      safetySummary: hasSafetyIssues ? "需处理" : "未命中敏感项",
      pricingAndBilling: hasPricingIssues ? "待确认" : "已配置",
      auditReadback: "脱敏",
      confirmationPoints: visibleQueue.reduce((sum, item) => sum + item.confirmationPoints, 0),
    },
    reviewChecklist: REVIEW_CHECKLIST,
    queue: visibleQueue,
    emptyState: queue.length === 0 ? "暂无岗位审核提交，后端接入后会显示真实审核队列。" : null,
  };
}

export async function getDijieReviewCenterReadModel(
  queryGraph: DijieReviewCenterQueryGraph,
  options: { adminAccountId?: string } = {},
): Promise<DijieReviewCenterReadModel> {
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

  return createDijieReviewCenterReadModel(data, options);
}
