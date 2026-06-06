import {
  normalizeOneTimeAuthorizationPricing,
  normalizeRoleTokenPricing,
  type DijieExecutionTokenPricing,
  type DijieRoleTokenPricing,
} from "./execution-token";
import type { DijieRoleManifestSummary } from "./role-product-metadata";

export type DijieStoredRoleListingStatus =
  | "draft"
  | "proposed"
  | "published"
  | "delisted"
  | "archived";

export type DijieStoredRoleReviewState =
  | "draft"
  | "submitted"
  | "needs_changes"
  | "approved"
  | "rejected";

export type DijieRoleListingStorageRecord = {
  id?: string;
  package_id: string;
  package_version: string;
  owner_id: string | null;
  developer_ref: string;
  listing_owner_ref: string;
  billing_beneficiary_ref: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  listing_status: DijieStoredRoleListingStatus;
  review_state: DijieStoredRoleReviewState;
  capabilities: string[];
  manifest_summary: DijieRoleManifestSummary;
  pricing: DijieExecutionTokenPricing;
  role_token_pricing: DijieRoleTokenPricing;
  scopes: string[];
  confirmation_points: number;
  submitted_at: Date | null;
  published_at: Date | null;
};

export type DijieRoleListingRepository = {
  createDijieRoleListings: (
    data: Omit<DijieRoleListingStorageRecord, "id">,
  ) => Promise<DijieRoleListingStorageRecord & { id: string }>;
};

export type DijieRoleListingLookupRepository = {
  listDijieRoleListings: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRoleListingStorageRecord & { id: string }>>;
};

export type DijieRoleListingUpdateRepository = {
  updateDijieRoleListings: (
    data: Partial<Omit<DijieRoleListingStorageRecord, "id">> & { id: string },
  ) => Promise<DijieRoleListingStorageRecord & { id: string }>;
};

export type DijieRoleListingMutationSuccess = {
  roleListingId: string;
  listing: DijieRoleListingStorageRecord & { id: string };
};

export type DijieRoleListingMutationResult =
  | {
      ok: true;
      value: DijieRoleListingMutationSuccess;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export type DijieRoleListingStore = {
  createDijieRoleListing: (
    input: CreateDijieRoleListingInput,
  ) => Promise<DijieRoleListingMutationResult>;
  updateDijieRoleListingDraft: (
    input: UpdateDijieRoleListingInput,
  ) => Promise<DijieRoleListingMutationResult>;
  submitDijieRoleListingForReview: (input: {
    roleListingId: string;
    ownerId?: string;
  }) => Promise<DijieRoleListingMutationResult>;
};

export type DijieRoleListingReader = {
  retrieveDijieRoleListing: (input: {
    roleListingId: string;
  }) => Promise<(DijieRoleListingStorageRecord & { id: string }) | undefined>;
  listDijieStoredRoleListings: (input?: {
    publicOnly?: boolean;
    ownerId?: string;
    take?: number;
  }) => Promise<Array<DijieRoleListingStorageRecord & { id: string }>>;
};

export type CreateDijieRoleListingInput = {
  packageId: string;
  packageVersion: string;
  ownerId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  developerRef?: string;
  listingOwnerRef?: string;
  billingBeneficiaryRef?: string;
  capabilities?: string[];
  manifestSummary: DijieRoleManifestSummary;
  pricing?: unknown;
  roleTokenPricing?: unknown;
  confirmationPoints?: number;
};

export type UpdateDijieRoleListingInput = {
  roleListingId: string;
  ownerId?: string;
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  category?: string | null;
  capabilities?: string[];
  pricing?: unknown;
  roleTokenPricing?: unknown;
  confirmationPoints?: number;
};

export type DijieRoleListingCommandResult =
  | {
      ok: true;
      value: Omit<DijieRoleListingStorageRecord, "id">;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

const DEFAULT_SCOPES = ["role.execute", "audit.write"];

const DEFAULT_AUTHORIZATION_PRICING: DijieExecutionTokenPricing = {
  kind: "one_time_authorization",
  authorizationFeeCents: 0,
  currency: "CNY",
  platformFeeBps: 0,
  developerReceivableCents: 0,
};

const DEFAULT_ROLE_TOKEN_PRICING: DijieRoleTokenPricing = {
  inputTokenCentsPerMillion: 0,
  outputTokenCentsPerMillion: 0,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nullableString(value: string | null | undefined): string | null | undefined {
  if (value === null) {
    return null;
  }
  return nonEmptyString(value);
}

function stringArray(value: unknown): string[] {
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

function confirmationPoints(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function listingCapabilities(input: CreateDijieRoleListingInput): string[] {
  const explicit = stringArray(input.capabilities);
  if (explicit.length > 0) {
    return explicit;
  }
  return stringArray(input.manifestSummary.requiredCapabilities);
}

function pricingOrDefault(value: unknown): DijieExecutionTokenPricing | undefined {
  if (value === undefined) {
    return DEFAULT_AUTHORIZATION_PRICING;
  }
  return normalizeOneTimeAuthorizationPricing(value);
}

function roleTokenPricingOrDefault(value: unknown): DijieRoleTokenPricing | undefined {
  if (value === undefined) {
    return DEFAULT_ROLE_TOKEN_PRICING;
  }
  return normalizeRoleTokenPricing(value);
}

export function createDijieRoleListingDraftRecord(
  input: CreateDijieRoleListingInput,
): DijieRoleListingCommandResult {
  const title = nonEmptyString(input.title);
  if (!title) {
    return { ok: false, status: 400, error: "岗位商品标题不能为空。" };
  }
  if (!nonEmptyString(input.packageId) || !nonEmptyString(input.packageVersion)) {
    return { ok: false, status: 400, error: "岗位商品必须关联已上传的岗位包。" };
  }

  const developerRef = nonEmptyString(input.developerRef) ?? nonEmptyString(input.ownerId);
  const listingOwnerRef =
    nonEmptyString(input.listingOwnerRef) ?? nonEmptyString(input.ownerId) ?? developerRef;
  const billingBeneficiaryRef =
    nonEmptyString(input.billingBeneficiaryRef) ?? developerRef;
  if (!developerRef || !listingOwnerRef || !billingBeneficiaryRef) {
    return { ok: false, status: 400, error: "岗位商品缺少开发者账号归属。" };
  }

  const pricing = pricingOrDefault(input.pricing);
  const roleTokenPricing = roleTokenPricingOrDefault(input.roleTokenPricing);
  if (!pricing) {
    return { ok: false, status: 400, error: "岗位授权费必须是一次性 CNY 授权费，平台抽成为 0。" };
  }
  if (!roleTokenPricing) {
    return { ok: false, status: 400, error: "岗位模型计费必须是 CNY，平台抽成为 0。" };
  }

  return {
    ok: true,
    value: {
      package_id: input.packageId,
      package_version: input.packageVersion,
      owner_id: input.ownerId?.trim() || null,
      developer_ref: developerRef,
      listing_owner_ref: listingOwnerRef,
      billing_beneficiary_ref: billingBeneficiaryRef,
      title,
      subtitle: nonEmptyString(input.subtitle) ?? null,
      description: nonEmptyString(input.description) ?? null,
      category: nonEmptyString(input.category) ?? null,
      listing_status: "draft",
      review_state: "draft",
      capabilities: listingCapabilities(input),
      manifest_summary: input.manifestSummary,
      pricing,
      role_token_pricing: roleTokenPricing,
      scopes: DEFAULT_SCOPES,
      confirmation_points: confirmationPoints(input.confirmationPoints),
      submitted_at: null,
      published_at: null,
    },
  };
}

function assertOwner(
  listing: DijieRoleListingStorageRecord,
  ownerId: string | undefined,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!listing.owner_id) {
    return { ok: true };
  }
  if (!ownerId) {
    return { ok: false, status: 401, error: "操作岗位商品需要登录。" };
  }
  if (listing.owner_id !== ownerId) {
    return { ok: false, status: 403, error: "当前账号无权操作该岗位商品。" };
  }
  return { ok: true };
}

function assertDraftEditable(
  listing: DijieRoleListingStorageRecord,
): { ok: true } | { ok: false; status: number; error: string } {
  if (
    listing.listing_status !== "draft" ||
    (listing.review_state !== "draft" && listing.review_state !== "needs_changes")
  ) {
    return { ok: false, status: 409, error: "只有草稿岗位商品可以编辑。" };
  }
  return { ok: true };
}

export async function createDijieRoleListingWithRepository(
  repository: DijieRoleListingRepository,
  input: CreateDijieRoleListingInput,
) {
  const record = createDijieRoleListingDraftRecord(input);
  if (!record.ok) {
    return record;
  }

  const created = await repository.createDijieRoleListings(record.value);
  return {
    ok: true as const,
    value: {
      roleListingId: created.id,
      listing: created,
    },
  };
}

export async function retrieveDijieRoleListingWithRepository(
  repository: DijieRoleListingLookupRepository,
  input: { roleListingId: string },
) {
  const [listing] = await repository.listDijieRoleListings(
    { id: input.roleListingId },
    { take: 1 },
  );
  return listing;
}

export async function listDijieStoredRoleListingsWithRepository(
  repository: DijieRoleListingLookupRepository,
  input: { publicOnly?: boolean; ownerId?: string; take?: number } = {},
) {
  return repository.listDijieRoleListings(
    {
      ...(input.publicOnly
        ? {
            listing_status: "published",
            review_state: "approved",
          }
        : {}),
      ...(input.ownerId ? { owner_id: input.ownerId } : {}),
    },
    {
      take: input.take ?? 100,
      order: { submitted_at: "DESC" },
    },
  );
}

export function createDijieRoleListingManagementReadModel(
  record: DijieRoleListingStorageRecord & { id: string },
) {
  return {
    id: record.id,
    roleListingId: record.id,
    packageId: record.package_id,
    packageVersion: record.package_version,
    ownerId: record.owner_id,
    developerRef: record.developer_ref,
    listingOwnerRef: record.listing_owner_ref,
    billingBeneficiaryRef: record.billing_beneficiary_ref,
    title: record.title,
    subtitle: record.subtitle,
    description: record.description,
    category: record.category,
    listingStatus: record.listing_status,
    reviewState: record.review_state,
    capabilities: record.capabilities,
    pricing: record.pricing,
    roleTokenPricing: record.role_token_pricing,
    confirmationPoints: record.confirmation_points,
    submittedAt: record.submitted_at instanceof Date
      ? record.submitted_at.toISOString()
      : record.submitted_at,
    publishedAt: record.published_at instanceof Date
      ? record.published_at.toISOString()
      : record.published_at,
    packageDownload: {
      available: true,
      url: `/vendor/dijie/role-packages/${encodeURIComponent(
        record.package_id,
      )}/download?version=${encodeURIComponent(record.package_version)}`,
    },
  };
}

export async function updateDijieRoleListingDraftWithRepository(
  repository: DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
  input: UpdateDijieRoleListingInput,
) {
  const listing = await retrieveDijieRoleListingWithRepository(repository, {
    roleListingId: input.roleListingId,
  });
  if (!listing) {
    return { ok: false as const, status: 404, error: "未找到岗位商品。" };
  }

  const owner = assertOwner(listing, input.ownerId);
  if (!owner.ok) {
    return owner;
  }
  const editable = assertDraftEditable(listing);
  if (!editable.ok) {
    return editable;
  }

  const pricing =
    input.pricing === undefined ? undefined : normalizeOneTimeAuthorizationPricing(input.pricing);
  const roleTokenPricing =
    input.roleTokenPricing === undefined
      ? undefined
      : normalizeRoleTokenPricing(input.roleTokenPricing);
  if (input.pricing !== undefined && !pricing) {
    return { ok: false as const, status: 400, error: "岗位授权费必须是一致的 CNY 一次性授权费。" };
  }
  if (input.roleTokenPricing !== undefined && !roleTokenPricing) {
    return { ok: false as const, status: 400, error: "岗位模型计费必须是 CNY，平台抽成为 0。" };
  }

  const updated = await repository.updateDijieRoleListings({
    id: input.roleListingId,
    ...(nonEmptyString(input.title) ? { title: nonEmptyString(input.title) } : {}),
    ...(input.subtitle !== undefined ? { subtitle: nullableString(input.subtitle) ?? null } : {}),
    ...(input.description !== undefined
      ? { description: nullableString(input.description) ?? null }
      : {}),
    ...(input.category !== undefined ? { category: nullableString(input.category) ?? null } : {}),
    ...(input.capabilities !== undefined ? { capabilities: stringArray(input.capabilities) } : {}),
    ...(pricing ? { pricing } : {}),
    ...(roleTokenPricing ? { role_token_pricing: roleTokenPricing } : {}),
    ...(input.confirmationPoints !== undefined
      ? { confirmation_points: confirmationPoints(input.confirmationPoints) }
      : {}),
  });

  return {
    ok: true as const,
    value: {
      roleListingId: updated.id,
      listing: updated,
    },
  };
}

export async function submitDijieRoleListingForReviewWithRepository(
  repository: DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
  input: { roleListingId: string; ownerId?: string },
) {
  const listing = await retrieveDijieRoleListingWithRepository(repository, {
    roleListingId: input.roleListingId,
  });
  if (!listing) {
    return { ok: false as const, status: 404, error: "未找到岗位商品。" };
  }

  const owner = assertOwner(listing, input.ownerId);
  if (!owner.ok) {
    return owner;
  }
  const editable = assertDraftEditable(listing);
  if (!editable.ok) {
    return editable;
  }

  const updated = await repository.updateDijieRoleListings({
    id: input.roleListingId,
    listing_status: "proposed",
    review_state: "submitted",
    submitted_at: new Date(),
  });

  return {
    ok: true as const,
    value: {
      roleListingId: updated.id,
      listing: updated,
    },
  };
}
