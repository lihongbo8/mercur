import { fetchQuery } from "../client";

export type ReviewCheckStatus = "pass" | "warning" | "blocked";
export type RoleStatus = "pending" | "needs_changes" | "approved" | "rejected";
export type EvaluationKey =
  | "roleStandard"
  | "safetyCompliance"
  | "pricingReasonability";
export type EvaluationDecision =
  | "pending"
  | "pass"
  | "needs_changes"
  | "reject";

export type ReviewCheckItem = {
  id: string;
  label: string;
  status: ReviewCheckStatus;
  note: string;
};

export type ReviewSummaryRow = {
  label: string;
  value: string;
  status?: ReviewCheckStatus;
};

export type ReviewPackageSummary = {
  manifest: ReviewSummaryRow[];
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

export type ReviewPricingSummary = {
  authorizationFee: string;
  modelUsageFee: string;
  platformExecutionFee?: string;
  inputTokenFee?: string;
  outputTokenFee?: string;
  inputTokenMarkup?: string;
  outputTokenMarkup?: string;
  platformTokenCost?: string;
  tokenPricingLimit?: string;
  developerRevenue: string;
  hiddenFeeRisk: string;
  checks: ReviewCheckItem[];
};

export type ReviewQueueItem = {
  id: string;
  reviewId: string;
  title: string;
  subtitle?: string | null;
  usageInstructions?: string | null;
  developerName?: string | null;
  packageId?: string | null;
  packageVersion?: string | null;
  reviewState?: string;
  reviewStateLabel?: string;
  listingStatus?: string;
  submittedAt?: string | null;
  confirmationPoints?: number;
  requiredCapabilities?: string[];
  packageSummary?: ReviewPackageSummary;
  capabilityChecks?: ReviewCheckItem[];
  safetyChecks?: ReviewCheckItem[];
  pricingSummary?: ReviewPricingSummary;
  specialtyChecks?: ReviewCheckItem[];
  allowedActions?: string[];
  statusReason?: string;
  priceLabel?: string | null;
  evaluations?: Record<EvaluationKey, EvaluationDecision>;
  records?: string[];
  finalNote?: string | null;
};

export type ReviewCenterReadModel = {
  title: "审核中心";
  sampleRoleTitle: string | null;
  statusPanel: {
    pendingRoles: number;
    materialCompleteness: "待复核" | "已完整";
    safetySummary: "未命中敏感项" | "需处理";
    pricingAndBilling: "待确认" | "已配置";
    auditReadback: "脱敏";
    confirmationPoints: number;
  };
  queue: ReviewQueueItem[];
  emptyState?: string | null;
};

export type ReviewCenterResponse = {
  ok?: boolean;
  reviewCenter?: ReviewCenterReadModel;
};

export type CatalogReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "request_changes";
export type CatalogReviewFilter = CatalogReviewStatus | "all";

export type CatalogReviewRequest = {
  id?: string;
  reviewId?: string;
  review_key?: string;
  reviewKey?: string;
  catalog_ref?: string | null;
  catalogRef?: string | null;
  need: string;
  kind: "skill" | "tool" | "mcp" | "adapter" | "capability";
  source: string;
  review_status: CatalogReviewStatus;
  status?: CatalogReviewStatus;
  role_package_id?: string | null;
  rolePackageId?: string | null;
  role_listing_id?: string | null;
  roleListingId?: string | null;
  requested_by?: string | null;
  requestedBy?: string | null;
  submitted_at?: string;
  submittedAt?: string;
  review_note?: string | null;
  reviewNote?: string | null;
  candidate?: Record<string, unknown>;
  risk_summary?: Record<string, unknown>;
  riskSummary?: Record<string, unknown>;
};

export type CatalogItem = {
  id: string;
  kind: string;
  name: string;
  version: string;
  source: string;
  status: string;
  riskLevel?: string;
  provides?: string[];
};

export type CatalogReviewResponse = {
  ok?: boolean;
  catalogItems?: CatalogItem[];
  reviewRequests?: CatalogReviewRequest[];
};

export const fetchReviewCenter = async () => {
  const result = (await fetchQuery("/admin/dijie/review-center", {
    method: "GET",
  })) as ReviewCenterResponse | undefined;

  return result?.reviewCenter;
};

export const fetchCatalogReview = async (
  status: CatalogReviewFilter = "pending_review",
) => {
  const result = (await fetchQuery("/admin/dijie/catalog-review", {
    method: "GET",
    ...(status === "all" ? {} : { query: { status } }),
  })) as CatalogReviewResponse | undefined;

  return {
    catalogItems: result?.catalogItems ?? [],
    reviewRequests: result?.reviewRequests ?? [],
  };
};

export const finalizeCatalogReview = async (
  reviewId: string,
  body: {
    result: "approved" | "rejected" | "request_changes";
    reviewNote?: string;
  },
) => {
  return fetchQuery(
    `/admin/dijie/catalog-review/${encodeURIComponent(reviewId)}/finalize`,
    {
      method: "POST",
      body,
    },
  );
};

export const saveReviewEvaluations = async (
  reviewId: string,
  body: {
    roleStandardDecision?: EvaluationDecision;
    safetyComplianceDecision?: EvaluationDecision;
    pricingReasonabilityDecision?: EvaluationDecision;
    summary?: string;
  },
) => {
  return fetchQuery(
    `/admin/dijie/reviews/${encodeURIComponent(reviewId)}/evaluations`,
    {
      method: "POST",
      body,
    },
  );
};

export const finalizeReview = async (
  reviewId: string,
  body: {
    finalResult: "approved" | "needs_changes" | "rejected";
    summary?: string;
  },
) => {
  return fetchQuery(
    `/admin/dijie/reviews/${encodeURIComponent(reviewId)}/finalize`,
    {
      method: "POST",
      body,
    },
  );
};
