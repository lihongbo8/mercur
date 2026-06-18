import {
  validateDijieRoleCategoryIntegration,
  type DijieRoleCategoryRegistry,
} from "./role-category-registry";

type UnknownRecord = Record<string, unknown>;

export type DijieCapabilityIntegrationCheck = {
  ok: boolean;
  error?: string;
  missing: string[];
  blocked: string[];
  inheritedCatalogRefs?: string[];
  inheritedCapabilityRefs?: string[];
};

export type DijieRoleCapabilityIntegrationLegacyIssue = {
  roleListingId: string;
  title: string | null;
  listingStatus: string;
  reviewState: string;
  missing: string[];
  blocked: string[];
  error: string;
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

export function validateDijieRoleCapabilityIntegration(
  input:
    | unknown
    | {
        manifestSummary: unknown;
        categoryRef?: string | null;
        category?: string | null;
        categoryRegistry?: DijieRoleCategoryRegistry;
      },
): DijieCapabilityIntegrationCheck {
  const record = asRecord(input);
  const manifestSummary =
    "manifestSummary" in record ? record.manifestSummary : input;
  const categoryCheck = validateDijieRoleCategoryIntegration({
    manifestSummary,
    categoryRef:
      typeof record.categoryRef === "string" ? record.categoryRef : undefined,
    category: typeof record.category === "string" ? record.category : undefined,
    registry:
      record.categoryRegistry &&
      typeof record.categoryRegistry === "object" &&
      Array.isArray((record.categoryRegistry as { categories?: unknown }).categories)
        ? (record.categoryRegistry as DijieRoleCategoryRegistry)
        : undefined,
  });
  if (!categoryCheck.ok) {
    return {
      ok: false,
      missing: categoryCheck.missing,
      blocked: categoryCheck.blocked,
      error: categoryCheck.error,
      inheritedCatalogRefs: categoryCheck.inheritedCatalogRefs,
      inheritedCapabilityRefs: categoryCheck.inheritedCapabilityRefs,
    };
  }

  return {
    ok: true,
    missing: [],
    blocked: [],
    inheritedCatalogRefs: categoryCheck.inheritedCatalogRefs,
    inheritedCapabilityRefs: categoryCheck.inheritedCapabilityRefs,
  };
}

function recordStringField(record: UnknownRecord, field: string): string | undefined {
  return stringField(record, field) ?? stringField(record, camelCaseField(field));
}

function camelCaseField(field: string): string {
  return field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function listDijieRoleCapabilityIntegrationLegacyIssues(
  records: unknown[],
): DijieRoleCapabilityIntegrationLegacyIssue[] {
  return records.flatMap((entry) => {
    const record = asRecord(entry);
    const listingStatus = recordStringField(record, "listing_status");
    const reviewState = recordStringField(record, "review_state");
    if (
      reviewState !== "approved" ||
      (listingStatus !== "published" && listingStatus !== "delisted")
    ) {
      return [];
    }

    const check = validateDijieRoleCapabilityIntegration(
      record.manifest_summary ?? record.manifestSummary,
    );
    if (check.ok) {
      return [];
    }

    return [
      {
        roleListingId:
          recordStringField(record, "id") ??
          recordStringField(record, "role_listing_id") ??
          "unknown",
        title: recordStringField(record, "title") ?? null,
        listingStatus,
        reviewState,
        missing: check.missing,
        blocked: check.blocked,
        error:
          check.error ??
          "岗位上架前必须绑定 approved 平台品类和基础品类包。",
      },
    ];
  });
}
