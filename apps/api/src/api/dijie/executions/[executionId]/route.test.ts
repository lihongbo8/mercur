import { describe, expect, it } from "bun:test";
import {
  createDijieAuditStorageRecord,
  DIJIE_AUDIT_MODULE,
} from "../../../../lib/dijie/audit-store";
import type { DijieAuditRecord } from "../../../../lib/dijie/audit-summary";
import {
  createDijieRoleCapabilityProfileStorageRecord,
  createDijieRoleFeedbackPacketStorageRecord,
  type DijieRoleCapabilityProfile,
  type DijieRoleFeedbackPacket,
} from "../../../../lib/dijie/scheduler-backbone-store";
import { GET } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function request(
  store?: unknown,
  params: Record<string, string> = { executionId: "exec_123" },
  authContext: string | Record<string, unknown> | null = "cus_123",
) {
  const resolvedAuthContext =
    typeof authContext === "string" ? { actor_id: authContext } : authContext;
  return {
    params,
    ...(resolvedAuthContext
      ? {
          auth_context: resolvedAuthContext,
        }
      : {}),
    scope: {
      resolve(name: string) {
        if (store && name === DIJIE_AUDIT_MODULE) {
          return store;
        }
        throw new Error(`Unknown dependency: ${name}`);
      },
    },
  };
}

function queryRequest(
  data: unknown[],
  schedulerData: Record<string, unknown[]> = {},
) {
  return {
    params: {
      executionId: "exec_123",
    },
    auth_context: {
      actor_id: "cus_123",
    },
    scope: {
      resolve(name: string) {
        if (name === "query") {
          return {
            async graph(input: { entity: string; filters: Record<string, unknown> }) {
              if (input.entity === "dijie_audit_record") {
                expect(input).toMatchObject({
                  entity: "dijie_audit_record",
                  filters: {
                    execution_id: "exec_123",
                  },
                });
                return { data };
              }
              return { data: schedulerData[input.entity] ?? [] };
            },
          };
        }
        throw new Error(`Unknown dependency: ${name}`);
      },
    },
  };
}

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000 as const,
  platformFeeBps: 0 as const,
};

const record: DijieAuditRecord = {
  auditRecordVersion: 1,
  actorId: "cus_123",
  packageId: "pkg_role_123",
  packageVersion: "1.0.0",
  developerRef: "dev_001",
  listingOwnerRef: "seller_001",
  billingBeneficiaryRef: "dev_001",
  receivedAt: "2026-05-31T08:02:00.000Z",
  executionTokenIssuedAt: "2026-05-31T08:00:00.000Z",
  executionTokenExpiresAt: "2026-05-31T08:05:00.000Z",
  pricing: {
    kind: "one_time_authorization",
    authorizationFeeCents: 29900,
    currency: "CNY",
    platformFeeBps: 0,
    developerReceivableCents: 29900,
  },
  roleTokenPricing,
  roleUsageLedger: {
    ledger: "usage",
    source: "role_usage",
    entryId: "role_usage_exec_123",
    executionId: "exec_123",
    actorId: "cus_123",
    developerId: "dev_001",
    developerRef: "dev_001",
    billingBeneficiaryRef: "dev_001",
    roleListingId: "role_123",
    packageId: "pkg_role_123",
    packageVersion: "1.0.0",
    entitlementId: "ent_123",
    workspaceRef: "workspace_123",
    usageKind: "model_tokens",
    meters: [
      { name: "request_count", quantity: 1, unit: "request" },
      { name: "input_tokens", quantity: 1000, unit: "token" },
      { name: "output_tokens", quantity: 500, unit: "token" },
    ],
    currency: "CNY",
    grossAmountCents: 1,
    platformReceivableCents: 0,
    developerReceivableCents: 1,
    occurredAt: "2026-05-31T08:02:00.000Z",
  },
  summary: {
    executionId: "exec_123",
    deviceId: "device_123",
    workspaceRef: "workspace_123",
    roleListingId: "role_123",
    packageId: "pkg_role_123",
    packageVersion: "1.0.0",
    developerRef: "dev_001",
    listingOwnerRef: "seller_001",
    billingBeneficiaryRef: "dev_001",
    entitlementId: "ent_123",
    localGatewayId: "gateway_123",
    status: "failed",
    startedAt: "2026-05-31T08:00:00.000Z",
    endedAt: "2026-05-31T08:01:00.000Z",
    modelProxyUsage: {
      requestCount: 1,
      inputTokens: 1000,
      outputTokens: 500,
    },
    toolUsage: {
      shellCommands: 2,
      testsRun: 1,
      filesRead: 4,
      filesChanged: 2,
    },
    result: {
      executionId: "exec_123",
      roleListingId: "role_123",
      packageId: "pkg_role_123",
      packageVersion: "1.0.0",
      developerRef: "dev_001",
      listingOwnerRef: "seller_001",
      billingBeneficiaryRef: "dev_001",
      status: "failed",
      startedAt: "2026-05-31T08:00:00.000Z",
      endedAt: "2026-05-31T08:01:00.000Z",
      changedFiles: ["/Users/alice/workspace/private.ts", "role_package/manifest.json"],
      artifacts: [
        {
          id: "artifact_123",
          type: "role_package",
          title: "Role package",
          sizeBytes: 2048,
          sha256: "abc123",
        },
      ],
      error: "Validation failed.",
    },
  },
};

const feedbackPacket: DijieRoleFeedbackPacket = {
  packetVersion: 1,
  packetId: "packet_123",
  mode: "authorized_execution",
  producedAt: "2026-05-31T08:02:30.000Z",
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
  startedAt: "2026-05-31T08:00:00.000Z",
  endedAt: "2026-05-31T08:02:00.000Z",
  summary: "Role completed validation without unsafe package metadata.",
  changedFiles: ["role_package/manifest.json"],
  artifacts: [
    {
      id: "artifact_456",
      type: "role_feedback",
      title: "Feedback summary",
      sizeBytes: 512,
    },
  ],
  toolUsage: {
    shellCommands: 0,
    filesRead: 2,
    testsRun: 1,
    filesChanged: 1,
  },
  riskEvents: [
    {
      level: "low",
      category: "privacy_check",
      summary: "No private execution context was exposed.",
      requiresHumanConfirmation: false,
    },
  ],
  evolutionSuggestions: [
    {
      target: "capability_rubric",
      summary: "Record manifest validation as a capability signal.",
      evidenceRefs: ["packet_123"],
    },
  ],
};

const capabilityProfile: DijieRoleCapabilityProfile = {
  profileVersion: 1,
  packageId: "pkg_role_123",
  packageVersion: "1.0.0",
  roleListingId: "role_123",
  updatedAt: "2026-05-31T08:03:00.000Z",
  overallScore: 88,
  capabilities: [
    {
      name: "manifest_validation",
      score: 92,
      evidenceCount: 1,
    },
  ],
  failureModes: [
    {
      code: "missing_artifact",
      summary: "Fails closed when an artifact is absent.",
      occurrences: 1,
    },
  ],
  dispatchHints: ["Use after package upload."],
  evaluatorAdapters: {
    agentevals: "planned",
    deepeval: "not_configured",
    dspy: "not_configured",
    mem0: "planned",
  },
};

describe("GET /dijie/executions/:executionId", () => {
  it("requires an authenticated Mercur actor", async () => {
    const res = response();
    await GET(request(undefined, { executionId: "exec_123" }, null) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "Dijie execution audit reads require an authenticated Mercur actor.",
    });
  });

  it("rejects requests without an execution id path parameter", async () => {
    const res = response();
    await GET(request(undefined, {}) as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "Dijie executionId path parameter is required.",
    });
  });

  it("returns a safe audit read model from the audit module service", async () => {
    const storageRecord = {
      ...createDijieAuditStorageRecord(record),
      id: "djaudit_123",
    };
    const store = {
      async retrieveDijieAuditRecordByExecutionId(executionId: string) {
        expect(executionId).toBe("exec_123");
        return storageRecord;
      },
    };

    const res = response();
    await GET(request(store) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      auditRecordId: "djaudit_123",
      roleListingId: "role_123",
      packageId: "pkg_role_123",
      packageVersion: "1.0.0",
      developerRef: "dev_001",
      listingOwnerRef: "seller_001",
      billingBeneficiaryRef: "dev_001",
      status: "failed",
      pricing: {
        authorizationFeeCents: 29900,
      },
      roleTokenPricing: {
        inputTokenCentsPerMillion: 120,
        outputTokenCentsPerMillion: 360,
      },
      billingSummary: {
        source: "role_usage",
        inputTokens: 1000,
        outputTokens: 500,
        inputTokenCentsPerMillion: 120,
        outputTokenCentsPerMillion: 360,
        platformReceivableCents: 0,
        developerReceivableCents: 1,
      },
      toolUsage: {
        filesChanged: 2,
      },
      modelProxyUsage: {
        requestCount: 1,
      },
      changedFiles: ["private.ts", "role_package/manifest.json"],
      artifacts: [
        {
          id: "artifact_123",
          type: "role_package",
          title: "Role package",
        },
      ],
      execution: {
        roleListingId: "role_123",
        packageId: "pkg_role_123",
        packageVersion: "1.0.0",
        status: "failed",
        toolUsage: {
          filesChanged: 2,
        },
        modelProxyUsage: {
          requestCount: 1,
        },
      },
      audit: {
        status: "failed",
        toolUsage: {
          filesChanged: 2,
        },
        modelProxyUsage: {
          requestCount: 1,
        },
        errorSummary: "Validation failed.",
      },
      ledger: {
        source: "role_usage",
        platformReceivableCents: 0,
        developerReceivableCents: 1,
      },
      failureReason: "Validation failed.",
      errorSummary: "Validation failed.",
      receivedAt: "2026-05-31T08:02:00.000Z",
    });
    expect(res.body).toHaveProperty("artifacts");
    const bodyRecord = res.body as Record<string, unknown>;
    expect(bodyRecord.execution).not.toHaveProperty("executionId");
    expect(bodyRecord.execution).not.toHaveProperty("actorId");
    expect(bodyRecord.execution).not.toHaveProperty("entitlementId");
    expect(bodyRecord.execution).not.toHaveProperty("deviceId");
    expect(bodyRecord.execution).not.toHaveProperty("workspaceRef");
    expect(bodyRecord.execution).not.toHaveProperty("localGatewayId");
    expect(bodyRecord.audit).not.toHaveProperty("payload");
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("/Users/alice");
    expect(bodyText).not.toContain("exec_123");
    expect(bodyText).not.toContain("cus_123");
    expect(bodyText).not.toContain("ent_123");
    expect(bodyText).not.toContain("device_123");
    expect(bodyText).not.toContain("workspace_123");
    expect(bodyText).not.toContain("gateway_123");
    expect(res.body).not.toHaveProperty("executionId");
    expect(res.body).not.toHaveProperty("actorId");
    expect(res.body).not.toHaveProperty("entitlementId");
    expect(res.body).not.toHaveProperty("deviceId");
    expect(res.body).not.toHaveProperty("workspaceRef");
    expect(res.body).not.toHaveProperty("localGatewayId");
    expect(res.body).not.toHaveProperty("payload");
  });

  it("includes safe scheduler feedback and capability summaries when present", async () => {
    const storageRecord = createDijieAuditStorageRecord(record);
    const feedbackStorage = createDijieRoleFeedbackPacketStorageRecord(feedbackPacket);
    const profileStorage = createDijieRoleCapabilityProfileStorageRecord(capabilityProfile);
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        return storageRecord;
      },
      async retrieveDijieRoleFeedbackPacketsByExecutionId(executionId: string) {
        expect(executionId).toBe("exec_123");
        return [feedbackStorage];
      },
      async retrieveDijieRoleCapabilityProfileForRole(input: {
        packageId: string;
        packageVersion?: string;
        roleListingId?: string | null;
      }) {
        expect(input).toEqual({
          packageId: "pkg_role_123",
          packageVersion: "1.0.0",
          roleListingId: "role_123",
        });
        return profileStorage;
      },
    };

    const res = response();
    await GET(request(store) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      feedbackPackets: [
        {
          packetVersion: 1,
          packetId: "packet_123",
          role: {
            packageId: "pkg_role_123",
            packageVersion: "1.0.0",
            roleListingId: "role_123",
          },
          summary: "Role completed validation without unsafe package metadata.",
          riskEvents: [
            {
              category: "privacy_check",
            },
          ],
        },
      ],
      capabilityProfile: {
        profileVersion: 1,
        packageId: "pkg_role_123",
        packageVersion: "1.0.0",
        overallScore: 88,
        evaluatorAdapters: {
          agentevals: "planned",
          mem0: "planned",
        },
      },
      audit: {
        feedbackPackets: [
          {
            packetVersion: 1,
            packetId: "packet_123",
          },
        ],
        capabilityProfile: {
          profileVersion: 1,
          packageId: "pkg_role_123",
        },
      },
    });
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("schedulerContext");
    expect(bodyText).not.toContain("payload");
    expect(bodyText).not.toContain("exec_123");
    expect(bodyText).not.toContain("ent_123");
    expect(bodyText).not.toContain("device_123");
    expect(bodyText).not.toContain("workspace_123");
    expect(bodyText).not.toContain("gateway_123");
  });

  it("rejects reads for a different actor", async () => {
    const storageRecord = createDijieAuditStorageRecord(record);
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        return storageRecord;
      },
    };

    const res = response();
    await GET(request(store, { executionId: "exec_123" }, "cus_other") as never, res as never);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "Dijie execution audit record is not available to this actor.",
    });
  });

  it("allows scoped role staff to read assigned role execution data", async () => {
    const storageRecord = createDijieAuditStorageRecord(record);
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        return storageRecord;
      },
    };

    const res = response();
    await GET(
      request(store, { executionId: "exec_123" }, {
        actor_id: "member_role_staff",
        actor_type: "member",
        metadata: {
          accountLevel: "operator",
          localSystemAccess: true,
          dataScopes: ["role:role_123"],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roleListingId: "role_123",
    });
  });

  it("redacts local paths, provider auth, model keys, and raw tokens from the read response", async () => {
    const storageRecord = createDijieAuditStorageRecord(record);
    storageRecord.workspace_ref = "/Users/alice/private-workspace";
    storageRecord.changed_files = [
      "/Users/alice/private-workspace/role.ts",
      "file:///Users/alice/private-workspace/report.json",
    ];
    storageRecord.artifacts = [
      {
        id: "artifact_123",
        type: "role_package",
        title: "/Users/alice/private-workspace/output.zip",
        sizeBytes: 2048,
      },
    ];
    storageRecord.error_summary =
      "provider_auth=cloud-secret api_key=sk-local-secret Authorization: Bearer cloud-bearer failed at /Users/alice/private-workspace/role.ts token eyJhbGciOiJFZERTQSJ9.eyJleHAiOjE4MDB9.signature";
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        return storageRecord;
      },
    };

    const res = response();
    await GET(request(store) as never, res as never);

    const bodyText = JSON.stringify(res.body);
    expect(res.statusCode).toBe(200);
    expect(bodyText).not.toContain("/Users/alice");
    expect(bodyText).not.toContain("file:///Users/alice");
    expect(bodyText).not.toContain("cloud-secret");
    expect(bodyText).not.toContain("sk-local-secret");
    expect(bodyText).not.toContain("eyJhbGciOiJFZERTQSJ9");
    expect(res.body).toMatchObject({
      changedFiles: ["role.ts", "report.json"],
      artifacts: [
        {
          title: "[redacted-local-path]",
        },
      ],
      errorSummary:
        "provider_auth=[redacted-secret] api_key=[redacted-secret] Authorization: Bearer [redacted-secret] failed at [redacted-local-path] token [redacted-token]",
    });
  });

  it("returns 404 when the execution audit record is missing", async () => {
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        return undefined;
      },
    };

    const res = response();
    await GET(request(store) as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      ok: false,
    });
  });

  it("fails closed when no audit read source is configured", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      error: "Dijie audit record store is not configured.",
    });
  });

  it("returns an internal read error when the audit store throws", async () => {
    const store = {
      async retrieveDijieAuditRecordByExecutionId() {
        throw new Error("database unavailable");
      },
    };

    const res = response();
    await GET(request(store) as never, res as never);

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      ok: false,
    });
  });

  it("can read the audit record through query graph when the module service is absent", async () => {
    const storageRecord = {
      ...createDijieAuditStorageRecord(record),
      id: "djaudit_123",
    };
    const res = response();
    await GET(queryRequest([storageRecord]) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      auditRecordId: "djaudit_123",
      packageId: "pkg_role_123",
      packageVersion: "1.0.0",
      billingBeneficiaryRef: "dev_001",
      changedFiles: ["private.ts", "role_package/manifest.json"],
      execution: {
        roleListingId: "role_123",
        packageId: "pkg_role_123",
      },
      ledger: {
        source: "role_usage",
      },
    });
    expect(res.body).not.toHaveProperty("executionId");
    expect(res.body).not.toHaveProperty("actorId");
    expect(res.body).not.toHaveProperty("entitlementId");
    expect(res.body).not.toHaveProperty("deviceId");
    expect(res.body).not.toHaveProperty("workspaceRef");
    expect(res.body).not.toHaveProperty("localGatewayId");
  });
});
