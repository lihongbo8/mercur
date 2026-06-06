import { MedusaService } from "@medusajs/framework/utils";
import {
  listDijieAccountAccessProfilesWithRepository,
  retrieveDijieAccountAccessProfileWithRepository,
  upsertDijieAccountAccessProfileWithRepository,
  type DijieAccountAccessProfileLookupRepository,
  type DijieAccountAccessProfileReader,
  type DijieAccountAccessProfileRepository,
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
  listDijieStoredRoleListingsWithRepository,
  retrieveDijieRoleListingWithRepository,
  submitDijieRoleListingForReviewWithRepository,
  updateDijieRoleListingDraftWithRepository,
  type DijieRoleListingReader,
  type DijieRoleListingRepository,
  type DijieRoleListingLookupRepository,
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
  type DijieRolePackageDraftStore,
  type DijieRolePackageDraftUpdateRepository,
} from "../../lib/dijie/role-package-draft-store";
import {
  DijieAccountAccessProfile,
  DijieAuditRecord,
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

class DijieAuditModuleService
  extends MedusaService({
    DijieAccountAccessProfile,
    DijieAuditRecord,
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
    DijieRolePackageReader,
    DijieRolePackageDraftStore,
    DijieRolePackageDraftReader,
    DijieRoleListingStore,
    DijieRoleListingReader,
    DijieRoleEntitlementStore,
    DijieRoleReviewStore,
    DijieAccountAccessProfileStore,
    DijieAccountAccessProfileReader,
    DijieDialogSessionStore,
    DijieDialogSessionReader,
    DijieLedgerEntryStore,
    DijieLedgerEntryReader
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

  async retrieveDijieRolePackage(
    input: Parameters<DijieRolePackageReader["retrieveDijieRolePackage"]>[0],
  ) {
    return retrieveDijieRolePackageWithRepository(
      this as unknown as DijieRolePackageLookupRepository,
      input,
    );
  }

  async listDijieRolePackages(
    input?: Parameters<DijieRolePackageReader["listDijieRolePackages"]>[0],
  ) {
    return listDijieRolePackagesWithRepository(
      this as unknown as DijieRolePackageLookupRepository,
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
      this as unknown as DijieRolePackageDraftLookupRepository,
      input,
    );
  }

  async retrieveDijieRolePackageDraft(
    input: Parameters<DijieRolePackageDraftReader["retrieveDijieRolePackageDraft"]>[0],
  ) {
    return retrieveDijieRolePackageDraftWithRepository(
      this as unknown as DijieRolePackageDraftLookupRepository,
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

  async retrieveDijieRoleListing(
    input: Parameters<DijieRoleListingReader["retrieveDijieRoleListing"]>[0],
  ) {
    return retrieveDijieRoleListingWithRepository(
      this as unknown as DijieRoleListingLookupRepository,
      input,
    );
  }

  async listDijieStoredRoleListings(
    input?: Parameters<DijieRoleListingReader["listDijieStoredRoleListings"]>[0],
  ) {
    return listDijieStoredRoleListingsWithRepository(
      this as unknown as DijieRoleListingLookupRepository,
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

  async retrieveDijieAccountAccessProfile(
    input: Parameters<DijieAccountAccessProfileReader["retrieveDijieAccountAccessProfile"]>[0],
  ) {
    return retrieveDijieAccountAccessProfileWithRepository(
      this as unknown as DijieAccountAccessProfileLookupRepository,
      input,
    );
  }

  async listDijieAccountAccessProfiles(
    input?: Parameters<DijieAccountAccessProfileReader["listDijieAccountAccessProfiles"]>[0],
  ) {
    return listDijieAccountAccessProfilesWithRepository(
      this as unknown as DijieAccountAccessProfileLookupRepository,
      input,
    );
  }

  async upsertDijieAccountAccessProfile(
    input: Parameters<DijieAccountAccessProfileStore["upsertDijieAccountAccessProfile"]>[0],
  ) {
    return upsertDijieAccountAccessProfileWithRepository(
      this as unknown as DijieAccountAccessProfileRepository &
        DijieAccountAccessProfileLookupRepository &
        DijieAccountAccessProfileUpdateRepository,
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
}

export default DijieAuditModuleService;
