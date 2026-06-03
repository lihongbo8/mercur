import { MedusaService } from "@medusajs/framework/utils";
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
  DijieAuditRecord,
  DijieEvolutionCandidate,
  DijieMemoryCandidate,
  DijieRoleCapabilityProfile,
  DijieRoleFeedbackPacket,
} from "./models";

class DijieAuditModuleService
  extends MedusaService({
    DijieAuditRecord,
    DijieEvolutionCandidate,
    DijieMemoryCandidate,
    DijieRoleCapabilityProfile,
    DijieRoleFeedbackPacket,
  })
  implements
    DijieAuditRecordStore,
    DijieAuditExecutionRecordReader,
    DijieSchedulerBackboneStore,
    DijieSchedulerBackboneReader
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
}

export default DijieAuditModuleService;
