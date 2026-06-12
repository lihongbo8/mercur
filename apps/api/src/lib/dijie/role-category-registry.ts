import type {
  DijieCapabilityPreferredRoute,
  DijieCapabilityRouteKind,
  DijieCatalogKind,
} from "./role-skill-tool-planner";

export type DijieRoleCategoryStatus = "draft" | "pending_review" | "approved" | "disabled";

export type DijieRoleSpecialCapabilityRequestStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "request_changes";

export type DijieRoleCategoryPackBinding = {
  categoryPackRef: string;
  skillPackRef: string;
  toolPackRef: string;
  riskPolicyRef?: string;
  reviewPolicyRef?: string;
  capabilityRefs: string[];
  catalogRefs: string[];
  permissionSummary: string[];
};

export type DijieRoleCategory = {
  categoryRef: string;
  name: string;
  version: string;
  description: string;
  status: DijieRoleCategoryStatus;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  packBinding?: DijieRoleCategoryPackBinding | null;
};

export type DijieRoleSpecialCapabilityRequest = {
  requestRef: string;
  need: string;
  kind: DijieCatalogKind;
  catalogRef?: string | null;
  status: DijieRoleSpecialCapabilityRequestStatus;
  reason?: string | null;
};

export type DijieRoleCategoryIntegrationCheck = {
  ok: boolean;
  category?: DijieRoleCategory;
  inheritedCatalogRefs: string[];
  inheritedCapabilityRefs: string[];
  specialCapabilityRequests: DijieRoleSpecialCapabilityRequest[];
  missing: string[];
  blocked: string[];
  error?: string;
};

export type DijieRoleCategoryRegistry = {
  categories: DijieRoleCategory[];
};

export type DijieRoleCategoryReader = {
  listDijieRoleCategories: () => Promise<DijieRoleCategory[]>;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function normalizePackBinding(value: unknown): DijieRoleCategoryPackBinding | null {
  const record = asRecord(value);
  const categoryPackRef = stringField(record, "categoryPackRef") ?? stringField(record, "category_pack_ref");
  const skillPackRef = stringField(record, "skillPackRef") ?? stringField(record, "skill_pack_ref");
  const toolPackRef = stringField(record, "toolPackRef") ?? stringField(record, "tool_pack_ref");
  if (!categoryPackRef || !skillPackRef || !toolPackRef) {
    return null;
  }
  return {
    categoryPackRef,
    skillPackRef,
    toolPackRef,
    riskPolicyRef: stringField(record, "riskPolicyRef") ?? stringField(record, "risk_policy_ref"),
    reviewPolicyRef:
      stringField(record, "reviewPolicyRef") ?? stringField(record, "review_policy_ref"),
    capabilityRefs: stringArray(record.capabilityRefs ?? record.capability_refs),
    catalogRefs: stringArray(record.catalogRefs ?? record.catalog_refs),
    permissionSummary: stringArray(record.permissionSummary ?? record.permission_summary),
  };
}

export function normalizeDijieRoleCategoryRecord(value: unknown): DijieRoleCategory | undefined {
  const record = asRecord(value);
  const categoryRef = stringField(record, "category_ref") ?? stringField(record, "categoryRef");
  const name = stringField(record, "name");
  const version = stringField(record, "version");
  const description = stringField(record, "description") ?? "";
  const status = lowerStatus(record.category_status ?? record.status) as
    | DijieRoleCategoryStatus
    | undefined;
  if (!categoryRef || !name || !version || !status) {
    return undefined;
  }
  return {
    categoryRef,
    name,
    version,
    description,
    status,
    reviewedAt: stringField(record, "reviewed_at") ?? stringField(record, "reviewedAt") ?? null,
    reviewedBy: stringField(record, "reviewed_by") ?? stringField(record, "reviewedBy") ?? null,
    packBinding: normalizePackBinding(record.pack_binding ?? record.packBinding),
  };
}

export function createDijieRoleCategoryRegistry(
  categories: unknown[] = [],
): DijieRoleCategoryRegistry {
  return {
    categories: categories
      .map(normalizeDijieRoleCategoryRecord)
      .filter((category): category is DijieRoleCategory => Boolean(category)),
  };
}

function lowerStatus(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
}

function categoryRefFromInput(input: {
  categoryRef?: string | null;
  category?: string | null;
  manifestSummary?: unknown;
}): string | undefined {
  const manifest = asRecord(input.manifestSummary);
  return (
    input.categoryRef?.trim() ||
    stringField(manifest, "categoryRef") ||
    stringField(manifest, "category_ref") ||
    undefined
  );
}

function packBindingFromCategory(category: DijieRoleCategory): DijieRoleCategoryPackBinding | null {
  return category.packBinding ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function routeKindForDijieCategoryCapabilityRef(
  ref: string,
): DijieCapabilityRouteKind {
  if (ref.includes("human.confirm") || ref.startsWith("human:")) {
    return "human_gate";
  }
  if (ref.startsWith("skill") || ref.startsWith("skillpack")) {
    return "local_skill";
  }
  if (ref.startsWith("api:")) {
    return "remote_api";
  }
  if (ref.startsWith("mcp:")) {
    return "remote_mcp";
  }
  if (ref.startsWith("provider:")) {
    return "provider_capability";
  }
  if (ref.startsWith("tool") || ref.startsWith("capability:")) {
    return "local_tool";
  }
  return "unsupported";
}

export function preferredRouteForDijieCategoryCapabilityRef(
  ref: string,
): DijieCapabilityPreferredRoute {
  const routeKind = routeKindForDijieCategoryCapabilityRef(ref);
  if (routeKind === "local_tool" || routeKind === "local_skill") {
    return "local";
  }
  if (routeKind === "provider_capability") {
    return "provider";
  }
  if (routeKind === "human_gate") {
    return "human_gate";
  }
  if (routeKind === "unsupported") {
    return "unsupported";
  }
  return routeKind;
}

export function validateDijieRoleCategoryIntegration(input: {
  categoryRef?: string | null;
  category?: string | null;
  manifestSummary?: unknown;
  registry?: DijieRoleCategoryRegistry;
}): DijieRoleCategoryIntegrationCheck {
  const categoryRef = categoryRefFromInput(input);
  const requests: DijieRoleSpecialCapabilityRequest[] = [];
  const blockedSpecial: string[] = [];

  if (!categoryRef) {
    return {
      ok: false,
      inheritedCatalogRefs: [],
      inheritedCapabilityRefs: [],
      specialCapabilityRequests: requests,
      missing: ["categoryRef"],
      blocked: blockedSpecial,
      error: "岗位必须先选择平台已启用的品类，才能继承 Skill/Tool 品类包。",
    };
  }

  const category = input.registry?.categories.find(
    (item) => item.categoryRef === categoryRef,
  );
  if (!category) {
    return {
      ok: false,
      inheritedCatalogRefs: [],
      inheritedCapabilityRefs: [],
      specialCapabilityRequests: requests,
      missing: [categoryRef],
      blocked: blockedSpecial,
      error: "岗位绑定的品类不存在或尚未由平台创建。",
    };
  }
  if (category.status !== "approved") {
    return {
      ok: false,
      category,
      inheritedCatalogRefs: [],
      inheritedCapabilityRefs: [],
      specialCapabilityRequests: requests,
      missing: [],
      blocked: [`${category.categoryRef}: ${category.status}`, ...blockedSpecial],
      error: "岗位绑定的品类尚未审核启用。",
    };
  }

  const binding = packBindingFromCategory(category);
  if (
    !binding?.categoryPackRef ||
    !binding.skillPackRef ||
    !binding.toolPackRef ||
    binding.catalogRefs.length === 0
  ) {
    return {
      ok: false,
      category,
      inheritedCatalogRefs: [],
      inheritedCapabilityRefs: [],
      specialCapabilityRequests: requests,
      missing: [`${category.categoryRef}: category_pack_binding`],
      blocked: blockedSpecial,
      error: "岗位绑定的品类还没有有效 Skill/Tool 品类包。",
    };
  }
  if (blockedSpecial.length > 0) {
    return {
      ok: false,
      category,
      inheritedCatalogRefs: unique([
        binding.categoryPackRef,
        binding.skillPackRef,
        binding.toolPackRef,
        ...binding.catalogRefs,
      ]),
      inheritedCapabilityRefs: unique(binding.capabilityRefs),
      specialCapabilityRequests: requests,
      missing: [],
      blocked: blockedSpecial,
      error: "岗位包含未审核通过的特殊能力申请。",
    };
  }

  return {
    ok: true,
    category,
    inheritedCatalogRefs: unique([
      binding.categoryPackRef,
      binding.skillPackRef,
      binding.toolPackRef,
      ...binding.catalogRefs,
    ]),
    inheritedCapabilityRefs: unique(binding.capabilityRefs),
    specialCapabilityRequests: requests,
    missing: [],
    blocked: [],
  };
}
