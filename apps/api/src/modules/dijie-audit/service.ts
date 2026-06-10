import { MedusaService } from "@medusajs/framework/utils";
import {
  listDijieAccountAccessProfilesWithRepository,
  retrieveDijieAccountAccessProfileWithRepository,
  upsertDijieAccountAccessProfileWithRepository,
  type DijieAccountAccessProfileLookupRepository,
  type DijieAccountAccessProfileReader,
  type DijieAccountAccessProfileRepository,
  type DijieAccountAccessProfileStorageRecord,
  type DijieAccountAccessProfileStore,
  type DijieAccountAccessProfileUpdateRepository,
} from "../../lib/dijie/account-access-store";
import {
  recordDijieAuditSummaryWithRepository,
  retrieveDijieAuditRecordByExecutionIdWithRepository,
  type DijieAuditRecordRepository,
  type DijieAuditRecordLookupRepository,
  type DijieAuditRecordStore,
  type DijieAuditExecutionRecordReader,
} from "../../lib/dijie/audit-store";
import type { DijieAuditRecord as DijieAuditRecordPayload } from "../../lib/dijie/audit-summary";
import {
  listDijieDialogSessionsForAccountWithRepository,
  recordDijieDialogTurnWithRepository,
  retrieveDijieDialogSessionWithMessagesWithRepository,
  type DijieDialogMessageLookupRepository,
  type DijieDialogMessageRepository,
  type DijieDialogSessionLookupRepository,
  type DijieDialogSessionReader,
  type DijieDialogSessionRepository,
  type DijieDialogSessionStore,
  type DijieDialogSessionUpdateRepository,
} from "../../lib/dijie/dialog-session-store";
import {
  createDijieLedgerEntryWithRepository,
  listDijieLedgerEntriesForAccountWithRepository,
  type DijieLedgerEntryLookupRepository,
  type DijieLedgerEntryReader,
  type DijieLedgerEntryRepository,
  type DijieLedgerEntryStore,
} from "../../lib/dijie/ledger-store";
import {
  createDijieCatalogReviewRequestsForPlanWithRepository,
  finalizeDijieCatalogReviewRequestWithRepository,
  listDijieCatalogReviewRequestsWithRepository,
  listDijieEffectiveCatalogItemsWithRepository,
  type DijieCatalogLookupRepository,
  type DijieCatalogMutationRepository,
  type DijieCatalogReader,
  type DijieCatalogReviewRequestStorageRecord,
  type DijieCatalogReviewStore,
} from "../../lib/dijie/catalog-store";
import {
  recordDijieEvolutionCandidateWithRepository,
  recordDijieMemoryCandidateWithRepository,
  recordDijieRoleCapabilityProfileWithRepository,
  recordDijieRoleFeedbackPacketWithRepository,
  retrieveDijieRoleCapabilityProfileWithRepository,
  retrieveDijieRoleFeedbackPacketsByExecutionIdWithRepository,
  type DijieEvolutionCandidate as DijieEvolutionCandidatePayload,
  type DijieMemoryCandidate as DijieMemoryCandidatePayload,
  type DijieRoleCapabilityProfile as DijieRoleCapabilityProfilePayload,
  type DijieRoleFeedbackPacket as DijieRoleFeedbackPacketPayload,
  type DijieSchedulerBackboneLookupRepository,
  type DijieSchedulerBackboneReader,
  type DijieSchedulerBackboneRepository,
  type DijieSchedulerBackboneStore,
} from "../../lib/dijie/scheduler-backbone-store";
import {
  createDijieRoleListingWithRepository,
  delistDijieRoleListingWithRepository,
  listDijieStoredRoleListingsWithRepository,
  publishDijieRoleListingWithRepository,
  retrieveDijieRoleListingWithRepository,
  submitDijieRoleListingForReviewWithRepository,
  updateDijieRoleListingDraftWithRepository,
  type DijieRoleListingReader,
  type DijieRoleListingRepository,
  type DijieRoleListingLookupRepository,
  type DijieRoleListingStorageRecord,
  type DijieRoleListingStore,
  type DijieRoleListingUpdateRepository,
} from "../../lib/dijie/role-listing-store";
import {
  authorizeDijiePaidRoleListingWithRepository,
  authorizeDijieRoleListingWithRepository,
  type DijieRoleEntitlementLookupRepository,
  type DijieRoleEntitlementRepository,
  type DijieRoleEntitlementStore,
} from "../../lib/dijie/role-entitlement-store";
import {
  finalizeDijieRoleReviewWithRepository,
  saveDijieRoleReviewEvaluationsWithRepository,
  type DijieRoleReviewLookupRepository,
  type DijieRoleReviewRepository,
  type DijieRoleReviewStore,
  type DijieRoleReviewUpdateRepository,
} from "../../lib/dijie/role-review-store";
import {
  listDijieRolePackagesWithRepository,
  retrieveDijieRolePackageWithRepository,
  storeDijieRolePackageWithRepository,
  type DijieRolePackageReader,
  type DijieRolePackageRepository,
  type DijieRolePackageLookupRepository,
  type DijieRolePackageStorageRecord,
  type DijieRolePackageStore,
} from "../../lib/dijie/role-package-store";
import {
  createDijieRolePackageDraftWithRepository,
  markDijieRolePackageDraftSubmittedWithRepository,
  retrieveDijieRolePackageDraftWithRepository,
  retrieveLatestDijieRolePackageDraftWithRepository,
  updateDijieRolePackageDraftWithRepository,
  type DijieRolePackageDraftLookupRepository,
  type DijieRolePackageDraftReader,
  type DijieRolePackageDraftRepository,
  type DijieRolePackageDraftStorageRecord,
  type DijieRolePackageDraftStore,
  type DijieRolePackageDraftUpdateRepository,
} from "../../lib/dijie/role-package-draft-store";
import {
  DijieAccountAccessProfile,
  DijieAuditRecord,
  DijieCatalogItem,
  DijieCatalogReviewRequest,
  DijieDialogMessage,
  DijieDialogSession,
  DijieEvolutionCandidate,
  DijieLedgerEntry,
  DijieMemoryCandidate,
  DijieRoleCapabilityProfile,
  DijieRoleEntitlement,
  DijieRoleFeedbackPacket,
  DijieRoleListing,
  DijieRolePackage,
  DijieRolePackageDraft,
  DijieRoleReview,
} from "./models";

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

function nullableStringField(record: UnknownRecord, field: string): string | null {
  return stringField(record, field) ?? null;
}

function booleanField(record: UnknownRecord, field: string): boolean {
  return record[field] === true;
}

function numberField(record: UnknownRecord, field: string): number {
  return typeof record[field] === "number" && Number.isFinite(record[field])
    ? Number(record[field])
    : 0;
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

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringArray(value: unknown): string[] {
  return jsonArray<unknown>(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function accountDataScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return stringArray(value);
  }
  const record = asRecord(value);
  return stringArray(record.scopes);
}

function normalizeDijieRolePackageRecord(
  value: unknown,
): DijieRolePackageStorageRecord & { id?: string } {
  const record = asRecord(value);
  return {
    ...(stringField(record, "id") ? { id: stringField(record, "id") } : {}),
    package_id: stringField(record, "package_id") ?? "",
    package_version: stringField(record, "package_version") ?? "",
    owner_id: nullableStringField(record, "owner_id"),
    uploaded_at: dateField(record.uploaded_at),
    manifest_summary:
      record.manifest_summary as DijieRolePackageStorageRecord["manifest_summary"],
    file_manifest: jsonArray<DijieRolePackageStorageRecord["file_manifest"][number]>(
      record.file_manifest,
    ),
    package_files: jsonArray<DijieRolePackageStorageRecord["package_files"][number]>(
      record.package_files,
    ),
    validation_issues:
      record.validation_issues === null ? null : stringArray(record.validation_issues),
  };
}

function normalizeDijieRolePackageDraftRecord(
  value: unknown,
): DijieRolePackageDraftStorageRecord & { id?: string } {
  const record = asRecord(value);
  return {
    ...(stringField(record, "id") ? { id: stringField(record, "id") } : {}),
    owner_id: stringField(record, "owner_id") ?? "",
    draft_status:
      record.draft_status as DijieRolePackageDraftStorageRecord["draft_status"],
    source_message: stringField(record, "source_message") ?? "",
    package_id: nullableStringField(record, "package_id"),
    package_version: nullableStringField(record, "package_version"),
    generated_at: dateField(record.generated_at),
    manifest_summary:
      record.manifest_summary === null
        ? null
        : (record.manifest_summary as DijieRolePackageDraftStorageRecord["manifest_summary"]),
    file_manifest: jsonArray<DijieRolePackageDraftStorageRecord["file_manifest"][number]>(
      record.file_manifest,
    ),
    package_files: jsonArray<DijieRolePackageDraftStorageRecord["package_files"][number]>(
      record.package_files,
    ),
    capability_report:
      record.capability_report as DijieRolePackageDraftStorageRecord["capability_report"],
    quality_report:
      record.quality_report as DijieRolePackageDraftStorageRecord["quality_report"],
    upload_validation_issues: stringArray(record.upload_validation_issues),
    blocking_issues: stringArray(record.blocking_issues),
    model_usage:
      record.model_usage === null
        ? null
        : (record.model_usage as DijieRolePackageDraftStorageRecord["model_usage"]),
    submitted_package_id: nullableStringField(record, "submitted_package_id"),
  };
}

function normalizeDijieRoleListingRecord(
  value: unknown,
): DijieRoleListingStorageRecord & { id: string } {
  const record = asRecord(value);
  return {
    id: stringField(record, "id") ?? "",
    package_id: stringField(record, "package_id") ?? "",
    package_version: stringField(record, "package_version") ?? "",
    owner_id: nullableStringField(record, "owner_id"),
    developer_ref: stringField(record, "developer_ref") ?? "",
    listing_owner_ref: stringField(record, "listing_owner_ref") ?? "",
    billing_beneficiary_ref: stringField(record, "billing_beneficiary_ref") ?? "",
    title: stringField(record, "title") ?? "",
    subtitle: nullableStringField(record, "subtitle"),
    description: nullableStringField(record, "description"),
    usage_instructions: nullableStringField(record, "usage_instructions"),
    category: nullableStringField(record, "category"),
    listing_status:
      record.listing_status as DijieRoleListingStorageRecord["listing_status"],
    review_state: record.review_state as DijieRoleListingStorageRecord["review_state"],
    capabilities: stringArray(record.capabilities),
    manifest_summary:
      record.manifest_summary as DijieRoleListingStorageRecord["manifest_summary"],
    pricing: record.pricing as DijieRoleListingStorageRecord["pricing"],
    role_token_pricing:
      record.role_token_pricing as DijieRoleListingStorageRecord["role_token_pricing"],
    scopes: stringArray(record.scopes),
    confirmation_points: numberField(record, "confirmation_points"),
    submitted_at: nullableDateField(record.submitted_at),
    published_at: nullableDateField(record.published_at),
  };
}

function normalizeDijieAccountAccessProfileRecord(
  value: unknown,
): DijieAccountAccessProfileStorageRecord & { id: string } {
  const record = asRecord(value);
  return {
    id: stringField(record, "id") ?? "",
    account_id: stringField(record, "account_id") ?? "",
    account_level:
      record.account_level as DijieAccountAccessProfileStorageRecord["account_level"],
    local_system_access: booleanField(record, "local_system_access"),
    data_scopes: accountDataScopes(record.data_scopes),
    configured_by: nullableStringField(record, "configured_by"),
    configured_at: dateField(record.configured_at),
  };
}

function normalizeDijieCatalogReviewRequestRecord(
  value: unknown,
): DijieCatalogReviewRequestStorageRecord & { id?: string } {
  const record = asRecord(value);
  return {
    ...(stringField(record, "id") ? { id: stringField(record, "id") } : {}),
    review_key: stringField(record, "review_key") ?? "",
    catalog_ref: nullableStringField(record, "catalog_ref"),
    need: stringField(record, "need") ?? "",
    kind: record.kind as DijieCatalogReviewRequestStorageRecord["kind"],
    source: record.source as DijieCatalogReviewRequestStorageRecord["source"],
    review_status:
      record.review_status as DijieCatalogReviewRequestStorageRecord["review_status"],
    role_package_id: nullableStringField(record, "role_package_id"),
    role_listing_id: nullableStringField(record, "role_listing_id"),
    requested_by: nullableStringField(record, "requested_by"),
    submitted_at: dateField(record.submitted_at),
    reviewed_at: nullableDateField(record.reviewed_at),
    reviewed_by: nullableStringField(record, "reviewed_by"),
    review_note: nullableStringField(record, "review_note"),
    candidate: asRecord(record.candidate),
    risk_summary: asRecord(record.risk_summary),
    payload: asRecord(record.payload),
  };
}

class DijieAuditModuleService
  extends MedusaService({
    DijieAccountAccessProfile,
    DijieAuditRecord,
    DijieCatalogItem,
    DijieCatalogReviewRequest,
    DijieDialogMessage,
    DijieDialogSession,
    DijieEvolutionCandidate,
    DijieLedgerEntry,
    DijieMemoryCandidate,
    DijieRoleCapabilityProfile,
    DijieRoleEntitlement,
    DijieRoleFeedbackPacket,
    DijieRoleListing,
    DijieRolePackage,
    DijieRolePackageDraft,
    DijieRoleReview,
  })
  implements
    DijieAuditRecordStore,
    DijieAuditExecutionRecordReader,
    DijieSchedulerBackboneStore,
    DijieSchedulerBackboneReader,
    DijieRolePackageStore,
    DijieRolePackageDraftStore,
    DijieRoleListingStore,
    DijieRoleEntitlementStore,
    DijieRoleReviewStore,
    DijieDialogSessionStore,
    DijieDialogSessionReader,
    DijieLedgerEntryStore,
    DijieLedgerEntryReader,
    DijieCatalogReviewStore
{
  async recordDijieAuditSummary(record: DijieAuditRecordPayload) {
    return recordDijieAuditSummaryWithRepository(
      this as unknown as DijieAuditRecordRepository,
      record,
    );
  }

  async retrieveDijieAuditRecordByExecutionId(executionId: string) {
    return retrieveDijieAuditRecordByExecutionIdWithRepository(
      this as unknown as DijieAuditRecordLookupRepository,
      executionId,
    );
  }

  async recordDijieRoleFeedbackPacket(packet: DijieRoleFeedbackPacketPayload) {
    return recordDijieRoleFeedbackPacketWithRepository(
      this as unknown as DijieSchedulerBackboneRepository,
      packet,
    );
  }

  async recordDijieRoleCapabilityProfile(profile: DijieRoleCapabilityProfilePayload) {
    return recordDijieRoleCapabilityProfileWithRepository(
      this as unknown as DijieSchedulerBackboneRepository,
      profile,
    );
  }

  async recordDijieMemoryCandidate(candidate: DijieMemoryCandidatePayload) {
    return recordDijieMemoryCandidateWithRepository(
      this as unknown as DijieSchedulerBackboneRepository,
      candidate,
    );
  }

  async recordDijieEvolutionCandidate(candidate: DijieEvolutionCandidatePayload) {
    return recordDijieEvolutionCandidateWithRepository(
      this as unknown as DijieSchedulerBackboneRepository,
      candidate,
    );
  }

  async retrieveDijieRoleFeedbackPacketsByExecutionId(executionId: string) {
    return retrieveDijieRoleFeedbackPacketsByExecutionIdWithRepository(
      this as unknown as DijieSchedulerBackboneLookupRepository,
      executionId,
    );
  }

  async retrieveDijieRoleCapabilityProfileForRole(input: {
    packageId: string;
    packageVersion?: string;
    roleListingId?: string | null;
  }) {
    return retrieveDijieRoleCapabilityProfileWithRepository(
      this as unknown as DijieSchedulerBackboneLookupRepository,
      input,
    );
  }

  async storeDijieRolePackage(
    input: Parameters<DijieRolePackageStore["storeDijieRolePackage"]>[0],
  ) {
    return storeDijieRolePackageWithRepository(
      this as unknown as DijieRolePackageRepository,
      input,
    );
  }

  private dijieRolePackageLookupRepository(): DijieRolePackageLookupRepository {
    const listDijieRolePackages = super.listDijieRolePackages.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    return {
      listDijieRolePackages: async (filters, config) =>
        (await listDijieRolePackages(filters, config)).map(normalizeDijieRolePackageRecord),
    };
  }

  async retrieveDijieRolePackageRecord(
    input: Parameters<DijieRolePackageReader["retrieveDijieRolePackage"]>[0],
  ) {
    return retrieveDijieRolePackageWithRepository(
      this.dijieRolePackageLookupRepository(),
      input,
    );
  }

  async listDijieRolePackageRecords(
    input?: Parameters<DijieRolePackageReader["listDijieRolePackages"]>[0],
  ) {
    return listDijieRolePackagesWithRepository(
      this.dijieRolePackageLookupRepository(),
      input,
    );
  }

  async createDijieRolePackageDraft(
    input: Parameters<DijieRolePackageDraftStore["createDijieRolePackageDraft"]>[0],
  ) {
    return createDijieRolePackageDraftWithRepository(
      this as unknown as DijieRolePackageDraftRepository,
      input,
    );
  }

  async updateDijieRolePackageDraft(
    input: Parameters<DijieRolePackageDraftStore["updateDijieRolePackageDraft"]>[0],
  ) {
    return updateDijieRolePackageDraftWithRepository(
      this as unknown as DijieRolePackageDraftLookupRepository & DijieRolePackageDraftUpdateRepository,
      input,
    );
  }

  async retrieveLatestDijieRolePackageDraft(
    input: Parameters<DijieRolePackageDraftReader["retrieveLatestDijieRolePackageDraft"]>[0],
  ) {
    return retrieveLatestDijieRolePackageDraftWithRepository(
      this.dijieRolePackageDraftLookupRepository(),
      input,
    );
  }

  private dijieRolePackageDraftLookupRepository(): DijieRolePackageDraftLookupRepository {
    const listDijieRolePackageDrafts = super.listDijieRolePackageDrafts.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    return {
      listDijieRolePackageDrafts: async (filters, config) =>
        (await listDijieRolePackageDrafts(filters, config)).map(
          normalizeDijieRolePackageDraftRecord,
        ),
    };
  }

  async retrieveDijieRolePackageDraftRecord(
    input: Parameters<DijieRolePackageDraftReader["retrieveDijieRolePackageDraft"]>[0],
  ) {
    return retrieveDijieRolePackageDraftWithRepository(
      this.dijieRolePackageDraftLookupRepository(),
      input,
    );
  }

  async markDijieRolePackageDraftSubmitted(
    input: Parameters<DijieRolePackageDraftStore["markDijieRolePackageDraftSubmitted"]>[0],
  ) {
    return markDijieRolePackageDraftSubmittedWithRepository(
      this as unknown as DijieRolePackageDraftLookupRepository & DijieRolePackageDraftUpdateRepository,
      input,
    );
  }

  async createDijieRoleListing(
    input: Parameters<DijieRoleListingStore["createDijieRoleListing"]>[0],
  ) {
    return createDijieRoleListingWithRepository(
      this as unknown as DijieRoleListingRepository,
      input,
    );
  }

  async updateDijieRoleListingDraft(
    input: Parameters<DijieRoleListingStore["updateDijieRoleListingDraft"]>[0],
  ) {
    return updateDijieRoleListingDraftWithRepository(
      this as unknown as DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
      input,
    );
  }

  async submitDijieRoleListingForReview(
    input: Parameters<DijieRoleListingStore["submitDijieRoleListingForReview"]>[0],
  ) {
    return submitDijieRoleListingForReviewWithRepository(
      this as unknown as DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
      input,
    );
  }

  async publishDijieRoleListing(
    input: Parameters<DijieRoleListingStore["publishDijieRoleListing"]>[0],
  ) {
    return publishDijieRoleListingWithRepository(
      this as unknown as DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
      input,
    );
  }

  async delistDijieRoleListing(
    input: Parameters<DijieRoleListingStore["delistDijieRoleListing"]>[0],
  ) {
    return delistDijieRoleListingWithRepository(
      this as unknown as DijieRoleListingLookupRepository & DijieRoleListingUpdateRepository,
      input,
    );
  }

  private dijieRoleListingLookupRepository(): DijieRoleListingLookupRepository {
    const listDijieRoleListings = super.listDijieRoleListings.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    return {
      listDijieRoleListings: async (filters, config) =>
        (await listDijieRoleListings(filters, config)).map(normalizeDijieRoleListingRecord),
    };
  }

  async retrieveDijieRoleListingRecord(
    input: Parameters<DijieRoleListingReader["retrieveDijieRoleListing"]>[0],
  ) {
    return retrieveDijieRoleListingWithRepository(
      this.dijieRoleListingLookupRepository(),
      input,
    );
  }

  async listDijieStoredRoleListings(
    input?: Parameters<DijieRoleListingReader["listDijieStoredRoleListings"]>[0],
  ) {
    return listDijieStoredRoleListingsWithRepository(
      this.dijieRoleListingLookupRepository(),
      input,
    );
  }

  async authorizeDijieRoleListing(
    input: Parameters<DijieRoleEntitlementStore["authorizeDijieRoleListing"]>[0],
  ) {
    return authorizeDijieRoleListingWithRepository(
      this as unknown as DijieRoleEntitlementRepository &
        DijieRoleEntitlementLookupRepository &
        DijieRoleListingLookupRepository,
      input,
    );
  }

  async authorizeDijiePaidRoleListing(
    input: Parameters<DijieRoleEntitlementStore["authorizeDijiePaidRoleListing"]>[0],
  ) {
    return authorizeDijiePaidRoleListingWithRepository(
      this as unknown as DijieRoleEntitlementRepository &
        DijieRoleEntitlementLookupRepository &
        DijieRoleListingLookupRepository,
      input,
    );
  }

  async saveDijieRoleReviewEvaluations(
    input: Parameters<DijieRoleReviewStore["saveDijieRoleReviewEvaluations"]>[0],
  ) {
    return saveDijieRoleReviewEvaluationsWithRepository(
      this as unknown as DijieRoleReviewRepository &
        DijieRoleReviewLookupRepository &
        DijieRoleReviewUpdateRepository &
        DijieRoleListingLookupRepository &
        DijieRoleListingUpdateRepository,
      input,
    );
  }

  async finalizeDijieRoleReview(
    input: Parameters<DijieRoleReviewStore["finalizeDijieRoleReview"]>[0],
  ) {
    return finalizeDijieRoleReviewWithRepository(
      this as unknown as DijieRoleReviewRepository &
        DijieRoleReviewLookupRepository &
        DijieRoleReviewUpdateRepository &
        DijieRoleListingLookupRepository &
        DijieRoleListingUpdateRepository,
      input,
    );
  }

  private dijieAccountAccessProfileLookupRepository(): DijieAccountAccessProfileLookupRepository {
    const listDijieAccountAccessProfiles = super.listDijieAccountAccessProfiles.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    return {
      listDijieAccountAccessProfiles: async (filters, config) =>
        (await listDijieAccountAccessProfiles(filters, config)).map(
          normalizeDijieAccountAccessProfileRecord,
        ),
    };
  }

  private dijieAccountAccessProfileRepository():
    DijieAccountAccessProfileRepository &
    DijieAccountAccessProfileLookupRepository &
    DijieAccountAccessProfileUpdateRepository {
    const createDijieAccountAccessProfiles = super.createDijieAccountAccessProfiles.bind(
      this,
    ) as (data: unknown) => Promise<unknown>;
    const updateDijieAccountAccessProfiles = super.updateDijieAccountAccessProfiles.bind(
      this,
    ) as (data: unknown) => Promise<unknown>;
    return {
      ...this.dijieAccountAccessProfileLookupRepository(),
      createDijieAccountAccessProfiles: async (data) =>
        normalizeDijieAccountAccessProfileRecord(
          await createDijieAccountAccessProfiles(data),
        ),
      updateDijieAccountAccessProfiles: async (data) =>
        normalizeDijieAccountAccessProfileRecord(
          await updateDijieAccountAccessProfiles(data),
        ),
    };
  }

  async retrieveDijieAccountAccessProfileRecord(
    input: Parameters<DijieAccountAccessProfileReader["retrieveDijieAccountAccessProfile"]>[0],
  ) {
    return retrieveDijieAccountAccessProfileWithRepository(
      this.dijieAccountAccessProfileLookupRepository(),
      input,
    );
  }

  async listDijieAccountAccessProfileRecords(
    input?: Parameters<DijieAccountAccessProfileReader["listDijieAccountAccessProfiles"]>[0],
  ) {
    return listDijieAccountAccessProfilesWithRepository(
      this.dijieAccountAccessProfileLookupRepository(),
      input,
    );
  }

  async upsertDijieAccountAccessProfile(
    input: Parameters<DijieAccountAccessProfileStore["upsertDijieAccountAccessProfile"]>[0],
  ) {
    return upsertDijieAccountAccessProfileWithRepository(
      this.dijieAccountAccessProfileRepository(),
      input,
    );
  }

  async recordDijieDialogTurn(
    input: Parameters<DijieDialogSessionStore["recordDijieDialogTurn"]>[0],
  ) {
    return recordDijieDialogTurnWithRepository(
      this as unknown as DijieDialogSessionRepository &
        DijieDialogSessionLookupRepository &
        DijieDialogSessionUpdateRepository &
        DijieDialogMessageRepository &
        DijieDialogMessageLookupRepository &
        DijieLedgerEntryRepository,
      input,
    );
  }

  async listDijieDialogSessionsForAccount(
    input: Parameters<DijieDialogSessionReader["listDijieDialogSessionsForAccount"]>[0],
  ) {
    return listDijieDialogSessionsForAccountWithRepository(
      this as unknown as DijieDialogSessionLookupRepository,
      input,
    );
  }

  async retrieveDijieDialogSessionWithMessages(
    input: Parameters<DijieDialogSessionReader["retrieveDijieDialogSessionWithMessages"]>[0],
  ) {
    return retrieveDijieDialogSessionWithMessagesWithRepository(
      this as unknown as DijieDialogSessionLookupRepository & DijieDialogMessageLookupRepository,
      input,
    );
  }

  async createDijieLedgerEntry(
    input: Parameters<DijieLedgerEntryStore["createDijieLedgerEntry"]>[0],
  ) {
    return createDijieLedgerEntryWithRepository(
      this as unknown as DijieLedgerEntryRepository,
      input,
    );
  }

  async listDijieLedgerEntriesForAccount(
    input: Parameters<DijieLedgerEntryReader["listDijieLedgerEntriesForAccount"]>[0],
  ) {
    return listDijieLedgerEntriesForAccountWithRepository(
      this as unknown as DijieLedgerEntryLookupRepository,
      input,
    );
  }

  async listDijieEffectiveCatalogItems() {
    return listDijieEffectiveCatalogItemsWithRepository(
      this as unknown as DijieCatalogLookupRepository,
    );
  }

  private dijieCatalogLookupRepository(): DijieCatalogLookupRepository {
    const listDijieCatalogItems = super.listDijieCatalogItems.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    const listDijieCatalogReviewRequests = super.listDijieCatalogReviewRequests.bind(this) as (
      filters?: unknown,
      config?: unknown,
    ) => Promise<unknown[]>;
    return {
      listDijieCatalogItems: async (filters, config) =>
        (await listDijieCatalogItems(filters, config)) as Awaited<
          ReturnType<DijieCatalogLookupRepository["listDijieCatalogItems"]>
        >,
      listDijieCatalogReviewRequests: async (filters, config) =>
        (await listDijieCatalogReviewRequests(filters, config)).map(
          normalizeDijieCatalogReviewRequestRecord,
        ),
    };
  }

  async listDijieCatalogReviewRequestRecords(
    input?: Parameters<DijieCatalogReader["listDijieCatalogReviewRequests"]>[0],
  ) {
    return listDijieCatalogReviewRequestsWithRepository(
      this.dijieCatalogLookupRepository(),
      input,
    );
  }

  async createDijieCatalogReviewRequestsForPlan(
    input: Parameters<DijieCatalogReviewStore["createDijieCatalogReviewRequestsForPlan"]>[0],
  ) {
    return createDijieCatalogReviewRequestsForPlanWithRepository(
      this as unknown as DijieCatalogLookupRepository & DijieCatalogMutationRepository,
      input,
    );
  }

  async finalizeDijieCatalogReviewRequest(
    input: Parameters<DijieCatalogReviewStore["finalizeDijieCatalogReviewRequest"]>[0],
  ) {
    return finalizeDijieCatalogReviewRequestWithRepository(
      this as unknown as DijieCatalogLookupRepository & DijieCatalogMutationRepository,
      input,
    );
  }
}

export default DijieAuditModuleService;
