import type {
  DijieRoleListingLookupRepository,
  DijieRoleListingStorageRecord,
  DijieRoleListingUpdateRepository,
} from "./role-listing-store";

export type DijieRoleReviewDecision = "pending" | "pass" | "needs_changes" | "reject";
export type DijieRoleReviewFinalResult =
  | "pending"
  | "approved"
  | "needs_changes"
  | "rejected";

export type DijieRoleReviewRecordEntry = {
  at: string;
  actorId: string | null;
  action: string;
  summary: string | null;
};

export type DijieRoleReviewStorageRecord = {
  id?: string;
  role_listing_id: string;
  reviewer_id: string | null;
  role_standard_decision: DijieRoleReviewDecision;
  safety_compliance_decision: DijieRoleReviewDecision;
  pricing_reasonability_decision: DijieRoleReviewDecision;
  final_result: DijieRoleReviewFinalResult;
  summary: string | null;
  records: DijieRoleReviewRecordEntry[];
  finalized_at: Date | null;
};

export type DijieRoleReviewRepository = {
  createDijieRoleReviews: (
    data: Omit<DijieRoleReviewStorageRecord, "id">,
  ) => Promise<DijieRoleReviewStorageRecord & { id: string }>;
};

export type DijieRoleReviewLookupRepository = {
  listDijieRoleReviews: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRoleReviewStorageRecord & { id: string }>>;
};

export type DijieRoleReviewUpdateRepository = {
  updateDijieRoleReviews: (
    data: Partial<Omit<DijieRoleReviewStorageRecord, "id">> & { id: string },
  ) => Promise<DijieRoleReviewStorageRecord & { id: string }>;
};

export type DijieRoleReviewMutationResult =
  | {
      ok: true;
      value: {
        reviewId: string;
        roleListingId: string;
        review: DijieRoleReviewStorageRecord & { id: string };
        listing: DijieRoleListingStorageRecord & { id: string };
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export type DijieRoleReviewStore = {
  saveDijieRoleReviewEvaluations: (input: {
    roleListingId: string;
    reviewerId?: string;
    roleStandardDecision?: DijieRoleReviewDecision;
    safetyComplianceDecision?: DijieRoleReviewDecision;
    pricingReasonabilityDecision?: DijieRoleReviewDecision;
    summary?: string | null;
  }) => Promise<DijieRoleReviewMutationResult>;
  finalizeDijieRoleReview: (input: {
    roleListingId: string;
    reviewerId?: string;
    finalResult: DijieRoleReviewFinalResult;
    summary?: string | null;
  }) => Promise<DijieRoleReviewMutationResult>;
};

type DijieRoleReviewCompositeRepository = DijieRoleReviewRepository &
  DijieRoleReviewLookupRepository &
  DijieRoleReviewUpdateRepository &
  DijieRoleListingLookupRepository &
  DijieRoleListingUpdateRepository;

const REVIEW_DECISIONS = new Set<DijieRoleReviewDecision>([
  "pending",
  "pass",
  "needs_changes",
  "reject",
]);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function reviewDecision(value: unknown): DijieRoleReviewDecision | undefined {
  return REVIEW_DECISIONS.has(value as DijieRoleReviewDecision)
    ? (value as DijieRoleReviewDecision)
    : undefined;
}

function recordEntry(input: {
  actorId?: string;
  action: string;
  summary?: string | null;
}): DijieRoleReviewRecordEntry {
  return {
    at: new Date().toISOString(),
    actorId: nonEmptyString(input.actorId) ?? null,
    action: input.action,
    summary: nonEmptyString(input.summary) ?? null,
  };
}

function createInitialReview(roleListingId: string, reviewerId?: string) {
  return {
    role_listing_id: roleListingId,
    reviewer_id: nonEmptyString(reviewerId) ?? null,
    role_standard_decision: "pending" as const,
    safety_compliance_decision: "pending" as const,
    pricing_reasonability_decision: "pending" as const,
    final_result: "pending" as const,
    summary: null,
    records: [recordEntry({ actorId: reviewerId, action: "创建审核单" })],
    finalized_at: null,
  };
}

async function retrieveRoleListing(
  repository: DijieRoleListingLookupRepository,
  roleListingId: string,
) {
  const [listing] = await repository.listDijieRoleListings(
    { id: roleListingId },
    { take: 1 },
  );
  return listing;
}

async function retrieveReview(
  repository: DijieRoleReviewLookupRepository,
  roleListingId: string,
) {
  const [review] = await repository.listDijieRoleReviews(
    { role_listing_id: roleListingId },
    { take: 1 },
  );
  return review;
}

async function retrieveOrCreateReview(
  repository: DijieRoleReviewRepository & DijieRoleReviewLookupRepository,
  roleListingId: string,
  reviewerId?: string,
) {
  const existing = await retrieveReview(repository, roleListingId);
  if (existing) {
    return existing;
  }
  return repository.createDijieRoleReviews(createInitialReview(roleListingId, reviewerId));
}

function canFinalize(
  review: DijieRoleReviewStorageRecord,
  finalResult: DijieRoleReviewFinalResult,
): { ok: true } | { ok: false; status: number; error: string } {
  const decisions = [
    review.role_standard_decision,
    review.safety_compliance_decision,
    review.pricing_reasonability_decision,
  ];
  if (finalResult === "approved" && decisions.every((decision) => decision === "pass")) {
    return { ok: true };
  }
  if (
    finalResult === "needs_changes" &&
    decisions.some((decision) => decision === "needs_changes")
  ) {
    return { ok: true };
  }
  if (finalResult === "rejected" && decisions.some((decision) => decision === "reject")) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 409,
    error: "最终审核动作必须与岗位标准、安全合规、定价合理性三项评估一致。",
  };
}

function listingPatchForFinalResult(
  finalResult: DijieRoleReviewFinalResult,
): Partial<Omit<DijieRoleListingStorageRecord, "id">> | undefined {
  switch (finalResult) {
    case "approved":
      return {
        listing_status: "published",
        review_state: "approved",
        published_at: new Date(),
      };
    case "needs_changes":
      return {
        listing_status: "draft",
        review_state: "needs_changes",
        published_at: null,
      };
    case "rejected":
      return {
        listing_status: "archived",
        review_state: "rejected",
        published_at: null,
      };
    default:
      return undefined;
  }
}

export async function saveDijieRoleReviewEvaluationsWithRepository(
  repository: DijieRoleReviewCompositeRepository,
  input: {
    roleListingId: string;
    reviewerId?: string;
    roleStandardDecision?: DijieRoleReviewDecision;
    safetyComplianceDecision?: DijieRoleReviewDecision;
    pricingReasonabilityDecision?: DijieRoleReviewDecision;
    summary?: string | null;
  },
): Promise<DijieRoleReviewMutationResult> {
  const listing = await retrieveRoleListing(repository, input.roleListingId);
  if (!listing) {
    return { ok: false, status: 404, error: "未找到待审核岗位商品。" };
  }
  if (listing.review_state !== "submitted") {
    return { ok: false, status: 409, error: "只有已提交审核的岗位商品可以保存审核评估。" };
  }

  const review = await retrieveOrCreateReview(repository, input.roleListingId, input.reviewerId);
  const roleStandardDecision = reviewDecision(input.roleStandardDecision);
  const safetyComplianceDecision = reviewDecision(input.safetyComplianceDecision);
  const pricingReasonabilityDecision = reviewDecision(input.pricingReasonabilityDecision);
  const updated = await repository.updateDijieRoleReviews({
    id: review.id,
    reviewer_id: nonEmptyString(input.reviewerId) ?? review.reviewer_id,
    ...(roleStandardDecision ? { role_standard_decision: roleStandardDecision } : {}),
    ...(safetyComplianceDecision ? { safety_compliance_decision: safetyComplianceDecision } : {}),
    ...(pricingReasonabilityDecision
      ? { pricing_reasonability_decision: pricingReasonabilityDecision }
      : {}),
    ...(input.summary !== undefined ? { summary: nonEmptyString(input.summary) ?? null } : {}),
    records: [
      ...(Array.isArray(review.records) ? review.records : []),
      recordEntry({
        actorId: input.reviewerId,
        action: "保存三项评估",
        summary: input.summary,
      }),
    ],
  });

  return {
    ok: true,
    value: {
      reviewId: updated.id,
      roleListingId: listing.id,
      review: updated,
      listing,
    },
  };
}

export async function finalizeDijieRoleReviewWithRepository(
  repository: DijieRoleReviewCompositeRepository,
  input: {
    roleListingId: string;
    reviewerId?: string;
    finalResult: DijieRoleReviewFinalResult;
    summary?: string | null;
  },
): Promise<DijieRoleReviewMutationResult> {
  const finalResult =
    input.finalResult === "approved" ||
    input.finalResult === "needs_changes" ||
    input.finalResult === "rejected"
      ? input.finalResult
      : undefined;
  if (!finalResult) {
    return { ok: false, status: 400, error: "最终审核动作必须是通过、要求补充或驳回。" };
  }

  const listing = await retrieveRoleListing(repository, input.roleListingId);
  if (!listing) {
    return { ok: false, status: 404, error: "未找到待审核岗位商品。" };
  }
  if (listing.review_state !== "submitted") {
    return { ok: false, status: 409, error: "只有已提交审核的岗位商品可以完成审核。" };
  }

  const review = await retrieveOrCreateReview(repository, input.roleListingId, input.reviewerId);
  const canComplete = canFinalize(review, finalResult);
  if (!canComplete.ok) {
    return canComplete;
  }

  const listingPatch = listingPatchForFinalResult(finalResult);
  if (!listingPatch) {
    return { ok: false, status: 400, error: "最终审核动作无效。" };
  }

  const updatedReview = await repository.updateDijieRoleReviews({
    id: review.id,
    reviewer_id: nonEmptyString(input.reviewerId) ?? review.reviewer_id,
    final_result: finalResult,
    summary: nonEmptyString(input.summary) ?? review.summary,
    finalized_at: new Date(),
    records: [
      ...(Array.isArray(review.records) ? review.records : []),
      recordEntry({
        actorId: input.reviewerId,
        action:
          finalResult === "approved"
            ? "审核通过"
            : finalResult === "needs_changes"
              ? "要求补充"
              : "审核驳回",
        summary: input.summary,
      }),
    ],
  });
  const updatedListing = await repository.updateDijieRoleListings({
    id: listing.id,
    ...listingPatch,
  });

  return {
    ok: true,
    value: {
      reviewId: updatedReview.id,
      roleListingId: updatedListing.id,
      review: updatedReview,
      listing: updatedListing,
    },
  };
}
