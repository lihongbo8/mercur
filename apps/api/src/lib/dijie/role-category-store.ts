import type {
  DijieRoleCategory,
  DijieRoleCategoryPackBinding,
  DijieRoleCategoryStatus,
} from "./role-category-registry";
import { normalizeDijieRoleCategoryRecord } from "./role-category-registry";
import type { DijieRoleListingStorageRecord } from "./role-listing-store";
import type { DijieCatalogItem } from "./role-skill-tool-planner";

type UnknownRecord = Record<string, unknown>;

export type DijieRoleCategoryStorageRecord = {
  id?: string;
  category_ref: string;
  name: string;
  version: string;
  description: string;
  category_status: DijieRoleCategoryStatus;
  pack_binding: Record<string, unknown>;
  risk_policy: Record<string, unknown>;
  review_policy: Record<string, unknown>;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type DijieRoleCategoryRepository = {
  createDijieRoleCategories: (
    data: Omit<DijieRoleCategoryStorageRecord, "id">,
  ) => Promise<DijieRoleCategoryStorageRecord & { id: string }>;
};

export type DijieRoleCategoryLookupRepository = {
  listDijieRoleCategories: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRoleCategoryStorageRecord & { id?: string }>>;
};

export type DijieRoleCategoryUpdateRepository = {
  updateDijieRoleCategories: (
    data: Partial<Omit<DijieRoleCategoryStorageRecord, "id">> & { id: string },
  ) => Promise<DijieRoleCategoryStorageRecord & { id: string }>;
};

export type DijieRoleCategoryMutationResult =
  | {
      ok: true;
      value: {
        categoryRef: string;
        category: DijieRoleCategoryStorageRecord & { id?: string };
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type DijieRoleCategoryReadModel = DijieRoleCategory & {
  id?: string;
  blockerReasons: string[];
  allowedActions: string[];
  usage: {
    roleListingCount: number;
    publishedRoleListingCount: number;
  };
};

export type DijieRoleCategoryAdminReadModel = {
  categories: DijieRoleCategoryReadModel[];
  approvedCatalogItems: Array<
    Pick<
      DijieCatalogItem,
      | "id"
      | "kind"
      | "name"
      | "version"
      | "description"
      | "provides"
      | "permissions"
      | "riskLevel"
      | "source"
      | "status"
    >
  >;
};

export type DijieRoleCategoryStore = {
  createDijieRoleCategoryRecord: (input: {
    categoryRef: string;
    name: string;
    version: string;
    description?: string;
    createdBy?: string | null;
  }) => Promise<DijieRoleCategoryMutationResult>;
  updateDijieRoleCategoryRecord: (input: {
    categoryRef: string;
    name?: string;
    version?: string;
    description?: string;
    riskPolicy?: Record<string, unknown>;
    reviewPolicy?: Record<string, unknown>;
  }) => Promise<DijieRoleCategoryMutationResult>;
  bindDijieRoleCategoryPack: (input: {
    categoryRef: string;
    categoryPackRef: string;
    skillPackRef: string;
    toolPackRef: string;
    catalogRefs: string[];
    catalogItems: DijieCatalogItem[];
    riskPolicyRef?: string | null;
    reviewPolicyRef?: string | null;
  }) => Promise<DijieRoleCategoryMutationResult>;
  submitDijieRoleCategoryReview: (input: {
    categoryRef: string;
  }) => Promise<DijieRoleCategoryMutationResult>;
  finalizeDijieRoleCategoryReview: (input: {
    categoryRef: string;
    result: "approved" | "request_changes";
    reviewedBy?: string | null;
    reviewNote?: string | null;
  }) => Promise<DijieRoleCategoryMutationResult>;
  disableDijieRoleCategory: (input: {
    categoryRef: string;
    disabledBy?: string | null;
    reason?: string | null;
  }) => Promise<DijieRoleCategoryMutationResult>;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dateField(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  const date =
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function nullableDateField(value: unknown): Date | null {
  return value === null || value === undefined ? null : dateField(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function categoryRefValid(value: string): boolean {
  return /^category:[a-z0-9][a-z0-9._-]*@\d+$/u.test(value);
}

function packRefValid(value: string, prefix: "categorypack" | "skillpack" | "toolpack") {
  return new RegExp(`^${prefix}:[a-z0-9][a-z0-9._-]*@\\d+$`, "u").test(value);
}

function normalizedCategory(record: unknown): DijieRoleCategory | undefined {
  return normalizeDijieRoleCategoryRecord(record);
}

export function normalizeDijieRoleCategoryStorageRecord(
  value: unknown,
): (DijieRoleCategoryStorageRecord & { id?: string }) | undefined {
  const record = asRecord(value);
  const categoryRef = stringField(record, "category_ref") ?? stringField(record, "categoryRef");
  const name = stringField(record, "name");
  const version = stringField(record, "version");
  const status =
    stringField(record, "category_status") ?? stringField(record, "status");
  if (!categoryRef || !name || !version || !status) {
    return undefined;
  }
  return {
    ...(stringField(record, "id") ? { id: stringField(record, "id") } : {}),
    category_ref: categoryRef,
    name,
    version,
    description: stringField(record, "description") ?? "",
    category_status: status as DijieRoleCategoryStatus,
    pack_binding: asRecord(record.pack_binding ?? record.packBinding),
    risk_policy: asRecord(record.risk_policy ?? record.riskPolicy),
    review_policy: asRecord(record.review_policy ?? record.reviewPolicy),
    reviewed_at: nullableDateField(record.reviewed_at ?? record.reviewedAt),
    reviewed_by:
      stringField(record, "reviewed_by") ?? stringField(record, "reviewedBy") ?? null,
    ...(record.created_at || record.createdAt
      ? { created_at: dateField(record.created_at ?? record.createdAt) }
      : {}),
    ...(record.updated_at || record.updatedAt
      ? { updated_at: dateField(record.updated_at ?? record.updatedAt) }
      : {}),
  };
}

function createEmptyBinding(): Record<string, unknown> {
  return {};
}

async function retrieveCategory(
  repository: DijieRoleCategoryLookupRepository,
  categoryRef: string,
) {
  const records = await repository.listDijieRoleCategories(
    { category_ref: categoryRef },
    { take: 1 },
  );
  return records[0];
}

function mutationError(status: number, error: string): DijieRoleCategoryMutationResult {
  return { ok: false, status, error };
}

function mutationSuccess(
  category: DijieRoleCategoryStorageRecord & { id?: string },
): DijieRoleCategoryMutationResult {
  return {
    ok: true,
    value: {
      categoryRef: category.category_ref,
      category,
    },
  };
}

function ensureEditable(record: DijieRoleCategoryStorageRecord) {
  return (
    record.category_status === "draft" ||
    record.category_status === "pending_review" ||
    record.category_status === "disabled"
  );
}

function bindingFromCatalogItems(input: {
  categoryPackRef: string;
  skillPackRef: string;
  toolPackRef: string;
  catalogRefs: string[];
  catalogItems: DijieCatalogItem[];
  riskPolicyRef?: string | null;
  reviewPolicyRef?: string | null;
}): { ok: true; binding: DijieRoleCategoryPackBinding } | { ok: false; error: string } {
  const catalogRefs = unique(input.catalogRefs);
  if (!packRefValid(input.categoryPackRef, "categorypack")) {
    return { ok: false, error: "categoryPackRef 格式必须类似 categorypack:name@1。" };
  }
  if (!packRefValid(input.skillPackRef, "skillpack")) {
    return { ok: false, error: "skillPackRef 格式必须类似 skillpack:name@1。" };
  }
  if (!packRefValid(input.toolPackRef, "toolpack")) {
    return { ok: false, error: "toolPackRef 格式必须类似 toolpack:name@1。" };
  }
  if (catalogRefs.length === 0) {
    return { ok: false, error: "品类包必须至少绑定一个已审核能力引用。" };
  }

  const byRef = new Map(input.catalogItems.map((item) => [item.id, item]));
  const missing = catalogRefs.filter((ref) => !byRef.has(ref));
  if (missing.length > 0) {
    return { ok: false, error: `能力引用不存在：${missing.slice(0, 3).join("、")}` };
  }
  const notApproved = catalogRefs
    .map((ref) => byRef.get(ref))
    .filter((item): item is DijieCatalogItem => Boolean(item && item.status !== "approved"));
  if (notApproved.length > 0) {
    return {
      ok: false,
      error: `只能绑定已审核能力引用：${notApproved
        .slice(0, 3)
        .map((item) => `${item.id}=${item.status}`)
        .join("、")}`,
    };
  }

  const selected = catalogRefs
    .map((ref) => byRef.get(ref))
    .filter((item): item is DijieCatalogItem => Boolean(item));

  return {
    ok: true,
    binding: {
      categoryPackRef: input.categoryPackRef,
      skillPackRef: input.skillPackRef,
      toolPackRef: input.toolPackRef,
      riskPolicyRef: input.riskPolicyRef ?? undefined,
      reviewPolicyRef: input.reviewPolicyRef ?? undefined,
      catalogRefs,
      capabilityRefs: unique(selected.flatMap((item) => item.provides)),
      permissionSummary: unique(selected.flatMap((item) => item.permissions)),
    },
  };
}

function hasValidBinding(category: DijieRoleCategory | undefined): boolean {
  const binding = category?.packBinding;
  return Boolean(
    binding?.categoryPackRef &&
      binding.skillPackRef &&
      binding.toolPackRef &&
      binding.catalogRefs.length > 0 &&
      binding.capabilityRefs.length > 0,
  );
}

export async function listDijieRoleCategoryRecordsWithRepository(
  repository: DijieRoleCategoryLookupRepository,
) {
  const records = await repository.listDijieRoleCategories(undefined, {
    take: 500,
    order: { updated_at: "DESC" },
  });
  return records.map(normalizeDijieRoleCategoryStorageRecord).filter(Boolean) as Array<
    DijieRoleCategoryStorageRecord & { id?: string }
  >;
}

export function createDijieRoleCategoryAdminReadModel(input: {
  categories: Array<DijieRoleCategoryStorageRecord & { id?: string }>;
  catalogItems?: DijieCatalogItem[];
  roleListings?: Array<Partial<DijieRoleListingStorageRecord> & { id?: string }>;
}): DijieRoleCategoryAdminReadModel {
  const roleListings = input.roleListings ?? [];
  const categories = input.categories
    .map((record): DijieRoleCategoryReadModel | undefined => {
      const category = normalizedCategory(record);
      if (!category) {
        return undefined;
      }
      const matchingListings = roleListings.filter(
        (listing) => listing.category_ref === category.categoryRef,
      );
      const blockerReasons: string[] = [];
      if (!hasValidBinding(category)) {
        blockerReasons.push("缺少有效 Skill/Tool 品类包绑定。");
      }
      if (category.status !== "approved") {
        blockerReasons.push(`当前状态为 ${category.status}，尚未启用。`);
      }
      const allowedActions = [
        ...(category.status === "draft" ? ["update", "bind_pack", "submit_review"] : []),
        ...(category.status === "pending_review"
          ? ["update", "bind_pack", "approve", "request_changes"]
          : []),
        ...(category.status === "approved" ? ["disable"] : []),
        ...(category.status === "disabled" ? ["update", "bind_pack", "submit_review"] : []),
      ];
      return {
        ...category,
        id: record.id,
        blockerReasons,
        allowedActions,
        usage: {
          roleListingCount: matchingListings.length,
          publishedRoleListingCount: matchingListings.filter(
            (listing) => listing.listing_status === "published",
          ).length,
        },
      };
    })
    .filter((category): category is DijieRoleCategoryReadModel => Boolean(category));

  return {
    categories,
    approvedCatalogItems: (input.catalogItems ?? [])
      .filter((item) => item.status === "approved")
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        version: item.version,
        description: item.description,
        provides: item.provides,
        permissions: item.permissions,
        riskLevel: item.riskLevel,
        source: item.source,
        status: item.status,
      })),
  };
}

export async function createDijieRoleCategoryRecordWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryRepository,
  input: Parameters<DijieRoleCategoryStore["createDijieRoleCategoryRecord"]>[0],
) {
  const categoryRef = input.categoryRef.trim();
  if (!categoryRefValid(categoryRef)) {
    return mutationError(400, "categoryRef 格式必须类似 category:name@1。");
  }
  if (!input.name?.trim()) {
    return mutationError(400, "品类名称不能为空。");
  }
  if (!input.version?.trim()) {
    return mutationError(400, "品类版本不能为空。");
  }
  const existing = await repository.listDijieRoleCategories(
    { category_ref: categoryRef },
    { take: 1 },
  );
  if (existing.length > 0) {
    return mutationError(409, "该品类引用已存在。");
  }

  const record = await repository.createDijieRoleCategories({
    category_ref: categoryRef,
    name: input.name.trim(),
    version: input.version.trim(),
    description: input.description?.trim() ?? "",
    category_status: "draft",
    pack_binding: createEmptyBinding(),
    risk_policy: { createdBy: input.createdBy ?? null },
    review_policy: { requiresApprovedCatalogRefs: true },
    reviewed_at: null,
    reviewed_by: null,
  });
  return mutationSuccess(record);
}

export async function updateDijieRoleCategoryRecordWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryUpdateRepository,
  input: Parameters<DijieRoleCategoryStore["updateDijieRoleCategoryRecord"]>[0],
) {
  const record = await retrieveCategory(repository, input.categoryRef);
  if (!record?.id) {
    return mutationError(404, "未找到平台品类。");
  }
  if (!ensureEditable(record)) {
    return mutationError(409, "已启用品类不能直接修改，请创建新版本品类。");
  }
  const updated = await repository.updateDijieRoleCategories({
    id: record.id,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.version !== undefined ? { version: input.version.trim() } : {}),
    ...(input.description !== undefined
      ? { description: input.description.trim() }
      : {}),
    ...(input.riskPolicy ? { risk_policy: input.riskPolicy } : {}),
    ...(input.reviewPolicy ? { review_policy: input.reviewPolicy } : {}),
  });
  return mutationSuccess(updated);
}

export async function bindDijieRoleCategoryPackWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryUpdateRepository,
  input: Parameters<DijieRoleCategoryStore["bindDijieRoleCategoryPack"]>[0],
) {
  const record = await retrieveCategory(repository, input.categoryRef);
  if (!record?.id) {
    return mutationError(404, "未找到平台品类。");
  }
  if (!ensureEditable(record)) {
    return mutationError(409, "已启用品类不能直接修改包绑定，请创建新版本品类。");
  }
  const binding = bindingFromCatalogItems(input);
  if (!binding.ok) {
    return mutationError(400, binding.error);
  }
  const updated = await repository.updateDijieRoleCategories({
    id: record.id,
    pack_binding: binding.binding as unknown as Record<string, unknown>,
    risk_policy: {
      ...record.risk_policy,
      riskPolicyRef: binding.binding.riskPolicyRef ?? null,
      highestRiskLevel: highestRiskLevel(input.catalogItems, binding.binding.catalogRefs),
    },
    review_policy: {
      ...record.review_policy,
      reviewPolicyRef: binding.binding.reviewPolicyRef ?? null,
      requiresApprovedCatalogRefs: true,
    },
  });
  return mutationSuccess(updated);
}

function highestRiskLevel(catalogItems: DijieCatalogItem[], catalogRefs: string[]) {
  const rank = { low: 1, medium: 2, high: 3 } as const;
  const byRef = new Map(catalogItems.map((item) => [item.id, item]));
  return catalogRefs.reduce<"low" | "medium" | "high">((highest, ref) => {
    const item = byRef.get(ref);
    if (!item) {
      return highest;
    }
    return rank[item.riskLevel] > rank[highest] ? item.riskLevel : highest;
  }, "low");
}

export async function submitDijieRoleCategoryReviewWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryUpdateRepository,
  input: Parameters<DijieRoleCategoryStore["submitDijieRoleCategoryReview"]>[0],
) {
  const record = await retrieveCategory(repository, input.categoryRef);
  if (!record?.id) {
    return mutationError(404, "未找到平台品类。");
  }
  if (record.category_status !== "draft" && record.category_status !== "disabled") {
    return mutationError(409, "只有草稿或已禁用品类可以提交审核。");
  }
  if (!hasValidBinding(normalizedCategory(record))) {
    return mutationError(409, "提交品类审核前必须绑定有效 Skill/Tool 品类包。");
  }
  const updated = await repository.updateDijieRoleCategories({
    id: record.id,
    category_status: "pending_review",
  });
  return mutationSuccess(updated);
}

export async function finalizeDijieRoleCategoryReviewWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryUpdateRepository,
  input: Parameters<DijieRoleCategoryStore["finalizeDijieRoleCategoryReview"]>[0],
) {
  const record = await retrieveCategory(repository, input.categoryRef);
  if (!record?.id) {
    return mutationError(404, "未找到平台品类。");
  }
  if (record.category_status !== "pending_review") {
    return mutationError(409, "只有待审核品类可以完成审核。");
  }
  if (input.result === "approved" && !hasValidBinding(normalizedCategory(record))) {
    return mutationError(409, "批准品类前必须完成有效 Skill/Tool 品类包绑定。");
  }
  const updated = await repository.updateDijieRoleCategories({
    id: record.id,
    category_status: input.result === "approved" ? "approved" : "draft",
    reviewed_at: new Date(),
    reviewed_by: input.reviewedBy ?? null,
    review_policy: {
      ...record.review_policy,
      lastReviewNote: input.reviewNote ?? null,
      lastReviewResult: input.result,
    },
  });
  return mutationSuccess(updated);
}

export async function disableDijieRoleCategoryWithRepository(
  repository: DijieRoleCategoryLookupRepository & DijieRoleCategoryUpdateRepository,
  input: Parameters<DijieRoleCategoryStore["disableDijieRoleCategory"]>[0],
) {
  const record = await retrieveCategory(repository, input.categoryRef);
  if (!record?.id) {
    return mutationError(404, "未找到平台品类。");
  }
  if (record.category_status === "disabled") {
    return mutationSuccess(record);
  }
  if (record.category_status !== "approved") {
    return mutationError(409, "只有已启用品类可以禁用。");
  }
  const updated = await repository.updateDijieRoleCategories({
    id: record.id,
    category_status: "disabled",
    reviewed_at: new Date(),
    reviewed_by: input.disabledBy ?? null,
    review_policy: {
      ...record.review_policy,
      disabledReason: input.reason ?? null,
    },
  });
  return mutationSuccess(updated);
}
