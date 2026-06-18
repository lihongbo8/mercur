import type { DijieExecutionStatus, DijieRoleArtifact } from "./audit-summary";

export type DijieRoleFeedbackPacketMode =
  | "developer_package"
  | "authorized_execution";

export type DijieEvaluatorAdapterStatus =
  | "planned"
  | "not_configured"
  | "enabled";

export type DijieCandidateStatus =
  | "pending"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "archived"
  | "applied";

export type DijieFeedbackToolUsage = {
  shellCommands: number;
  testsRun: number;
  filesRead: number;
  filesChanged: number;
};

export type DijieModelProxyUsage = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
};

export type DijieCostUsage = {
  inputTokens: number;
  outputTokens: number;
  currency?: string;
  estimatedCents?: number;
};

export type DijieRiskEvent = {
  level: "low" | "medium" | "high" | "critical";
  category: string;
  summary: string;
  requiresHumanConfirmation: boolean;
};

export type DijieEvolutionSuggestion = {
  target:
    | "capability_rubric"
    | "failure_mode_library"
    | "test_example_library"
    | "dispatch_strategy"
    | "role_package";
  summary: string;
  evidenceRefs: string[];
};

export type DijieRoleFeedbackPacket = {
  packetVersion: 1;
  packetId: string;
  mode: DijieRoleFeedbackPacketMode;
  producedAt: string;
  role: {
    packageId: string;
    packageVersion: string;
    roleListingId?: string;
    developerRef?: string;
  };
  schedulerContext?: {
    executionId?: string;
    entitlementId?: string;
    deviceId?: string;
    workspaceRef?: string;
    localGatewayId?: string;
  };
  status: DijieExecutionStatus;
  startedAt: string;
  endedAt: string;
  summary: string;
  changedFiles: string[];
  artifacts: DijieRoleArtifact[];
  toolUsage: DijieFeedbackToolUsage;
  modelProxyUsage?: DijieModelProxyUsage;
  costUsage?: DijieCostUsage;
  riskEvents: DijieRiskEvent[];
  evolutionSuggestions: DijieEvolutionSuggestion[];
  error?: string;
};

export type DijieRoleFeedbackPacketError = NonNullable<DijieRoleFeedbackPacket["error"]>;

export type DijieRoleCapabilityProfile = {
  profileVersion: 1;
  packageId: string;
  packageVersion: string;
  roleListingId?: string;
  updatedAt: string;
  overallScore: number;
  capabilities: Array<{
    name: string;
    score: number;
    evidenceCount: number;
  }>;
  failureModes: Array<{
    code: string;
    summary: string;
    occurrences: number;
  }>;
  dispatchHints: string[];
  evaluatorAdapters: {
    agentevals: DijieEvaluatorAdapterStatus;
    deepeval: DijieEvaluatorAdapterStatus;
    dspy: DijieEvaluatorAdapterStatus;
    mem0: DijieEvaluatorAdapterStatus;
  };
};

export type DijieMemoryCandidate = {
  candidateVersion: 1;
  candidateId: string;
  source: "scheduler_summary" | "role_feedback_packet" | "human_confirmation";
  status: DijieCandidateStatus;
  createdAt: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  text: string;
  evidenceRefs: string[];
  executionId?: string;
  packageId?: string;
};

export type DijieEvolutionCandidate = {
  candidateVersion: 1;
  candidateId: string;
  target:
    | "capability_rubric"
    | "failure_mode_library"
    | "test_example_library"
    | "dispatch_strategy"
    | "role_improvement"
    | "judge_prompt"
    | "few_shot";
  status: DijieCandidateStatus;
  createdAt: string;
  summary: string;
  rationale: string;
  evidenceRefs: string[];
  packageId?: string;
  executionId?: string;
};

export type DijieNormalizationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      issues: string[];
    };

export type DijieRoleFeedbackPacketStorageRecord = {
  packet_id: string;
  packet_version: 1;
  execution_id: string | null;
  entitlement_id: string | null;
  device_id: string | null;
  workspace_ref: string | null;
  local_gateway_id: string | null;
  mode: DijieRoleFeedbackPacketMode;
  role_listing_id: string | null;
  package_id: string;
  package_version: string;
  developer_ref: string | null;
  status: DijieExecutionStatus;
  produced_at: Date;
  started_at: Date;
  ended_at: Date;
  summary: string;
  changed_files: string[];
  artifacts: DijieRoleArtifact[];
  tool_usage: DijieFeedbackToolUsage;
  model_proxy_usage: DijieModelProxyUsage | null;
  cost_usage: DijieCostUsage | null;
  risk_events: DijieRiskEvent[];
  evolution_suggestions: DijieEvolutionSuggestion[];
  error: DijieRoleFeedbackPacketError | null;
  payload: DijieRoleFeedbackPacket;
};

export type DijieRoleCapabilityProfileStorageRecord = {
  profile_key: string;
  profile_version: 1;
  package_id: string;
  package_version: string;
  role_listing_id: string | null;
  updated_at: Date;
  overall_score: number;
  capabilities: DijieRoleCapabilityProfile["capabilities"];
  failure_modes: DijieRoleCapabilityProfile["failureModes"];
  dispatch_hints: DijieRoleCapabilityProfile["dispatchHints"];
  evaluator_adapters: DijieRoleCapabilityProfile["evaluatorAdapters"];
  payload: DijieRoleCapabilityProfile;
};

export type DijieMemoryCandidateStorageRecord = {
  candidate_id: string;
  candidate_version: 1;
  source: DijieMemoryCandidate["source"];
  status: DijieCandidateStatus;
  created_at: Date;
  risk_level: DijieMemoryCandidate["riskLevel"];
  text: string;
  evidence_refs: string[];
  execution_id: string | null;
  package_id: string | null;
  payload: DijieMemoryCandidate;
};

export type DijieEvolutionCandidateStorageRecord = {
  candidate_id: string;
  candidate_version: 1;
  target: DijieEvolutionCandidate["target"];
  status: DijieCandidateStatus;
  created_at: Date;
  summary: string;
  rationale: string;
  evidence_refs: string[];
  package_id: string | null;
  execution_id: string | null;
  payload: DijieEvolutionCandidate;
};

export type DijieRoleFeedbackPacketReadModel = {
  packetVersion: 1;
  packetId: string;
  mode: DijieRoleFeedbackPacketMode;
  producedAt: string;
  role: DijieRoleFeedbackPacket["role"];
  status: DijieExecutionStatus;
  startedAt: string;
  endedAt: string;
  summary: string;
  changedFiles: string[];
  artifacts: DijieRoleArtifact[];
  toolUsage: DijieFeedbackToolUsage;
  modelProxyUsage: DijieModelProxyUsage | null;
  costUsage: DijieCostUsage | null;
  riskEvents: DijieRiskEvent[];
  evolutionSuggestions: DijieEvolutionSuggestion[];
  error: DijieRoleFeedbackPacketError | null;
};

export type DijieRoleCapabilityProfileReadModel = {
  profileVersion: 1;
  packageId: string;
  packageVersion: string;
  roleListingId?: string;
  updatedAt: string;
  overallScore: number;
  capabilities: DijieRoleCapabilityProfile["capabilities"];
  failureModes: DijieRoleCapabilityProfile["failureModes"];
  dispatchHints: string[];
  evaluatorAdapters: DijieRoleCapabilityProfile["evaluatorAdapters"];
};

export type DijieSchedulerBackboneRepository = {
  createDijieRoleFeedbackPackets: (
    data: DijieRoleFeedbackPacketStorageRecord,
  ) => Promise<{ id?: string }>;
  createDijieRoleCapabilityProfiles: (
    data: DijieRoleCapabilityProfileStorageRecord,
  ) => Promise<{ id?: string }>;
  createDijieMemoryCandidates: (
    data: DijieMemoryCandidateStorageRecord,
  ) => Promise<{ id?: string }>;
  createDijieEvolutionCandidates: (
    data: DijieEvolutionCandidateStorageRecord,
  ) => Promise<{ id?: string }>;
};

export type DijieSchedulerBackboneLookupRepository = {
  listDijieRoleFeedbackPackets: (
    filters: { execution_id?: string; packet_id?: string },
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<DijieRoleFeedbackPacketStorageRecord[]>;
  listDijieRoleCapabilityProfiles: (
    filters: {
      package_id: string;
      package_version?: string;
      role_listing_id?: string | null;
    },
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<DijieRoleCapabilityProfileStorageRecord[]>;
};

export type DijieSchedulerBackboneStore = {
  recordDijieRoleFeedbackPacket: (
    packet: DijieRoleFeedbackPacket,
  ) => Promise<{ packetRecordId?: string }>;
  recordDijieRoleCapabilityProfile: (
    profile: DijieRoleCapabilityProfile,
  ) => Promise<{ profileRecordId?: string }>;
  recordDijieMemoryCandidate: (
    candidate: DijieMemoryCandidate,
  ) => Promise<{ candidateRecordId?: string }>;
  recordDijieEvolutionCandidate: (
    candidate: DijieEvolutionCandidate,
  ) => Promise<{ candidateRecordId?: string }>;
};

export type DijieSchedulerBackboneReader = {
  retrieveDijieRoleFeedbackPacketsByExecutionId: (
    executionId: string,
  ) => Promise<DijieRoleFeedbackPacketStorageRecord[]>;
  retrieveDijieRoleCapabilityProfileForRole: (input: {
    packageId: string;
    packageVersion?: string;
    roleListingId?: string | null;
  }) => Promise<DijieRoleCapabilityProfileStorageRecord | undefined>;
};

const STATUSES = new Set<DijieExecutionStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
]);
const MODES = new Set<DijieRoleFeedbackPacketMode>([
  "developer_package",
  "authorized_execution",
]);
const ADAPTER_STATUSES = new Set<DijieEvaluatorAdapterStatus>([
  "planned",
  "not_configured",
  "enabled",
]);
const MEMORY_CANDIDATE_STATUSES = new Set<DijieCandidateStatus>([
  "pending",
  "auto_approved",
  "approved",
  "rejected",
  "archived",
]);
const EVOLUTION_CANDIDATE_STATUSES = new Set<DijieCandidateStatus>([
  "pending",
  "approved",
  "rejected",
  "applied",
]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const EVOLUTION_SUGGESTION_TARGETS = new Set([
  "capability_rubric",
  "failure_mode_library",
  "test_example_library",
  "dispatch_strategy",
  "role_package",
]);
const EVOLUTION_CANDIDATE_TARGETS = new Set([
  "capability_rubric",
  "failure_mode_library",
  "test_example_library",
  "dispatch_strategy",
  "role_improvement",
  "judge_prompt",
  "few_shot",
]);
const MEMORY_CANDIDATE_SOURCES = new Set([
  "scheduler_summary",
  "role_feedback_packet",
  "human_confirmation",
]);

const SECRET_KEY_RE =
  /(api[_-]?key|secret|provider[_-]?(auth|key)|authorization|access[_-]?token|refresh[_-]?token|bearer|cloud[_-]?bearer|raw[_-]?(execution[_-]?)?token|execution[_-]?token)/i;
const PRIVATE_CONTEXT_KEY_RE =
  /(prompt|chat[_-]?history|conversation[_-]?history|messages|transcript|model[_-]?prompt|developer[_-]?mode[_-]?context|role[_-]?build[_-]?brief)/i;
const PRIVATE_ID_KEY_RE =
  /^(actor|customer|order|orderGroup|wallet|settlement|payment|account|user)Id$/i;
const LOCAL_PATH_RE =
  /(?:file:\/\/)?\/(?:Users|home|private|var|tmp|Volumes)\/[^\s"',)]+|[A-Za-z]:[\\/][^\s"',)]+/i;
const SECRET_VALUE_RE =
  /\bBearer\s+[A-Za-z0-9._~+/=-]+|\bsk-[A-Za-z0-9_-]{8,}\b|\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|\b(api[_-]?key|secret|provider[_-]?auth|access[_-]?token|refresh[_-]?token|raw[_-]?token)\s*[:=]\s*["']?[^"',}\s]+/i;
const DISALLOWED_PRIVATE_ID_VALUE_RE =
  /\b(?:cus|actor|user|ord|ordgrp|wallet|settlement|payment|acct)_[A-Za-z0-9][A-Za-z0-9_-]*\b/i;
const SCHEDULER_CONTEXT_ID_VALUE_RE =
  /\b(?:exec|ent|device|workspace|gateway)_[A-Za-z0-9][A-Za-z0-9_-]*\b/i;
const ALLOWED_FEEDBACK_SCHEDULER_CONTEXT_PATHS = new Set([
  "schedulerContext.executionId",
  "schedulerContext.entitlementId",
  "schedulerContext.deviceId",
  "schedulerContext.workspaceRef",
  "schedulerContext.localGatewayId",
]);
const ALLOWED_RECORD_CONTEXT_PATHS = new Set([
  "executionId",
  "roleListingId",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoTimestamp(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (Number.isInteger(value) && Number(value) >= 0) {
    return new Date(Number(value)).toISOString();
  }
  return undefined;
}

function boundedNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function safeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length === value.length ? normalized : undefined;
}

function normalizeArtifacts(value: unknown): DijieRoleArtifact[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const artifacts = value.map((item) => {
    const record = asRecord(item);
    const id = nonEmptyString(record.id);
    const type = nonEmptyString(record.type);
    const title = nonEmptyString(record.title);
    const sizeBytes =
      record.sizeBytes === undefined ? undefined : nonNegativeInteger(record.sizeBytes);
    const sha256 = record.sha256 === undefined ? undefined : nonEmptyString(record.sha256);
    if (
      !id ||
      !type ||
      !title ||
      (sizeBytes === undefined && record.sizeBytes !== undefined) ||
      (!sha256 && record.sha256 !== undefined)
    ) {
      return undefined;
    }
    return {
      id,
      type,
      title,
      ...(sizeBytes === undefined ? {} : { sizeBytes }),
      ...(sha256 === undefined ? {} : { sha256 }),
    };
  });

  return artifacts.every(Boolean) ? (artifacts as DijieRoleArtifact[]) : undefined;
}

function normalizeToolUsage(value: unknown): DijieFeedbackToolUsage | undefined {
  const record = asRecord(value);
  const shellCommands = nonNegativeInteger(record.shellCommands);
  const testsRun = nonNegativeInteger(record.testsRun);
  const filesRead = nonNegativeInteger(record.filesRead);
  const filesChanged = nonNegativeInteger(record.filesChanged);
  if (
    shellCommands === undefined ||
    testsRun === undefined ||
    filesRead === undefined ||
    filesChanged === undefined
  ) {
    return undefined;
  }
  return { shellCommands, testsRun, filesRead, filesChanged };
}

function normalizeModelProxyUsage(value: unknown): DijieModelProxyUsage | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asRecord(value);
  const requestCount = nonNegativeInteger(record.requestCount);
  const inputTokens = nonNegativeInteger(record.inputTokens);
  const outputTokens = nonNegativeInteger(record.outputTokens);
  if (requestCount === undefined || inputTokens === undefined || outputTokens === undefined) {
    return undefined;
  }
  return { requestCount, inputTokens, outputTokens };
}

function normalizeCostUsage(value: unknown): DijieCostUsage | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = asRecord(value);
  const inputTokens = nonNegativeInteger(record.inputTokens);
  const outputTokens = nonNegativeInteger(record.outputTokens);
  const currency = record.currency === undefined ? undefined : nonEmptyString(record.currency);
  const estimatedCents =
    record.estimatedCents === undefined ? undefined : nonNegativeInteger(record.estimatedCents);
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    (currency === undefined && record.currency !== undefined) ||
    (estimatedCents === undefined && record.estimatedCents !== undefined)
  ) {
    return undefined;
  }
  return {
    inputTokens,
    outputTokens,
    ...(currency === undefined ? {} : { currency }),
    ...(estimatedCents === undefined ? {} : { estimatedCents }),
  };
}

function normalizeRiskEvents(value: unknown): DijieRiskEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const events = value.map((item) => {
    const record = asRecord(item);
    const level = nonEmptyString(record.level);
    const category = nonEmptyString(record.category);
    const summary = nonEmptyString(record.summary);
    const requiresHumanConfirmation =
      typeof record.requiresHumanConfirmation === "boolean"
        ? record.requiresHumanConfirmation
        : undefined;
    if (!level || !RISK_LEVELS.has(level) || !category || !summary || requiresHumanConfirmation === undefined) {
      return undefined;
    }
    return {
      level: level as DijieRiskEvent["level"],
      category,
      summary,
      requiresHumanConfirmation,
    };
  });
  return events.every(Boolean) ? (events as DijieRiskEvent[]) : undefined;
}

function normalizeEvolutionSuggestions(value: unknown): DijieEvolutionSuggestion[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const suggestions = value.map((item) => {
    const record = asRecord(item);
    const target = nonEmptyString(record.target);
    const summary = nonEmptyString(record.summary);
    const evidenceRefs = safeStringArray(record.evidenceRefs);
    if (!target || !EVOLUTION_SUGGESTION_TARGETS.has(target) || !summary || !evidenceRefs) {
      return undefined;
    }
    return {
      target: target as DijieEvolutionSuggestion["target"],
      summary,
      evidenceRefs,
    };
  });
  return suggestions.every(Boolean)
    ? (suggestions as DijieEvolutionSuggestion[])
    : undefined;
}

function normalizeError(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nonEmptyString(value);
}

function inspectLeakage(
  value: unknown,
  path: string,
  issues: string[],
  allowedSchedulerContextPaths = new Set<string>(),
): void {
  if (typeof value === "string") {
    if (LOCAL_PATH_RE.test(value)) {
      issues.push(`${path || "payload"} must not contain local absolute paths.`);
    }
    if (SECRET_VALUE_RE.test(value)) {
      issues.push(`${path || "payload"} must not contain raw tokens, bearer auth, provider auth, or secrets.`);
    }
    if (DISALLOWED_PRIVATE_ID_VALUE_RE.test(value)) {
      issues.push(`${path || "payload"} must not contain private actor, order, wallet, or account identifiers.`);
    }
    if (
      SCHEDULER_CONTEXT_ID_VALUE_RE.test(value) &&
      !allowedSchedulerContextPaths.has(path) &&
      !ALLOWED_RECORD_CONTEXT_PATHS.has(path)
    ) {
      issues.push(`${path || "payload"} must not contain scheduler context identifiers outside allowed context fields.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      inspectLeakage(item, `${path}[${index}]`, issues, allowedSchedulerContextPaths);
    });
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (SECRET_KEY_RE.test(key)) {
      issues.push(`${nextPath} must not contain secret, token, bearer, or provider auth fields.`);
    }
    if (PRIVATE_CONTEXT_KEY_RE.test(key)) {
      issues.push(`${nextPath} must not contain prompt, chat history, transcript, or private context fields.`);
    }
    if (PRIVATE_ID_KEY_RE.test(key) && !allowedSchedulerContextPaths.has(nextPath)) {
      issues.push(`${nextPath} must not contain private platform identifiers.`);
    }
    inspectLeakage(entry, nextPath, issues, allowedSchedulerContextPaths);
  }
}

function withLeakageCheck<T>(
  value: unknown,
  normalized: T | undefined,
  allowedSchedulerContextPaths = new Set<string>(),
): DijieNormalizationResult<T> {
  const issues: string[] = [];
  if (!normalized) {
    issues.push("Payload does not match the Dijie scheduler backbone v1 shape.");
  }
  inspectLeakage(value, "", issues, allowedSchedulerContextPaths);
  const uniqueIssues = [...new Set(issues)];
  return normalized && uniqueIssues.length === 0
    ? { ok: true, value: normalized }
    : { ok: false, issues: uniqueIssues };
}

export function normalizeDijieRoleFeedbackPacket(
  value: unknown,
): DijieNormalizationResult<DijieRoleFeedbackPacket> {
  const record = asRecord(value);
  const packetVersion = record.packetVersion === 1 ? 1 : undefined;
  const packetId = nonEmptyString(record.packetId);
  const mode = nonEmptyString(record.mode);
  const producedAt = isoTimestamp(record.producedAt);
  const role = asRecord(record.role);
  const packageId = nonEmptyString(role.packageId);
  const packageVersion = nonEmptyString(role.packageVersion);
  const roleListingId =
    role.roleListingId === undefined ? undefined : nonEmptyString(role.roleListingId);
  const developerRef =
    role.developerRef === undefined ? undefined : nonEmptyString(role.developerRef);
  const schedulerContext =
    record.schedulerContext === undefined ? undefined : asRecord(record.schedulerContext);
  const status = nonEmptyString(record.status);
  const startedAt = isoTimestamp(record.startedAt);
  const endedAt = isoTimestamp(record.endedAt);
  const summary = nonEmptyString(record.summary);
  const changedFiles = safeStringArray(record.changedFiles);
  const artifacts = normalizeArtifacts(record.artifacts);
  const toolUsage = normalizeToolUsage(record.toolUsage);
  const modelProxyUsage = normalizeModelProxyUsage(record.modelProxyUsage);
  const costUsage = normalizeCostUsage(record.costUsage);
  const riskEvents = normalizeRiskEvents(record.riskEvents);
  const evolutionSuggestions = normalizeEvolutionSuggestions(record.evolutionSuggestions);
  const error = normalizeError(record.error);

  const normalized: DijieRoleFeedbackPacket | undefined =
    packetVersion &&
    packetId &&
    mode &&
    MODES.has(mode as DijieRoleFeedbackPacketMode) &&
    producedAt &&
    packageId &&
    packageVersion &&
    (roleListingId !== undefined || role.roleListingId === undefined) &&
    (developerRef !== undefined || role.developerRef === undefined) &&
    status &&
    STATUSES.has(status as DijieExecutionStatus) &&
    startedAt &&
    endedAt &&
    summary &&
    changedFiles &&
    artifacts &&
    toolUsage &&
    (modelProxyUsage !== undefined || record.modelProxyUsage === undefined) &&
    (costUsage !== undefined || record.costUsage === undefined) &&
    riskEvents &&
    evolutionSuggestions &&
    (error !== undefined || record.error === undefined)
      ? {
          packetVersion,
          packetId,
          mode: mode as DijieRoleFeedbackPacketMode,
          producedAt,
          role: {
            packageId,
            packageVersion,
            ...(roleListingId === undefined ? {} : { roleListingId }),
            ...(developerRef === undefined ? {} : { developerRef }),
          },
          ...(schedulerContext === undefined
            ? {}
            : {
                schedulerContext: {
                  ...(nonEmptyString(schedulerContext.executionId) === undefined
                    ? {}
                    : { executionId: nonEmptyString(schedulerContext.executionId) }),
                  ...(nonEmptyString(schedulerContext.entitlementId) === undefined
                    ? {}
                    : { entitlementId: nonEmptyString(schedulerContext.entitlementId) }),
                  ...(nonEmptyString(schedulerContext.deviceId) === undefined
                    ? {}
                    : { deviceId: nonEmptyString(schedulerContext.deviceId) }),
                  ...(nonEmptyString(schedulerContext.workspaceRef) === undefined
                    ? {}
                    : { workspaceRef: nonEmptyString(schedulerContext.workspaceRef) }),
                  ...(nonEmptyString(schedulerContext.localGatewayId) === undefined
                    ? {}
                    : { localGatewayId: nonEmptyString(schedulerContext.localGatewayId) }),
                },
              }),
          status: status as DijieExecutionStatus,
          startedAt,
          endedAt,
          summary,
          changedFiles,
          artifacts,
          toolUsage,
          ...(modelProxyUsage === undefined ? {} : { modelProxyUsage }),
          ...(costUsage === undefined ? {} : { costUsage }),
          riskEvents,
          evolutionSuggestions,
          ...(error === undefined ? {} : { error }),
        }
      : undefined;

  return withLeakageCheck(value, normalized, ALLOWED_FEEDBACK_SCHEDULER_CONTEXT_PATHS);
}

function normalizeCapabilities(value: unknown): DijieRoleCapabilityProfile["capabilities"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const capabilities = value.map((item) => {
    const record = asRecord(item);
    const name = nonEmptyString(record.name);
    const score = boundedNumber(record.score, 0, 100);
    const evidenceCount = nonNegativeInteger(record.evidenceCount);
    if (!name || score === undefined || evidenceCount === undefined) {
      return undefined;
    }
    return {
      name,
      score,
      evidenceCount,
    };
  });
  return capabilities.every(Boolean)
    ? (capabilities as DijieRoleCapabilityProfile["capabilities"])
    : undefined;
}

function normalizeFailureModes(value: unknown): DijieRoleCapabilityProfile["failureModes"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const failureModes = value.map((item) => {
    const record = asRecord(item);
    const code = nonEmptyString(record.code);
    const summary = nonEmptyString(record.summary);
    const occurrences = nonNegativeInteger(record.occurrences);
    if (!code || !summary || occurrences === undefined) {
      return undefined;
    }
    return {
      code,
      summary,
      occurrences,
    };
  });
  return failureModes.every(Boolean)
    ? (failureModes as DijieRoleCapabilityProfile["failureModes"])
    : undefined;
}

function normalizeDispatchHints(value: unknown): string[] | undefined {
  return safeStringArray(value);
}

function normalizeEvaluatorAdapters(
  value: unknown,
): DijieRoleCapabilityProfile["evaluatorAdapters"] | undefined {
  const record = asRecord(value);
  const agentevals = nonEmptyString(record.agentevals);
  const deepeval = nonEmptyString(record.deepeval);
  const dspy = nonEmptyString(record.dspy);
  const mem0 = nonEmptyString(record.mem0);
  if (
    !agentevals ||
    !deepeval ||
    !dspy ||
    !mem0 ||
    !ADAPTER_STATUSES.has(agentevals as DijieEvaluatorAdapterStatus) ||
    !ADAPTER_STATUSES.has(deepeval as DijieEvaluatorAdapterStatus) ||
    !ADAPTER_STATUSES.has(dspy as DijieEvaluatorAdapterStatus) ||
    !ADAPTER_STATUSES.has(mem0 as DijieEvaluatorAdapterStatus)
  ) {
    return undefined;
  }
  return {
    agentevals: agentevals as DijieEvaluatorAdapterStatus,
    deepeval: deepeval as DijieEvaluatorAdapterStatus,
    dspy: dspy as DijieEvaluatorAdapterStatus,
    mem0: mem0 as DijieEvaluatorAdapterStatus,
  };
}

export function normalizeDijieRoleCapabilityProfile(
  value: unknown,
): DijieNormalizationResult<DijieRoleCapabilityProfile> {
  const record = asRecord(value);
  const profileVersion = record.profileVersion === 1 ? 1 : undefined;
  const packageId = nonEmptyString(record.packageId);
  const packageVersion = nonEmptyString(record.packageVersion);
  const roleListingId =
    record.roleListingId === undefined ? undefined : nonEmptyString(record.roleListingId);
  const updatedAt = isoTimestamp(record.updatedAt);
  const overallScore = boundedNumber(record.overallScore, 0, 100);
  const capabilities = normalizeCapabilities(record.capabilities);
  const failureModes = normalizeFailureModes(record.failureModes);
  const dispatchHints = normalizeDispatchHints(record.dispatchHints);
  const evaluatorAdapters = normalizeEvaluatorAdapters(record.evaluatorAdapters);

  const normalized: DijieRoleCapabilityProfile | undefined =
    profileVersion &&
    packageId &&
    packageVersion &&
    (roleListingId !== undefined || record.roleListingId === undefined) &&
    updatedAt &&
    overallScore !== undefined &&
    capabilities &&
    failureModes &&
    dispatchHints &&
    evaluatorAdapters
      ? {
          profileVersion,
          packageId,
          packageVersion,
          ...(roleListingId === undefined ? {} : { roleListingId }),
          updatedAt,
          overallScore,
          capabilities,
          failureModes,
          dispatchHints,
          evaluatorAdapters,
        }
      : undefined;

  return withLeakageCheck(value, normalized);
}

function normalizeCandidateCommon(value: unknown) {
  const record = asRecord(value);
  const candidateVersion: 1 | undefined = record.candidateVersion === 1 ? 1 : undefined;
  const candidateId = nonEmptyString(record.candidateId);
  const status = nonEmptyString(record.status);
  const createdAt = isoTimestamp(record.createdAt);
  const packageId = record.packageId === undefined ? undefined : nonEmptyString(record.packageId);
  const executionId =
    record.executionId === undefined ? undefined : nonEmptyString(record.executionId);
  const summary = nonEmptyString(record.summary);
  const evidenceRefs = safeStringArray(record.evidenceRefs);

  return {
    record,
    candidateVersion,
    candidateId,
    status,
    createdAt,
    packageId,
    executionId,
    summary,
    evidenceRefs,
  };
}

export function normalizeDijieMemoryCandidate(
  value: unknown,
): DijieNormalizationResult<DijieMemoryCandidate> {
  const common = normalizeCandidateCommon(value);
  const source = nonEmptyString(common.record.source);
  const riskLevel = nonEmptyString(common.record.riskLevel);
  const text = nonEmptyString(common.record.text);
  const normalized: DijieMemoryCandidate | undefined =
    common.candidateVersion &&
    common.candidateId &&
    source &&
    MEMORY_CANDIDATE_SOURCES.has(source) &&
    common.status &&
    MEMORY_CANDIDATE_STATUSES.has(common.status as DijieCandidateStatus) &&
    common.createdAt &&
    riskLevel &&
    RISK_LEVELS.has(riskLevel) &&
    text &&
    common.evidenceRefs &&
    (common.executionId !== undefined || common.record.executionId === undefined) &&
    (common.packageId !== undefined || common.record.packageId === undefined)
      ? {
          candidateVersion: common.candidateVersion,
          candidateId: common.candidateId,
          source: source as DijieMemoryCandidate["source"],
          status: common.status as DijieCandidateStatus,
          createdAt: common.createdAt,
          riskLevel: riskLevel as DijieMemoryCandidate["riskLevel"],
          text,
          evidenceRefs: common.evidenceRefs,
          ...(common.executionId === undefined ? {} : { executionId: common.executionId }),
          ...(common.packageId === undefined ? {} : { packageId: common.packageId }),
        }
      : undefined;

  return withLeakageCheck(value, normalized, ALLOWED_RECORD_CONTEXT_PATHS);
}

export function normalizeDijieEvolutionCandidate(
  value: unknown,
): DijieNormalizationResult<DijieEvolutionCandidate> {
  const common = normalizeCandidateCommon(value);
  const target = nonEmptyString(common.record.target);
  const rationale = nonEmptyString(common.record.rationale);
  const normalized: DijieEvolutionCandidate | undefined =
    common.candidateVersion &&
    common.candidateId &&
    target &&
    EVOLUTION_CANDIDATE_TARGETS.has(target) &&
    common.status &&
    EVOLUTION_CANDIDATE_STATUSES.has(common.status as DijieCandidateStatus) &&
    common.createdAt &&
    common.summary &&
    rationale &&
    common.evidenceRefs &&
    (common.packageId !== undefined || common.record.packageId === undefined) &&
    (common.executionId !== undefined || common.record.executionId === undefined)
      ? {
          candidateVersion: common.candidateVersion,
          candidateId: common.candidateId,
          target: target as DijieEvolutionCandidate["target"],
          status: common.status as DijieCandidateStatus,
          createdAt: common.createdAt,
          summary: common.summary,
          rationale,
          evidenceRefs: common.evidenceRefs,
          ...(common.packageId === undefined ? {} : { packageId: common.packageId }),
          ...(common.executionId === undefined ? {} : { executionId: common.executionId }),
        }
      : undefined;

  return withLeakageCheck(value, normalized, ALLOWED_RECORD_CONTEXT_PATHS);
}

function assertNormalized<T>(result: DijieNormalizationResult<T>): T {
  if (!result.ok) {
    throw new Error(result.issues.join(" "));
  }
  return result.value;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function basenameForLocalPath(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("file://") ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    return normalized.split("/").filter(Boolean).at(-1) ?? "[redacted-local-path]";
  }
  return value.trim();
}

function sanitizeChangedFiles(value: string[]): string[] {
  return value.map(basenameForLocalPath).filter(Boolean);
}

export function createDijieRoleFeedbackPacketStorageRecord(
  input: DijieRoleFeedbackPacket,
): DijieRoleFeedbackPacketStorageRecord {
  const packet = assertNormalized(normalizeDijieRoleFeedbackPacket(input));
  return {
    packet_id: packet.packetId,
    packet_version: 1,
    execution_id: packet.schedulerContext?.executionId ?? null,
    entitlement_id: packet.schedulerContext?.entitlementId ?? null,
    device_id: packet.schedulerContext?.deviceId ?? null,
    workspace_ref: packet.schedulerContext?.workspaceRef ?? null,
    local_gateway_id: packet.schedulerContext?.localGatewayId ?? null,
    mode: packet.mode,
    role_listing_id: packet.role.roleListingId ?? null,
    package_id: packet.role.packageId,
    package_version: packet.role.packageVersion,
    developer_ref: packet.role.developerRef ?? null,
    status: packet.status,
    produced_at: new Date(packet.producedAt),
    started_at: new Date(packet.startedAt),
    ended_at: new Date(packet.endedAt),
    summary: packet.summary,
    changed_files: packet.changedFiles,
    artifacts: packet.artifacts,
    tool_usage: packet.toolUsage,
    model_proxy_usage: packet.modelProxyUsage ?? null,
    cost_usage: packet.costUsage ?? null,
    risk_events: packet.riskEvents,
    evolution_suggestions: packet.evolutionSuggestions,
    error: packet.error ?? null,
    payload: packet,
  };
}

export function createDijieRoleCapabilityProfileStorageRecord(
  input: DijieRoleCapabilityProfile,
): DijieRoleCapabilityProfileStorageRecord {
  const profile = assertNormalized(normalizeDijieRoleCapabilityProfile(input));
  return {
    profile_key: [
      profile.roleListingId ?? "unlisted",
      profile.packageId,
      profile.packageVersion,
    ].join(":"),
    profile_version: 1,
    package_id: profile.packageId,
    package_version: profile.packageVersion,
    role_listing_id: profile.roleListingId ?? null,
    updated_at: new Date(profile.updatedAt),
    overall_score: profile.overallScore,
    capabilities: profile.capabilities,
    failure_modes: profile.failureModes,
    dispatch_hints: profile.dispatchHints,
    evaluator_adapters: profile.evaluatorAdapters,
    payload: profile,
  };
}

export function createDijieMemoryCandidateStorageRecord(
  input: DijieMemoryCandidate,
): DijieMemoryCandidateStorageRecord {
  const candidate = assertNormalized(normalizeDijieMemoryCandidate(input));
  return {
    candidate_id: candidate.candidateId,
    candidate_version: 1,
    source: candidate.source,
    status: candidate.status,
    created_at: new Date(candidate.createdAt),
    risk_level: candidate.riskLevel,
    text: candidate.text,
    evidence_refs: candidate.evidenceRefs,
    execution_id: candidate.executionId ?? null,
    package_id: candidate.packageId ?? null,
    payload: candidate,
  };
}

export function createDijieEvolutionCandidateStorageRecord(
  input: DijieEvolutionCandidate,
): DijieEvolutionCandidateStorageRecord {
  const candidate = assertNormalized(normalizeDijieEvolutionCandidate(input));
  return {
    candidate_id: candidate.candidateId,
    candidate_version: 1,
    target: candidate.target,
    status: candidate.status,
    created_at: new Date(candidate.createdAt),
    summary: candidate.summary,
    rationale: candidate.rationale,
    evidence_refs: candidate.evidenceRefs,
    package_id: candidate.packageId ?? null,
    execution_id: candidate.executionId ?? null,
    payload: candidate,
  };
}

export function createDijieRoleFeedbackPacketReadModel(
  record: DijieRoleFeedbackPacketStorageRecord,
): DijieRoleFeedbackPacketReadModel {
  return {
    packetVersion: 1,
    packetId: record.packet_id,
    mode: record.mode,
    producedAt: toIsoString(record.produced_at),
    role: {
      packageId: record.package_id,
      packageVersion: record.package_version,
      ...(record.role_listing_id === null ? {} : { roleListingId: record.role_listing_id }),
      ...(record.developer_ref === null ? {} : { developerRef: record.developer_ref }),
    },
    status: record.status,
    startedAt: toIsoString(record.started_at),
    endedAt: toIsoString(record.ended_at),
    summary: record.summary,
    changedFiles: sanitizeChangedFiles(record.changed_files),
    artifacts: record.artifacts.map((artifact) => ({
      ...artifact,
      title: basenameForLocalPath(artifact.title),
    })),
    toolUsage: record.tool_usage,
    modelProxyUsage: record.model_proxy_usage,
    costUsage: record.cost_usage,
    riskEvents: record.risk_events,
    evolutionSuggestions: record.evolution_suggestions,
    error: record.error,
  };
}

export function createDijieRoleCapabilityProfileReadModel(
  record: DijieRoleCapabilityProfileStorageRecord,
): DijieRoleCapabilityProfileReadModel {
  return {
    profileVersion: 1,
    packageId: record.package_id,
    packageVersion: record.package_version,
    ...(record.role_listing_id === null ? {} : { roleListingId: record.role_listing_id }),
    updatedAt: toIsoString(record.updated_at),
    overallScore: record.overall_score,
    capabilities: record.capabilities,
    failureModes: record.failure_modes,
    dispatchHints: record.dispatch_hints,
    evaluatorAdapters: record.evaluator_adapters,
  };
}

export async function recordDijieRoleFeedbackPacketWithRepository(
  repository: Pick<DijieSchedulerBackboneRepository, "createDijieRoleFeedbackPackets">,
  packet: DijieRoleFeedbackPacket,
): Promise<{ packetRecordId?: string }> {
  const stored = await repository.createDijieRoleFeedbackPackets(
    createDijieRoleFeedbackPacketStorageRecord(packet),
  );
  return { packetRecordId: stored.id };
}

export async function recordDijieRoleCapabilityProfileWithRepository(
  repository: Pick<DijieSchedulerBackboneRepository, "createDijieRoleCapabilityProfiles">,
  profile: DijieRoleCapabilityProfile,
): Promise<{ profileRecordId?: string }> {
  const stored = await repository.createDijieRoleCapabilityProfiles(
    createDijieRoleCapabilityProfileStorageRecord(profile),
  );
  return { profileRecordId: stored.id };
}

export async function recordDijieMemoryCandidateWithRepository(
  repository: Pick<DijieSchedulerBackboneRepository, "createDijieMemoryCandidates">,
  candidate: DijieMemoryCandidate,
): Promise<{ candidateRecordId?: string }> {
  const stored = await repository.createDijieMemoryCandidates(
    createDijieMemoryCandidateStorageRecord(candidate),
  );
  return { candidateRecordId: stored.id };
}

export async function recordDijieEvolutionCandidateWithRepository(
  repository: Pick<DijieSchedulerBackboneRepository, "createDijieEvolutionCandidates">,
  candidate: DijieEvolutionCandidate,
): Promise<{ candidateRecordId?: string }> {
  const stored = await repository.createDijieEvolutionCandidates(
    createDijieEvolutionCandidateStorageRecord(candidate),
  );
  return { candidateRecordId: stored.id };
}

export async function retrieveDijieRoleFeedbackPacketsByExecutionIdWithRepository(
  repository: Pick<DijieSchedulerBackboneLookupRepository, "listDijieRoleFeedbackPackets">,
  executionId: string,
): Promise<DijieRoleFeedbackPacketStorageRecord[]> {
  return repository.listDijieRoleFeedbackPackets(
    { execution_id: executionId },
    {
      take: 20,
      order: {
        produced_at: "DESC",
      },
    },
  );
}

export async function retrieveDijieRoleCapabilityProfileWithRepository(
  repository: Pick<DijieSchedulerBackboneLookupRepository, "listDijieRoleCapabilityProfiles">,
  input: {
    packageId: string;
    packageVersion?: string;
    roleListingId?: string | null;
  },
): Promise<DijieRoleCapabilityProfileStorageRecord | undefined> {
  const [record] = await repository.listDijieRoleCapabilityProfiles(
    {
      package_id: input.packageId,
      ...(input.packageVersion === undefined
        ? {}
        : { package_version: input.packageVersion }),
      ...(input.roleListingId === undefined
        ? {}
        : { role_listing_id: input.roleListingId }),
    },
    {
      take: 1,
      order: {
        updated_at: "DESC",
      },
    },
  );
  return record;
}
