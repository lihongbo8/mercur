import {
  DIJIE_PLATFORM_SKILL_TOOL_CATALOG,
  type DijieCatalogItem,
  type DijieCatalogKind,
  type DijieCatalogStatus,
  type DijieRoleCapabilityPlan,
} from "./role-skill-tool-planner";
import type {
  DijieRoleListingLookupRepository,
  DijieRoleListingStorageRecord,
} from "./role-listing-store";

type UnknownRecord = Record<string, unknown>;

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

export type DijieSpecialCapabilityBindingSummary = {
  bindingId?: string;
  bindingKey: string;
  reviewRequestId: string;
  catalogRef: string;
  need: string;
  kind: DijieCatalogKind;
  rolePackageId: string | null;
  roleListingId: string;
  categoryRef: string | null;
  status: DijieSpecialCapabilityBindingStorageRecord["binding_status"];
  boundBy: string | null;
  boundAt: string;
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

export type DijieSpecialCapabilityBindingStorageRecord = {
  binding_key: string;
  review_request_id: string;
  catalog_ref: string;
  need: string;
  kind: DijieCatalogKind;
  role_package_id: string | null;
  role_listing_id: string;
  category_ref: string | null;
  binding_status: "bound" | "disabled";
  bound_by: string | null;
  bound_at: Date;
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
  listDijieSpecialCapabilityBindings?: (
    filters?: Partial<DijieSpecialCapabilityBindingStorageRecord>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieSpecialCapabilityBindingStorageRecord & { id?: string }>>;
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
  createDijieSpecialCapabilityBindings: (
    data: DijieSpecialCapabilityBindingStorageRecord,
  ) => Promise<{ id?: string }>;
  updateDijieSpecialCapabilityBindings: (
    data: Partial<DijieSpecialCapabilityBindingStorageRecord> & { id: string },
  ) => Promise<Array<DijieSpecialCapabilityBindingStorageRecord & { id?: string }>>;
};

export type DijieCatalogReader = {
  listDijieEffectiveCatalogItems: () => Promise<DijieCatalogItem[]>;
  listDijieCatalogReviewRequests: (input?: {
    status?: CatalogReviewStatus;
  }) => Promise<Array<DijieCatalogReviewRequestStorageRecord & { id?: string }>>;
  listDijieSpecialCapabilityBindings: (input?: {
    roleListingId?: string;
    rolePackageId?: string;
    status?: DijieSpecialCapabilityBindingStorageRecord["binding_status"];
  }) => Promise<Array<DijieSpecialCapabilityBindingStorageRecord & { id?: string }>>;
};

export type DijieCatalogReviewStore = {
  createDijieCatalogReviewRequestsForPlan: (input: {
    plan: DijieRoleCapabilityPlan;
    rolePackageId?: string | null;
    roleListingId?: string | null;
    requestedBy?: string | null;
  }) => Promise<DijieCatalogReviewRequestSummary[]>;
  createDijieSpecialCapabilityReviewRequest: (input: {
    need: string;
    kind: DijieCatalogKind;
    reason?: string | null;
    categoryRef?: string | null;
    rolePackageId?: string | null;
    roleListingId?: string | null;
    requestedBy?: string | null;
    candidate?: Record<string, unknown>;
    riskSummary?: Record<string, unknown>;
  }) => Promise<DijieCatalogReviewRequestSummary>;
  finalizeDijieCatalogReviewRequest: (input: {
    reviewId: string;
    result: "approved" | "rejected" | "request_changes";
    reviewedBy?: string | null;
    reviewNote?: string | null;
  }) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  bindDijieSpecialCapabilityToRole: (input: {
    reviewId: string;
    roleListingId: string;
    boundBy?: string | null;
    sellerId?: string | null;
  }) => Promise<
    | { ok: true; binding: DijieSpecialCapabilityBindingSummary }
    | { ok: false; status: number; error: string }
  >;
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

const FORBIDDEN_CATALOG_PAYLOAD_KEY_PATTERNS = [
  /^(api[_-]?key|provider[_-]?key|secret|token|bearer|authorization|private[_-]?key)$/iu,
  /(api[_-]?key|provider[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|oauth)/iu,
  /(source[_-]?code|implementation|executable|binary|archive|tarball|zip|adapter[_-]?code)/iu,
  /(mcp[_-]?server|server[_-]?implementation|tool[_-]?definition|tool[_-]?schema|raw[_-]?response|raw[_-]?request)/iu,
  /(connection[_-]?string|provider[_-]?auth|credential|env[_-]?value)/iu,
];

function isForbiddenCatalogPayloadKey(key: string) {
  return FORBIDDEN_CATALOG_PAYLOAD_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeCatalogBoundaryValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeCatalogBoundaryValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as UnknownRecord)
      .filter(([key]) => !isForbiddenCatalogPayloadKey(key))
      .map(([key, entry]) => [key, sanitizeCatalogBoundaryValue(entry)]),
  );
}

export function sanitizeDijieCatalogBoundaryPayload(value: Record<string, unknown>) {
  const sanitized = sanitizeCatalogBoundaryValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
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

export function createDijieSpecialCapabilityBindingReadModel(
  record: DijieSpecialCapabilityBindingStorageRecord & { id?: string },
): DijieSpecialCapabilityBindingSummary {
  return {
    bindingId: record.id,
    bindingKey: record.binding_key,
    reviewRequestId: record.review_request_id,
    catalogRef: record.catalog_ref,
    need: record.need,
    kind: record.kind,
    rolePackageId: record.role_package_id,
    roleListingId: record.role_listing_id,
    categoryRef: record.category_ref,
    status: record.binding_status,
    boundBy: record.bound_by,
    boundAt:
      record.bound_at instanceof Date
        ? record.bound_at.toISOString()
        : String(record.bound_at),
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

function sanitizeCatalogItemStorageRecord(
  record: DijieCatalogItemStorageRecord,
): DijieCatalogItemStorageRecord {
  return {
    ...record,
    payload: sanitizeDijieCatalogBoundaryPayload(record.payload),
  };
}

function sanitizeCatalogReviewRequestStorageRecord(
  record: DijieCatalogReviewRequestStorageRecord,
): DijieCatalogReviewRequestStorageRecord {
  return {
    ...record,
    candidate: sanitizeDijieCatalogBoundaryPayload(record.candidate),
    risk_summary: sanitizeDijieCatalogBoundaryPayload(record.risk_summary),
    payload: sanitizeDijieCatalogBoundaryPayload(record.payload),
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

export async function listDijieSpecialCapabilityBindingsWithRepository(
  repository: DijieCatalogLookupRepository,
  input: {
    roleListingId?: string;
    rolePackageId?: string;
    status?: DijieSpecialCapabilityBindingStorageRecord["binding_status"];
  } = {},
) {
  if (!repository.listDijieSpecialCapabilityBindings) {
    return [];
  }
  return repository.listDijieSpecialCapabilityBindings(
    {
      ...(input.roleListingId ? { role_listing_id: input.roleListingId } : {}),
      ...(input.rolePackageId ? { role_package_id: input.rolePackageId } : {}),
      ...(input.status ? { binding_status: input.status } : {}),
    },
    { take: 500, order: { bound_at: "DESC" } },
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
  return sanitizeCatalogReviewRequestStorageRecord({
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
  });
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

function specialCapabilityReviewRequest(input: Parameters<
  DijieCatalogReviewStore["createDijieSpecialCapabilityReviewRequest"]
>[0]): DijieCatalogReviewRequestStorageRecord {
  const reviewKey = stableRef(
    [
      "special-capability",
      input.kind,
      input.need,
      input.categoryRef ?? "no-category",
      input.rolePackageId ?? "no-package",
      input.roleListingId ?? "no-listing",
      input.requestedBy ?? "no-requester",
    ].join(":"),
  );
  return sanitizeCatalogReviewRequestStorageRecord({
    review_key: reviewKey,
    catalog_ref: null,
    need: input.need,
    kind: input.kind,
    source: "internal_build",
    review_status: "pending_review",
    role_package_id: input.rolePackageId ?? null,
    role_listing_id: input.roleListingId ?? null,
    requested_by: input.requestedBy ?? null,
    submitted_at: now(),
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
    candidate: {
      requestType: "special_capability_pack",
      need: input.need,
      kind: input.kind,
      reason: input.reason ?? null,
      categoryRef: input.categoryRef ?? null,
      ...(input.candidate ?? {}),
    },
    risk_summary: {
      riskLevel: "unknown",
      requiresHumanReview: true,
      ...(input.riskSummary ?? {}),
    },
    payload: {
      requestType: "special_capability_pack",
      categoryRef: input.categoryRef ?? null,
      rolePackageId: input.rolePackageId ?? null,
      roleListingId: input.roleListingId ?? null,
    },
  });
}

export async function createDijieSpecialCapabilityReviewRequestWithRepository(
  repository: DijieCatalogLookupRepository & DijieCatalogMutationRepository,
  input: Parameters<DijieCatalogReviewStore["createDijieSpecialCapabilityReviewRequest"]>[0],
) {
  const request = specialCapabilityReviewRequest(input);
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
}

function catalogRefForReviewRequest(request: DijieCatalogReviewRequestStorageRecord) {
  return request.catalog_ref ?? `${request.kind}.platform.${stableRef(request.need || request.review_key)}`;
}

function sellerCanAccessListing(
  listing: DijieRoleListingStorageRecord,
  sellerId: string | null | undefined,
) {
  if (!sellerId) {
    return false;
  }
  return (
    listing.developer_ref === sellerId ||
    listing.listing_owner_ref === sellerId ||
    listing.billing_beneficiary_ref === sellerId
  );
}

function actorCanAccessListing(
  listing: DijieRoleListingStorageRecord,
  input: { boundBy?: string | null; sellerId?: string | null },
) {
  if (sellerCanAccessListing(listing, input.sellerId)) {
    return true;
  }
  return Boolean(listing.owner_id && input.boundBy && listing.owner_id === input.boundBy);
}

function bindingRecordForSpecialCapability(input: {
  request: DijieCatalogReviewRequestStorageRecord & { id?: string };
  listing: DijieRoleListingStorageRecord & { id: string };
  boundBy?: string | null;
}): DijieSpecialCapabilityBindingStorageRecord {
  const catalogRef = catalogRefForReviewRequest(input.request);
  const reviewRequestId = input.request.id ?? input.request.review_key;
  return sanitizeSpecialCapabilityBindingStorageRecord({
    binding_key: stableRef([
      "special-capability-binding",
      reviewRequestId,
      input.listing.id,
      catalogRef,
    ].join(":")),
    review_request_id: reviewRequestId,
    catalog_ref: catalogRef,
    need: input.request.need,
    kind: input.request.kind,
    role_package_id: input.listing.package_id ?? input.request.role_package_id,
    role_listing_id: input.listing.id,
    category_ref:
      typeof input.request.payload.categoryRef === "string"
        ? input.request.payload.categoryRef
        : input.listing.category_ref ?? null,
    binding_status: "bound",
    bound_by: input.boundBy ?? null,
    bound_at: now(),
    payload: {
      requestType: "special_capability_binding",
      sourceReviewKey: input.request.review_key,
    },
  });
}

function sanitizeSpecialCapabilityBindingStorageRecord(
  record: DijieSpecialCapabilityBindingStorageRecord,
): DijieSpecialCapabilityBindingStorageRecord {
  return {
    ...record,
    payload: sanitizeDijieCatalogBoundaryPayload(record.payload),
  };
}

export async function bindDijieSpecialCapabilityToRoleWithRepository(
  repository: DijieCatalogLookupRepository &
    DijieCatalogMutationRepository &
    DijieRoleListingLookupRepository,
  input: Parameters<DijieCatalogReviewStore["bindDijieSpecialCapabilityToRole"]>[0],
) {
  const [request] = await (repository.listDijieCatalogReviewRequests?.(
    { id: input.reviewId } as Partial<DijieCatalogReviewRequestStorageRecord>,
    { take: 1 },
  ) ?? []);
  if (!request?.id) {
    return { ok: false as const, status: 404, error: "未找到特殊能力包申请。" };
  }
  if (request.payload?.requestType !== "special_capability_pack") {
    return { ok: false as const, status: 409, error: "该审核单不是特殊能力包申请。" };
  }
  if (request.review_status !== "approved") {
    return { ok: false as const, status: 409, error: "特殊能力包必须审核通过后才能绑定。" };
  }

  const [listing] = await repository.listDijieRoleListings(
    { id: input.roleListingId },
    { take: 1 },
  );
  if (!listing) {
    return { ok: false as const, status: 404, error: "未找到要绑定的岗位商品。" };
  }
  if (!actorCanAccessListing(listing, input)) {
    return { ok: false as const, status: 403, error: "当前账号无权绑定该岗位商品。" };
  }

  const binding = bindingRecordForSpecialCapability({
    request,
    listing,
    boundBy: input.boundBy,
  });
  const [existing] = await (repository.listDijieSpecialCapabilityBindings?.(
    { binding_key: binding.binding_key },
    { take: 1 },
  ) ?? []);
  if (existing) {
    if (existing.binding_status === "disabled" && existing.id) {
      const [updated] = await repository.updateDijieSpecialCapabilityBindings({
        id: existing.id,
        binding_status: "bound",
        bound_by: input.boundBy ?? existing.bound_by,
        bound_at: now(),
      });
      return {
        ok: true as const,
        binding: createDijieSpecialCapabilityBindingReadModel(updated ?? existing),
      };
    }
    return {
      ok: true as const,
      binding: createDijieSpecialCapabilityBindingReadModel(existing),
    };
  }

  const stored = await repository.createDijieSpecialCapabilityBindings(binding);
  return {
    ok: true as const,
    binding: createDijieSpecialCapabilityBindingReadModel({
      ...binding,
      id: stored.id,
    }),
  };
}

function catalogItemFromReviewRequest(
  request: DijieCatalogReviewRequestStorageRecord,
  input: { reviewedBy?: string | null },
): DijieCatalogItemStorageRecord {
  const catalogRef = catalogRefForReviewRequest(request);
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
    return { ok: false as const, status: 404, error: "未找到能力目录审核请求。" };
  }
  if (request.review_status === "approved" || request.review_status === "rejected") {
    return { ok: false as const, status: 409, error: "该入库审核请求已完成。" };
  }

  const approvedCatalogRef = input.result === "approved" ? catalogRefForReviewRequest(request) : null;
  await repository.updateDijieCatalogReviewRequests({
    id: request.id,
    review_status: input.result,
    ...(approvedCatalogRef ? { catalog_ref: approvedCatalogRef } : {}),
    reviewed_at: now(),
    reviewed_by: input.reviewedBy ?? null,
    review_note: input.reviewNote ?? null,
  });

  if (input.result === "approved") {
    const item = sanitizeCatalogItemStorageRecord(
      catalogItemFromReviewRequest(
        { ...request, catalog_ref: approvedCatalogRef },
        { reviewedBy: input.reviewedBy },
      ),
    );
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
