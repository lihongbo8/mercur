import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import {
  createDijieAuditExecutionReadModel,
  DIJIE_AUDIT_MODULE,
  type DijieAuditExecutionReadModel,
  type DijieAuditExecutionRecordReader,
  type DijieAuditStorageRecord,
} from "../../../../lib/dijie/audit-store";
import {
  canAccessDijieExecutionData,
} from "../../../../lib/dijie/data-permissions";
import {
  createDijieRoleCapabilityProfileReadModel,
  createDijieRoleFeedbackPacketReadModel,
  type DijieRoleCapabilityProfileReadModel,
  type DijieRoleCapabilityProfileStorageRecord,
  type DijieRoleFeedbackPacketReadModel,
  type DijieRoleFeedbackPacketStorageRecord,
  type DijieSchedulerBackboneReader,
} from "../../../../lib/dijie/scheduler-backbone-store";

type UnknownRecord = Record<string, unknown>;

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters: Record<string, unknown>;
    pagination: { take: number };
  }) => Promise<{ data?: unknown[] }>;
};

type SchedulerReadback = {
  feedbackPackets?: DijieRoleFeedbackPacketReadModel[];
  capabilityProfile?: DijieRoleCapabilityProfileReadModel;
};

type DijieAuditReadbackRecord = DijieAuditStorageRecord & {
  id?: string;
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

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function isAccountAccessProfileReader(
  value: unknown,
): value is DijieAccountAccessProfileReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieAccountAccessProfile?: unknown })
      .retrieveDijieAccountAccessProfile === "function"
  );
}

function resolveAccountAccessProfileReader(
  req: MedusaRequest,
): DijieAccountAccessProfileReader | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isAccountAccessProfileReader(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted-secret]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-secret]")
    .replace(
      /\b(api[_-]?key|secret|provider[_ -]?auth|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,;]+/gi,
      "$1=[redacted-secret]",
    )
    .replace(/\bfile:\/\/[^\s)]+/g, "[redacted-local-path]")
    .replace(/\b[A-Za-z]:[\\/][^\s)]+/g, "[redacted-local-path]")
    .replace(/(^|[\s(["'])(\/(?:Users|home|private|var|tmp|Volumes)\/[^\s)"']+)/g, "$1[redacted-local-path]")
    .replace(
      /\b(?:exec|ent|device|workspace|gateway|cus|actor|user|ord|ordgrp|wallet|settlement|payment|acct)_[A-Za-z0-9][A-Za-z0-9_-]*\b/gi,
      "[redacted-private-id]",
    );
}

function sanitizeReadModelForGateway(
  readModel: DijieAuditExecutionReadModel,
): DijieAuditExecutionReadModel {
  return {
    ...readModel,
    changedFiles: readModel.changedFiles.map(redactSensitiveText),
    artifacts: readModel.artifacts.map((artifact) => ({
      ...artifact,
      id: redactSensitiveText(artifact.id),
      type: redactSensitiveText(artifact.type),
      title: redactSensitiveText(artifact.title),
    })),
    errorSummary:
      readModel.errorSummary === null ? null : redactSensitiveText(readModel.errorSummary),
  };
}

function isAuditRecordReader(value: unknown): value is DijieAuditExecutionRecordReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieAuditRecordByExecutionId?: unknown })
      .retrieveDijieAuditRecordByExecutionId === "function"
  );
}

function isSchedulerBackboneReader(value: unknown): value is DijieSchedulerBackboneReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieRoleFeedbackPacketsByExecutionId?: unknown })
      .retrieveDijieRoleFeedbackPacketsByExecutionId === "function" &&
    typeof (value as { retrieveDijieRoleCapabilityProfileForRole?: unknown })
      .retrieveDijieRoleCapabilityProfileForRole === "function"
  );
}

function resolveAuditRecordReader(
  req: MedusaRequest,
): DijieAuditExecutionRecordReader | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    if (isAuditRecordReader(store)) {
      return store;
    }
  } catch {
    // Query graph fallback below keeps the read endpoint usable in tests and admin surfaces.
  }

  try {
    const legacyStore = req.scope.resolve("dijieAuditSink") as unknown;
    if (isAuditRecordReader(legacyStore)) {
      return legacyStore;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveSchedulerBackboneReader(
  req: MedusaRequest,
): DijieSchedulerBackboneReader | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    if (isSchedulerBackboneReader(store)) {
      return store;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveQueryGraph(req: MedusaRequest): QueryGraph | undefined {
  try {
    const query = req.scope.resolve("query") as unknown;
    if (
      query &&
      typeof query === "object" &&
      typeof (query as { graph?: unknown }).graph === "function"
    ) {
      return query as QueryGraph;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function storageRecordFromGraphResult(value: unknown): DijieAuditReadbackRecord | undefined {
  const record = asRecord(value);
  const id = stringField(record, "id");
  const executionId = stringField(record, "execution_id");
  const actorId = stringField(record, "actor_id");
  const roleListingId = stringField(record, "role_listing_id");
  const packageId = stringField(record, "package_id");
  const packageVersion = stringField(record, "package_version");
  const developerRef = stringField(record, "developer_ref");
  const listingOwnerRef = stringField(record, "listing_owner_ref");
  const billingBeneficiaryRef = stringField(record, "billing_beneficiary_ref");
  const entitlementId = stringField(record, "entitlement_id");
  const deviceId = stringField(record, "device_id");
  const workspaceRef = stringField(record, "workspace_ref");
  const localGatewayId = stringField(record, "local_gateway_id");
  const status = stringField(record, "status");
  const receivedAt = record.received_at;

  if (
    !executionId ||
    !actorId ||
    !roleListingId ||
    !packageId ||
    !packageVersion ||
    !developerRef ||
    !listingOwnerRef ||
    !billingBeneficiaryRef ||
    !entitlementId ||
    !deviceId ||
    !workspaceRef ||
    !localGatewayId ||
    !status ||
    !(receivedAt instanceof Date || typeof receivedAt === "string")
  ) {
    return undefined;
  }

  return {
    ...(id ? { id } : {}),
    execution_id: executionId,
    actor_id: actorId,
    role_listing_id: roleListingId,
    package_id: packageId,
    package_version: packageVersion,
    developer_ref: developerRef,
    listing_owner_ref: listingOwnerRef,
    billing_beneficiary_ref: billingBeneficiaryRef,
    entitlement_id: entitlementId,
    device_id: deviceId,
    workspace_ref: workspaceRef,
    local_gateway_id: localGatewayId,
    status,
    execution_token_issued_at: new Date(0),
    execution_token_expires_at: new Date(0),
    received_at: receivedAt instanceof Date ? receivedAt : new Date(receivedAt),
    pricing: record.pricing as DijieAuditStorageRecord["pricing"],
    role_token_pricing: record.role_token_pricing as DijieAuditStorageRecord["role_token_pricing"],
    role_usage_ledger:
      record.role_usage_ledger === undefined || record.role_usage_ledger === null
        ? null
        : (record.role_usage_ledger as DijieAuditStorageRecord["role_usage_ledger"]),
    model_proxy_usage:
      record.model_proxy_usage === undefined
        ? null
        : (record.model_proxy_usage as DijieAuditStorageRecord["model_proxy_usage"]),
    tool_usage: record.tool_usage as DijieAuditStorageRecord["tool_usage"],
    changed_files: arrayField(record.changed_files) as string[],
    artifacts: arrayField(record.artifacts) as DijieAuditStorageRecord["artifacts"],
    error_summary:
      record.error_summary === undefined || record.error_summary === null
        ? null
        : String(record.error_summary),
    payload: {} as DijieAuditStorageRecord["payload"],
  };
}

function dateField(record: UnknownRecord, field: string): Date | undefined {
  const value = record[field];
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function numberField(record: UnknownRecord, field: string): number | undefined {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableStringField(record: UnknownRecord, field: string): string | null {
  return stringField(record, field) ?? null;
}

function feedbackPacketFromGraphResult(
  value: unknown,
): DijieRoleFeedbackPacketStorageRecord | undefined {
  const record = asRecord(value);
  const packetId = stringField(record, "packet_id");
  const mode = stringField(record, "mode");
  const packageId = stringField(record, "package_id");
  const packageVersion = stringField(record, "package_version");
  const status = stringField(record, "status");
  const producedAt = dateField(record, "produced_at");
  const startedAt = dateField(record, "started_at");
  const endedAt = dateField(record, "ended_at");
  const summary = stringField(record, "summary");

  if (
    !packetId ||
    record.packet_version !== 1 ||
    (mode !== "developer_package" && mode !== "authorized_execution") ||
    !packageId ||
    !packageVersion ||
    !status ||
    !producedAt ||
    !startedAt ||
    !endedAt ||
    !summary
  ) {
    return undefined;
  }

  return {
    packet_id: packetId,
    packet_version: 1,
    execution_id: nullableStringField(record, "execution_id"),
    entitlement_id: nullableStringField(record, "entitlement_id"),
    device_id: nullableStringField(record, "device_id"),
    workspace_ref: nullableStringField(record, "workspace_ref"),
    local_gateway_id: nullableStringField(record, "local_gateway_id"),
    mode,
    role_listing_id: nullableStringField(record, "role_listing_id"),
    package_id: packageId,
    package_version: packageVersion,
    developer_ref: nullableStringField(record, "developer_ref"),
    status: status as DijieRoleFeedbackPacketStorageRecord["status"],
    produced_at: producedAt,
    started_at: startedAt,
    ended_at: endedAt,
    summary,
    changed_files: arrayField(record.changed_files) as string[],
    artifacts: arrayField(record.artifacts) as DijieRoleFeedbackPacketStorageRecord["artifacts"],
    tool_usage: asRecord(record.tool_usage) as DijieRoleFeedbackPacketStorageRecord["tool_usage"],
    model_proxy_usage:
      record.model_proxy_usage === undefined || record.model_proxy_usage === null
        ? null
        : (record.model_proxy_usage as DijieRoleFeedbackPacketStorageRecord["model_proxy_usage"]),
    cost_usage:
      record.cost_usage === undefined || record.cost_usage === null
        ? null
        : (record.cost_usage as DijieRoleFeedbackPacketStorageRecord["cost_usage"]),
    risk_events: arrayField(record.risk_events) as DijieRoleFeedbackPacketStorageRecord["risk_events"],
    evolution_suggestions: arrayField(record.evolution_suggestions) as DijieRoleFeedbackPacketStorageRecord["evolution_suggestions"],
    error:
      record.error === undefined || record.error === null
        ? null
        : (record.error as DijieRoleFeedbackPacketStorageRecord["error"]),
    payload: {} as DijieRoleFeedbackPacketStorageRecord["payload"],
  };
}

function capabilityProfileFromGraphResult(
  value: unknown,
): DijieRoleCapabilityProfileStorageRecord | undefined {
  const record = asRecord(value);
  const profileKey = stringField(record, "profile_key");
  const packageId = stringField(record, "package_id");
  const packageVersion = stringField(record, "package_version");
  const updatedAt = dateField(record, "updated_at");
  const overallScore = numberField(record, "overall_score");

  if (
    !profileKey ||
    record.profile_version !== 1 ||
    !packageId ||
    !packageVersion ||
    !updatedAt ||
    overallScore === undefined
  ) {
    return undefined;
  }

  return {
    profile_key: profileKey,
    profile_version: 1,
    package_id: packageId,
    package_version: packageVersion,
    role_listing_id: nullableStringField(record, "role_listing_id"),
    updated_at: updatedAt,
    overall_score: overallScore,
    capabilities: arrayField(record.capabilities) as DijieRoleCapabilityProfileStorageRecord["capabilities"],
    failure_modes: arrayField(record.failure_modes) as DijieRoleCapabilityProfileStorageRecord["failure_modes"],
    dispatch_hints: arrayField(record.dispatch_hints) as DijieRoleCapabilityProfileStorageRecord["dispatch_hints"],
    evaluator_adapters: asRecord(record.evaluator_adapters) as DijieRoleCapabilityProfileStorageRecord["evaluator_adapters"],
    payload: {} as DijieRoleCapabilityProfileStorageRecord["payload"],
  };
}

async function retrieveAuditRecord(
  req: MedusaRequest,
  executionId: string,
): Promise<{ configured: boolean; record?: DijieAuditReadbackRecord }> {
  const reader = resolveAuditRecordReader(req);
  if (reader) {
    return {
      configured: true,
      record: await reader.retrieveDijieAuditRecordByExecutionId(executionId),
    };
  }

  const query = resolveQueryGraph(req);
  if (!query) {
    return { configured: false };
  }

  const { data = [] } = await query.graph({
    entity: "dijie_audit_record",
    fields: [
      "id",
      "execution_id",
      "actor_id",
      "role_listing_id",
      "package_id",
      "package_version",
      "developer_ref",
      "listing_owner_ref",
      "billing_beneficiary_ref",
      "entitlement_id",
      "device_id",
      "workspace_ref",
      "local_gateway_id",
      "status",
      "pricing",
      "role_token_pricing",
      "role_usage_ledger",
      "model_proxy_usage",
      "tool_usage",
      "changed_files",
      "artifacts",
      "error_summary",
      "received_at",
    ],
    filters: {
      execution_id: executionId,
    },
    pagination: {
      take: 1,
    },
  });

  return {
    configured: true,
    record: storageRecordFromGraphResult(data[0]),
  };
}

async function retrieveSchedulerReadback(
  req: MedusaRequest,
  record: DijieAuditStorageRecord,
): Promise<SchedulerReadback> {
  const reader = resolveSchedulerBackboneReader(req);
  if (reader) {
    const [feedbackPackets, capabilityProfile] = await Promise.all([
      reader.retrieveDijieRoleFeedbackPacketsByExecutionId(record.execution_id),
      reader.retrieveDijieRoleCapabilityProfileForRole({
        packageId: record.package_id,
        packageVersion: record.package_version,
        roleListingId: record.role_listing_id,
      }),
    ]);
    return createSchedulerReadback(feedbackPackets, capabilityProfile);
  }

  const query = resolveQueryGraph(req);
  if (!query) {
    return {};
  }

  const [{ data: feedbackData = [] }, { data: profileData = [] }] = await Promise.all([
    query.graph({
      entity: "dijie_role_feedback_packet",
      fields: [
        "packet_id",
        "packet_version",
        "execution_id",
        "entitlement_id",
        "device_id",
        "workspace_ref",
        "local_gateway_id",
        "mode",
        "role_listing_id",
        "package_id",
        "package_version",
        "developer_ref",
        "status",
        "produced_at",
        "started_at",
        "ended_at",
        "summary",
        "changed_files",
        "artifacts",
        "tool_usage",
        "model_proxy_usage",
        "cost_usage",
        "risk_events",
        "evolution_suggestions",
        "error",
      ],
      filters: {
        execution_id: record.execution_id,
      },
      pagination: {
        take: 20,
      },
    }),
    query.graph({
      entity: "dijie_role_capability_profile",
      fields: [
        "profile_key",
        "profile_version",
        "package_id",
        "package_version",
        "role_listing_id",
        "updated_at",
        "overall_score",
        "capabilities",
        "failure_modes",
        "dispatch_hints",
        "evaluator_adapters",
      ],
      filters: {
        package_id: record.package_id,
        package_version: record.package_version,
        role_listing_id: record.role_listing_id,
      },
      pagination: {
        take: 1,
      },
    }),
  ]);

  return createSchedulerReadback(
    feedbackData.map(feedbackPacketFromGraphResult).filter(Boolean) as DijieRoleFeedbackPacketStorageRecord[],
    capabilityProfileFromGraphResult(profileData[0]),
  );
}

function createSchedulerReadback(
  feedbackPackets: DijieRoleFeedbackPacketStorageRecord[],
  capabilityProfile?: DijieRoleCapabilityProfileStorageRecord,
): SchedulerReadback {
  return {
    ...(feedbackPackets.length === 0
      ? {}
      : {
          feedbackPackets: feedbackPackets
            .map(createDijieRoleFeedbackPacketReadModel)
            .map(sanitizeFeedbackPacketReadModel),
        }),
    ...(capabilityProfile
      ? {
          capabilityProfile: sanitizeCapabilityProfileReadModel(
            createDijieRoleCapabilityProfileReadModel(capabilityProfile),
          ),
        }
      : {}),
  };
}

function sanitizeFeedbackPacketReadModel(
  readModel: DijieRoleFeedbackPacketReadModel,
): DijieRoleFeedbackPacketReadModel {
  return {
    ...readModel,
    packetId: redactSensitiveText(readModel.packetId),
    summary: redactSensitiveText(readModel.summary),
    changedFiles: readModel.changedFiles.map(redactSensitiveText),
    artifacts: readModel.artifacts.map((artifact) => ({
      ...artifact,
      id: redactSensitiveText(artifact.id),
      type: redactSensitiveText(artifact.type),
      title: redactSensitiveText(artifact.title),
    })),
    riskEvents: readModel.riskEvents.map((event) => ({
      ...event,
      category: redactSensitiveText(event.category),
      summary: redactSensitiveText(event.summary),
    })),
    evolutionSuggestions: readModel.evolutionSuggestions.map((suggestion) => ({
      ...suggestion,
      summary: redactSensitiveText(suggestion.summary),
      evidenceRefs: suggestion.evidenceRefs.map(redactSensitiveText),
    })),
    error:
      readModel.error === null
        ? null
        : redactSensitiveText(readModel.error),
  };
}

function sanitizeCapabilityProfileReadModel(
  readModel: DijieRoleCapabilityProfileReadModel,
): DijieRoleCapabilityProfileReadModel {
  return {
    ...readModel,
    capabilities: readModel.capabilities.map((capability) => ({
      ...capability,
      name: redactSensitiveText(capability.name),
    })),
    failureModes: readModel.failureModes.map((failureMode) => ({
      ...failureMode,
      code: redactSensitiveText(failureMode.code),
      summary: redactSensitiveText(failureMode.summary),
    })),
    dispatchHints: readModel.dispatchHints.map(redactSensitiveText),
  };
}

function createStructuredExecutionReadback(
  readModel: DijieAuditExecutionReadModel,
  schedulerReadback: SchedulerReadback,
) {
  return {
    execution: {
      roleListingId: readModel.roleListingId,
      packageId: readModel.packageId,
      packageVersion: readModel.packageVersion,
      developerRef: readModel.developerRef,
      listingOwnerRef: readModel.listingOwnerRef,
      billingBeneficiaryRef: readModel.billingBeneficiaryRef,
      status: readModel.status,
      pricing: readModel.pricing,
      roleTokenPricing: readModel.roleTokenPricing,
      toolUsage: readModel.toolUsage,
      modelProxyUsage: readModel.modelProxyUsage,
      changedFiles: readModel.changedFiles,
      receivedAt: readModel.receivedAt,
    },
    audit: {
      status: readModel.status,
      toolUsage: readModel.toolUsage,
      modelProxyUsage: readModel.modelProxyUsage,
      changedFiles: readModel.changedFiles,
      errorSummary: readModel.errorSummary,
      receivedAt: readModel.receivedAt,
      ...(schedulerReadback.feedbackPackets
        ? { feedbackPackets: schedulerReadback.feedbackPackets }
        : {}),
      ...(schedulerReadback.capabilityProfile
        ? { capabilityProfile: schedulerReadback.capabilityProfile }
        : {}),
    },
    artifacts: readModel.artifacts,
    ledger: readModel.billingSummary,
    failureReason: readModel.errorSummary,
  };
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "Dijie execution audit reads require an authenticated Mercur actor.",
    });
  }

  const params = (req as MedusaRequest & { params?: Record<string, string> }).params ?? {};
  const executionId = params.executionId?.trim();

  if (!executionId) {
    return res.status(400).json({
      ok: false,
      error: "Dijie executionId path parameter is required.",
    });
  }

  let result: { configured: boolean; record?: DijieAuditReadbackRecord };
  try {
    result = await retrieveAuditRecord(req, executionId);
  } catch {
    return res.status(502).json({
      ok: false,
      error: "Dijie audit record store failed to read the execution audit record.",
    });
  }

  if (!result.configured) {
    return res.status(503).json({
      ok: false,
      error: "Dijie audit record store is not configured.",
    });
  }

  if (!result.record) {
    return res.status(404).json({
      ok: false,
      error: "Dijie execution audit record was not found.",
    });
  }

  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });
  if (!access || !canAccessDijieExecutionData(access, result.record)) {
    return res.status(403).json({
      ok: false,
      error: "Dijie execution audit record is not available to this actor.",
    });
  }

  let schedulerReadback: SchedulerReadback = {};
  try {
    schedulerReadback = await retrieveSchedulerReadback(req, result.record);
  } catch {
    schedulerReadback = {};
  }

  const readModel = sanitizeReadModelForGateway(
    createDijieAuditExecutionReadModel(result.record),
  );

  return res.status(200).json({
    ok: true,
    auditRecordId: result.record.id ?? null,
    ...readModel,
    ...createStructuredExecutionReadback(readModel, schedulerReadback),
    ...schedulerReadback,
  });
}
