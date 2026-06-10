import {
  DIJIE_PLATFORM_SKILL_TOOL_CATALOG,
  type DijieCatalogItem,
  type DijieCatalogKind,
  type DijieCatalogStatus,
  type DijieRoleCapabilityPlan,
} from "./role-skill-tool-planner";

export type CatalogReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "request_changes";

export type DijieCatalogReviewRequestSummary = {
  reviewId?: string;
  reviewKey: string;
  catalogRef: string | null;
  need: string;
  kind: DijieCatalogKind;
  source: DijieCatalogReviewRequestStorageRecord["source"];
  status: CatalogReviewStatus;
  rolePackageId: string | null;
  roleListingId: string | null;
  requestedBy: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  candidate: Record<string, unknown>;
  riskSummary: Record<string, unknown>;
};

export type DijieCatalogItemStorageRecord = {
  catalog_ref: string;
  kind: DijieCatalogKind;
  name: string;
  version: string;
  description: string;
  source: DijieCatalogItem["source"] | "github" | "mcp_registry" | "npm" | "other";
  catalog_status: DijieCatalogStatus;
  permissions: string[];
  risk_level: DijieCatalogItem["riskLevel"];
  audit_policy: string[];
  tags: string[];
  provides: string[];
  keywords: string[];
  payload: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
};

export type DijieCatalogReviewRequestStorageRecord = {
  review_key: string;
  catalog_ref: string | null;
  need: string;
  kind: DijieCatalogKind;
  source: "role_gap" | "opencloud" | "openclaw" | "github" | "mcp_registry" | "npm" | "internal_build";
  review_status: CatalogReviewStatus;
  role_package_id: string | null;
  role_listing_id: string | null;
  requested_by: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_note: string | null;
  candidate: Record<string, unknown>;
  risk_summary: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type DijieCatalogLookupRepository = {
  listDijieCatalogItems: (
    filters?: Partial<DijieCatalogItemStorageRecord>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieCatalogItemStorageRecord & { id?: string }>>;
  listDijieCatalogReviewRequests?: (
    filters?: Partial<DijieCatalogReviewRequestStorageRecord>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieCatalogReviewRequestStorageRecord & { id?: string }>>;
};

export type DijieCatalogMutationRepository = {
  createDijieCatalogItems: (
    data: DijieCatalogItemStorageRecord,
  ) => Promise<{ id?: string }>;
  updateDijieCatalogItems: (
    data: Partial<DijieCatalogItemStorageRecord> & { id: string },
  ) => Promise<Array<DijieCatalogItemStorageRecord & { id?: string }>>;
  createDijieCatalogReviewRequests: (
    data: DijieCatalogReviewRequestStorageRecord,
  ) => Promise<{ id?: string }>;
  updateDijieCatalogReviewRequests: (
    data: Partial<DijieCatalogReviewRequestStorageRecord> & { id: string },
  ) => Promise<Array<DijieCatalogReviewRequestStorageRecord & { id?: string }>>;
};

export type DijieCatalogReader = {
  listDijieEffectiveCatalogItems: () => Promise<DijieCatalogItem[]>;
  listDijieCatalogReviewRequests: (input?: {
    status?: CatalogReviewStatus;
  }) => Promise<Array<DijieCatalogReviewRequestStorageRecord & { id?: string }>>;
};

export type DijieCatalogReviewStore = {
  createDijieCatalogReviewRequestsForPlan: (input: {
    plan: DijieRoleCapabilityPlan;
    rolePackageId?: string | null;
    roleListingId?: string | null;
    requestedBy?: string | null;
  }) => Promise<DijieCatalogReviewRequestSummary[]>;
  finalizeDijieCatalogReviewRequest: (input: {
    reviewId: string;
    result: "approved" | "rejected" | "request_changes";
    reviewedBy?: string | null;
    reviewNote?: string | null;
  }) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
};

function now() {
  return new Date();
}

function stableRef(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);
  if (normalized) {
    return normalized;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `item-${hash.toString(16).padStart(8, "0")}`;
}

function catalogItemFromStorage(record: DijieCatalogItemStorageRecord): DijieCatalogItem {
  return {
    id: record.catalog_ref,
    kind: record.kind,
    name: record.name,
    version: record.version,
    description: record.description,
    tags: record.tags,
    provides: record.provides,
    source:
      record.source === "github" ||
      record.source === "mcp_registry" ||
      record.source === "npm" ||
      record.source === "other"
        ? "internal_build"
        : record.source,
    status: record.catalog_status,
    permissions: record.permissions,
    riskLevel: record.risk_level,
    auditPolicy: record.audit_policy,
    keywords: record.keywords,
  };
}

export function createDijieCatalogReviewRequestReadModel(
  record: DijieCatalogReviewRequestStorageRecord & { id?: string },
): DijieCatalogReviewRequestSummary {
  return {
    reviewId: record.id,
    reviewKey: record.review_key,
    catalogRef: record.catalog_ref,
    need: record.need,
    kind: record.kind,
    source: record.source,
    status: record.review_status,
    rolePackageId: record.role_package_id,
    roleListingId: record.role_listing_id,
    requestedBy: record.requested_by,
    submittedAt:
      record.submitted_at instanceof Date
        ? record.submitted_at.toISOString()
        : String(record.submitted_at),
    reviewedAt: record.reviewed_at
      ? record.reviewed_at instanceof Date
        ? record.reviewed_at.toISOString()
        : String(record.reviewed_at)
      : null,
    reviewedBy: record.reviewed_by,
    reviewNote: record.review_note,
    candidate: record.candidate,
    riskSummary: record.risk_summary,
  };
}

function storageFromCatalogItem(
  item: DijieCatalogItem,
  input?: { reviewedBy?: string | null },
): DijieCatalogItemStorageRecord {
  return {
    catalog_ref: item.id,
    kind: item.kind,
    name: item.name,
    version: item.version,
    description: item.description,
    source: item.source,
    catalog_status: item.status,
    permissions: item.permissions,
    risk_level: item.riskLevel,
    audit_policy: item.auditPolicy,
    tags: item.tags,
    provides: item.provides,
    keywords: item.keywords,
    payload: { builtin: item.source === "platform_builtin" },
    created_at: now(),
    updated_at: now(),
    reviewed_at: item.status === "approved" ? now() : null,
    reviewed_by: input?.reviewedBy ?? null,
  };
}

function mergeCatalogItems(stored: DijieCatalogItem[]) {
  const byRef = new Map<string, DijieCatalogItem>();
  for (const item of DIJIE_PLATFORM_SKILL_TOOL_CATALOG) {
    byRef.set(item.id, item);
  }
  for (const item of stored) {
    byRef.set(item.id, item);
  }
  return [...byRef.values()];
}

export async function listDijieEffectiveCatalogItemsWithRepository(
  repository?: DijieCatalogLookupRepository,
): Promise<DijieCatalogItem[]> {
  if (!repository?.listDijieCatalogItems) {
    return DIJIE_PLATFORM_SKILL_TOOL_CATALOG;
  }
  const records = await repository.listDijieCatalogItems(undefined, {
    take: 1000,
    order: { updated_at: "DESC" },
  });
  return mergeCatalogItems(records.map(catalogItemFromStorage));
}

export async function listDijieCatalogReviewRequestsWithRepository(
  repository: DijieCatalogLookupRepository,
  input: { status?: CatalogReviewStatus } = {},
) {
  if (!repository.listDijieCatalogReviewRequests) {
    return [];
  }
  return repository.listDijieCatalogReviewRequests(
    input.status ? { review_status: input.status } : undefined,
    { take: 500, order: { submitted_at: "DESC" } },
  );
}

function reviewRequestForGap(input: {
  gap: DijieRoleCapabilityPlan["gaps"][number];
  rolePackageId?: string | null;
  roleListingId?: string | null;
  requestedBy?: string | null;
}): DijieCatalogReviewRequestStorageRecord {
  const reviewKey = stableRef(
    [
      input.gap.kind,
      input.gap.need,
      input.rolePackageId ?? "no-package",
      input.roleListingId ?? "no-listing",
    ].join(":"),
  );
  return {
    review_key: reviewKey,
    catalog_ref: null,
    need: input.gap.need,
    kind: input.gap.kind,
    source: input.gap.nextAction === "request_internal_build" ? "internal_build" : "role_gap",
    review_status: "pending_review",
    role_package_id: input.rolePackageId ?? null,
    role_listing_id: input.roleListingId ?? null,
    requested_by: input.requestedBy ?? null,
    submitted_at: now(),
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    candidate: {
      need: input.gap.need,
      reason: input.gap.reason,
      nextAction: input.gap.nextAction,
    },
    risk_summary: {
      riskLevel: "unknown",
      requiresHumanReview: true,
    },
    payload: { gap: input.gap },
  };
}

export async function createDijieCatalogReviewRequestsForPlanWithRepository(
  repository: DijieCatalogLookupRepository & DijieCatalogMutationRepository,
  input: Parameters<DijieCatalogReviewStore["createDijieCatalogReviewRequestsForPlan"]>[0],
) {
  return Promise.all(input.plan.gaps.map(async (gap) => {
    const request = reviewRequestForGap({
      gap,
      rolePackageId: input.rolePackageId,
      roleListingId: input.roleListingId,
      requestedBy: input.requestedBy,
    });
    const [existing] = await (repository.listDijieCatalogReviewRequests?.(
      { review_key: request.review_key },
      { take: 1 },
    ) ?? []);
    if (existing) {
      return createDijieCatalogReviewRequestReadModel(existing);
    }
    const stored = await repository.createDijieCatalogReviewRequests(request);
    return createDijieCatalogReviewRequestReadModel({
      ...request,
      id: stored.id,
    });
  }));
}

function catalogItemFromReviewRequest(
  request: DijieCatalogReviewRequestStorageRecord,
  input: { reviewedBy?: string | null },
): DijieCatalogItemStorageRecord {
  const catalogRef =
    request.catalog_ref ??
    `${request.kind}.platform.${stableRef(request.need || request.review_key)}`;
  return storageFromCatalogItem(
    {
      id: catalogRef,
      kind: request.kind,
      name: request.need || catalogRef,
      version: "1.0.0",
      description:
        typeof request.candidate.description === "string"
          ? request.candidate.description
          : `审核通过的 ${request.kind}：${request.need}`,
      tags: [request.kind],
      provides: [request.need],
      source: request.source === "internal_build" ? "internal_build" : "opencloud",
      status: "approved",
      permissions: [],
      riskLevel: "medium",
      auditPolicy: ["audit.record"],
      keywords: [request.need],
    },
    input,
  );
}

export async function finalizeDijieCatalogReviewRequestWithRepository(
  repository: DijieCatalogLookupRepository & DijieCatalogMutationRepository,
  input: Parameters<DijieCatalogReviewStore["finalizeDijieCatalogReviewRequest"]>[0],
) {
  const [request] = await (repository.listDijieCatalogReviewRequests?.(
    { id: input.reviewId } as Partial<DijieCatalogReviewRequestStorageRecord>,
    { take: 1 },
  ) ?? []);
  if (!request?.id) {
    return { ok: false as const, status: 404, error: "未找到 Skill/Tool 入库审核请求。" };
  }
  if (request.review_status === "approved" || request.review_status === "rejected") {
    return { ok: false as const, status: 409, error: "该入库审核请求已完成。" };
  }

  await repository.updateDijieCatalogReviewRequests({
    id: request.id,
    review_status: input.result,
    reviewed_at: now(),
    reviewed_by: input.reviewedBy ?? null,
    review_note: input.reviewNote ?? null,
  });

  if (input.result === "approved") {
    const item = catalogItemFromReviewRequest(request, { reviewedBy: input.reviewedBy });
    const [existingItem] = await repository.listDijieCatalogItems(
      { catalog_ref: item.catalog_ref },
      { take: 1 },
    );
    if (existingItem?.id) {
      await repository.updateDijieCatalogItems({
        ...item,
        id: existingItem.id,
        created_at: existingItem.created_at,
      });
    } else {
      await repository.createDijieCatalogItems(item);
    }
  }

  return { ok: true as const };
}
