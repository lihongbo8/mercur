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

export const fetchReviewCenter = async () => {
  const result = (await fetchQuery("/admin/dijie/review-center", {
    method: "GET",
  })) as ReviewCenterResponse | undefined;

  return result?.reviewCenter;
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
