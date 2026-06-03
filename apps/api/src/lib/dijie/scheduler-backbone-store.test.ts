import { describe, expect, it } from "bun:test";
import {
  createDijieEvolutionCandidateStorageRecord,
  createDijieMemoryCandidateStorageRecord,
  createDijieRoleCapabilityProfileReadModel,
  createDijieRoleCapabilityProfileStorageRecord,
  createDijieRoleFeedbackPacketReadModel,
  createDijieRoleFeedbackPacketStorageRecord,
  normalizeDijieRoleFeedbackPacket,
  recordDijieEvolutionCandidateWithRepository,
  recordDijieMemoryCandidateWithRepository,
  recordDijieRoleCapabilityProfileWithRepository,
  recordDijieRoleFeedbackPacketWithRepository,
  retrieveDijieRoleCapabilityProfileWithRepository,
  retrieveDijieRoleFeedbackPacketsByExecutionIdWithRepository,
  type DijieEvolutionCandidate,
  type DijieMemoryCandidate,
  type DijieRoleCapabilityProfile,
  type DijieRoleFeedbackPacket,
  type DijieRoleFeedbackPacketStorageRecord,
} from "./scheduler-backbone-store";

const packet: DijieRoleFeedbackPacket = {
  packetVersion: 1,
  packetId: "packet_123",
  mode: "authorized_execution",
  producedAt: "2026-06-01T08:03:00.000Z",
  role: {
    packageId: "pkg_role_123",
    packageVersion: "1.0.0",
    roleListingId: "role_123",
    developerRef: "dev_001",
  },
  schedulerContext: {
    executionId: "exec_123",
    entitlementId: "ent_123",
    deviceId: "device_123",
    workspaceRef: "workspace_123",
    localGatewayId: "gateway_123",
  },
  status: "completed",
  startedAt: "2026-06-01T08:00:00.000Z",
  endedAt: "2026-06-01T08:02:00.000Z",
  summary: "Role completed the package validation checks.",
  changedFiles: ["role_package/manifest.json"],
  artifacts: [
    {
      id: "artifact_123",
      type: "role_package",
      title: "Role package",
      sizeBytes: 2048,
      sha256: "abc123",
    },
  ],
  toolUsage: {
    shellCommands: 1,
    filesRead: 4,
    testsRun: 1,
    filesChanged: 1,
  },
  modelProxyUsage: {
    requestCount: 1,
    inputTokens: 1000,
    outputTokens: 500,
  },
  costUsage: {
    inputTokens: 1000,
    outputTokens: 500,
    currency: "CNY",
    estimatedCents: 1,
  },
  riskEvents: [
    {
      level: "low",
      category: "validation_warning",
      summary: "No unsafe package fields were accepted.",
      requiresHumanConfirmation: false,
    },
  ],
  evolutionSuggestions: [
    {
      target: "capability_rubric",
      summary: "Track repeated validation fixes in the profile.",
      evidenceRefs: ["packet_123"],
    },
  ],
};

const profile: DijieRoleCapabilityProfile = {
  profileVersion: 1,
  packageId: "pkg_role_123",
  packageVersion: "1.0.0",
  roleListingId: "role_123",
  updatedAt: "2026-06-01T08:04:00.000Z",
  overallScore: 86,
  capabilities: [
    {
      name: "package_validation",
      score: 90,
      evidenceCount: 1,
    },
  ],
  failureModes: [
    {
      code: "missing_manifest",
      summary: "Fails fast when manifest files are absent.",
      occurrences: 1,
    },
  ],
  dispatchHints: ["Use for package validation before admin review."],
  evaluatorAdapters: {
    agentevals: "planned",
    deepeval: "not_configured",
    dspy: "not_configured",
    mem0: "planned",
  },
};

const memoryCandidate: DijieMemoryCandidate = {
  candidateVersion: 1,
  candidateId: "memcand_123",
  source: "scheduler_summary",
  status: "pending",
  createdAt: "2026-06-01T08:04:00.000Z",
  riskLevel: "low",
  text: "The role consistently validates package manifests before upload.",
  evidenceRefs: ["packet_123"],
  packageId: "pkg_role_123",
  executionId: "exec_123",
};

const evolutionCandidate: DijieEvolutionCandidate = {
  candidateVersion: 1,
  candidateId: "evocand_123",
  target: "role_improvement",
  status: "pending",
  createdAt: "2026-06-01T08:04:00.000Z",
  summary: "Add clearer validation output for missing package files.",
  rationale: "Current failures are correct but hard for developers to act on.",
  evidenceRefs: ["packet_123"],
  packageId: "pkg_role_123",
  executionId: "exec_123",
};

describe("Dijie scheduler backbone store", () => {
  it("normalizes and stores a v1 role feedback packet with allowed scheduler context", () => {
    const result = normalizeDijieRoleFeedbackPacket(packet);
    expect(result.ok).toBe(true);

    const storageRecord = createDijieRoleFeedbackPacketStorageRecord(packet);
    expect(storageRecord).toMatchObject({
      packet_id: "packet_123",
      packet_version: 1,
      execution_id: "exec_123",
      entitlement_id: "ent_123",
      package_id: "pkg_role_123",
      package_version: "1.0.0",
      role_listing_id: "role_123",
      status: "completed",
      summary: "Role completed the package validation checks.",
      model_proxy_usage: {
        requestCount: 1,
      },
      cost_usage: {
        estimatedCents: 1,
      },
    });
    expect(storageRecord.produced_at.toISOString()).toBe("2026-06-01T08:03:00.000Z");
  });

  it("rejects secret fields, prompt history, private ids outside context, and local paths", () => {
    const result = normalizeDijieRoleFeedbackPacket({
      ...packet,
      rawToken: "secret",
      prompt: "system prompt",
      summary: "Failed while handling exec_123 for cus_123",
      changedFiles: ["/Users/alice/private/role.ts"],
      error: {
        message: "Bearer cloud-secret provider_auth=raw-value",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join("\n")).toContain("rawToken");
      expect(result.issues.join("\n")).toContain("prompt");
      expect(result.issues.join("\n")).toContain("local absolute paths");
      expect(result.issues.join("\n")).toContain("private actor");
      expect(result.issues.join("\n")).toContain("scheduler context identifiers outside allowed context fields");
      expect(result.issues.join("\n")).toContain("raw tokens");
    }
  });

  it("projects feedback and capability read models without payload or scheduler context", () => {
    const feedbackReadModel = createDijieRoleFeedbackPacketReadModel(
      createDijieRoleFeedbackPacketStorageRecord(packet),
    );
    const capabilityReadModel = createDijieRoleCapabilityProfileReadModel(
      createDijieRoleCapabilityProfileStorageRecord(profile),
    );

    expect(feedbackReadModel).toMatchObject({
      packetId: "packet_123",
      role: {
        packageId: "pkg_role_123",
        roleListingId: "role_123",
      },
      summary: "Role completed the package validation checks.",
    });
    expect(capabilityReadModel).toMatchObject({
      profileVersion: 1,
      packageId: "pkg_role_123",
      overallScore: 86,
      evaluatorAdapters: {
        agentevals: "planned",
        mem0: "planned",
      },
    });

    const readJson = JSON.stringify({ feedbackReadModel, capabilityReadModel });
    expect(readJson).not.toContain("schedulerContext");
    expect(readJson).not.toContain("payload");
    expect(readJson).not.toContain("exec_123");
    expect(readJson).not.toContain("ent_123");
    expect(readJson).not.toContain("device_123");
    expect(readJson).not.toContain("workspace_123");
    expect(readJson).not.toContain("gateway_123");
  });

  it("persists records through repository-backed helpers", async () => {
    const persisted: Record<string, unknown> = {};
    const repository = {
      async createDijieRoleFeedbackPackets(data: DijieRoleFeedbackPacketStorageRecord) {
        persisted.feedback = data;
        return { id: "djfb_123" };
      },
      async createDijieRoleCapabilityProfiles(data: unknown) {
        persisted.profile = data;
        return { id: "djcap_123" };
      },
      async createDijieMemoryCandidates(data: unknown) {
        persisted.memory = data;
        return { id: "djmem_123" };
      },
      async createDijieEvolutionCandidates(data: unknown) {
        persisted.evolution = data;
        return { id: "djevo_123" };
      },
    };

    await expect(recordDijieRoleFeedbackPacketWithRepository(repository, packet)).resolves.toEqual({
      packetRecordId: "djfb_123",
    });
    await expect(recordDijieRoleCapabilityProfileWithRepository(repository, profile)).resolves.toEqual({
      profileRecordId: "djcap_123",
    });
    await expect(recordDijieMemoryCandidateWithRepository(repository, memoryCandidate)).resolves.toEqual({
      candidateRecordId: "djmem_123",
    });
    await expect(
      recordDijieEvolutionCandidateWithRepository(repository, evolutionCandidate),
    ).resolves.toEqual({
      candidateRecordId: "djevo_123",
    });

    expect(persisted.feedback).toMatchObject({ packet_id: "packet_123" });
    expect(persisted.profile).toMatchObject({ profile_key: "role_123:pkg_role_123:1.0.0" });
    expect(persisted.memory).toMatchObject({ candidate_id: "memcand_123", status: "pending" });
    expect(persisted.evolution).toMatchObject({
      candidate_id: "evocand_123",
      target: "role_improvement",
    });
  });

  it("reads feedback packets and latest capability profile through repository helpers", async () => {
    const feedbackStorage = createDijieRoleFeedbackPacketStorageRecord(packet);
    const profileStorage = createDijieRoleCapabilityProfileStorageRecord(profile);
    let feedbackFilters: unknown;
    let profileFilters: unknown;

    const feedbackPackets = await retrieveDijieRoleFeedbackPacketsByExecutionIdWithRepository(
      {
        async listDijieRoleFeedbackPackets(filters, config) {
          feedbackFilters = { filters, config };
          return [feedbackStorage];
        },
      },
      "exec_123",
    );
    const latestProfile = await retrieveDijieRoleCapabilityProfileWithRepository(
      {
        async listDijieRoleCapabilityProfiles(filters, config) {
          profileFilters = { filters, config };
          return [profileStorage];
        },
      },
      {
        packageId: "pkg_role_123",
        packageVersion: "1.0.0",
        roleListingId: "role_123",
      },
    );

    expect(feedbackPackets).toEqual([feedbackStorage]);
    expect(latestProfile).toBe(profileStorage);
    expect(feedbackFilters).toMatchObject({
      filters: { execution_id: "exec_123" },
      config: { take: 20, order: { produced_at: "DESC" } },
    });
    expect(profileFilters).toMatchObject({
      filters: {
        package_id: "pkg_role_123",
        package_version: "1.0.0",
        role_listing_id: "role_123",
      },
      config: { take: 1, order: { updated_at: "DESC" } },
    });
  });

  it("normalizes scheduler-owned candidate storage records", () => {
    expect(createDijieMemoryCandidateStorageRecord(memoryCandidate)).toMatchObject({
      candidate_id: "memcand_123",
      execution_id: "exec_123",
      source: "scheduler_summary",
      risk_level: "low",
    });
    expect(createDijieEvolutionCandidateStorageRecord(evolutionCandidate)).toMatchObject({
      candidate_id: "evocand_123",
      execution_id: "exec_123",
      target: "role_improvement",
      rationale: "Current failures are correct but hard for developers to act on.",
    });
  });
});
