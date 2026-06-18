import { describe, expect, it } from "bun:test";
import {
  DIJIE_AUDIT_MODULE,
  recordDijieAuditSummaryWithRepository,
} from "../../../lib/dijie/audit-store";
import { POST } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

const pricing = {
  kind: "one_time_authorization" as const,
  authorizationFeeCents: 9900,
  currency: "CNY",
  platformFeeBps: 0,
  developerReceivableCents: 9900,
};

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000 as const,
  platformFeeBps: 0 as const,
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

function entitlement(overrides: Record<string, unknown> = {}) {
  return {
    id: "ent_123",
    actor_id: "cus_123",
    role_listing_id: "role_123",
    package_id: "pkg_role_123",
    package_version: "1.0.0",
    developer_ref: "dev_001",
    listing_owner_ref: "seller_001",
    billing_beneficiary_ref: "dev_001",
    entitlement_status: "authorized",
    source: "zero_price",
    order_id: null,
    pricing,
    role_token_pricing: roleTokenPricing,
    authorized_at: new Date("2026-06-07T08:00:00.000Z"),
    ...overrides,
  };
}

function request(body: Record<string, unknown>, store?: unknown, actorId: string | null = "cus_123") {
  return {
    body,
    ...(actorId
      ? {
          auth_context: {
            actor_id: actorId,
          },
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

function executionStore(entitlements = [entitlement()]) {
  let persisted:
    | {
        execution_id?: string;
        actor_id?: string;
        role_listing_id?: string;
        status?: string;
        artifacts?: unknown[];
        error_summary?: string | null;
        role_usage_ledger?: unknown;
      }
    | undefined;
  let ledgerEntry:
    | {
        source?: string;
        surface?: string | null;
        executionId?: string | null;
        roleListingId?: string | null;
        developerReceivableCents?: number;
      }
    | undefined;

  return {
    get persisted() {
      return persisted;
    },
    get ledgerEntry() {
      return ledgerEntry;
    },
    async listDijieRoleEntitlements(filters: Record<string, unknown>) {
      return entitlements.filter((item) =>
        Object.entries(filters).every(([key, value]) => item[key as keyof typeof item] === value),
      );
    },
    async retrieveDijieRolePackage(input: { packageId: string; packageVersion?: string }) {
      if (input.packageId !== "pkg_role_123" || input.packageVersion !== "1.0.0") {
        return undefined;
      }
      return {
        package_id: "pkg_role_123",
        package_version: "1.0.0",
        owner_id: "dev_001",
        uploaded_at: new Date("2026-06-07T07:00:00.000Z"),
        manifest_summary: {
          entrypoint: "role_package/manifest.json",
          manifestRef: "role_package/manifest.json",
          requiredCapabilities: ["workspace.read", "image.inspect"],
          inputs: ["商品图", "文字需求"],
          outputs: ["主图方案", "巡检报告"],
        },
        file_manifest: [
          { path: "role_package/manifest.json" },
          { path: "role_package/README.md" },
          { path: "role_package/listing.md" },
          { path: "role_package/standards.md" },
          { path: "role_package/cadence.md" },
          { path: "role_package/validation.md" },
        ],
        package_files: [],
        validation_issues: [],
      };
    },
    async recordDijieAuditSummary(record: never) {
      return recordDijieAuditSummaryWithRepository(
        {
          async createDijieAuditRecords(data) {
            persisted = data;
            return { ...data, id: "djaudit_123" };
          },
        },
        record,
      );
    },
    async createDijieLedgerEntry(input: never) {
      ledgerEntry = input;
      return {
        ok: true,
        value: {
          ledgerEntry: {
            id: "djledger_123",
          },
        },
      };
    },
  };
}

describe("POST /dijie/executions", () => {
  it("requires an authenticated customer actor", async () => {
    const res = response();
    await POST(
      request({ roleListingId: "role_123", confirmCost: true }, undefined, null) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "云端使用者中心执行岗位需要先登录迭界AI账号。",
    });
  });

  it("requires a role listing id and cost confirmation before execution", async () => {
    const res = response();
    await POST(request({ confirmCost: true }, executionStore()) as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "云端执行岗位需要 roleListingId。",
    });

    const costRes = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          taskText: "我需要做智能门锁主图",
          confirmHumanCheckpoints: true,
        },
        executionStore(),
      ) as never,
      costRes as never,
    );

    expect(costRes.statusCode).toBe(409);
    expect(costRes.body).toMatchObject({
      ok: false,
      error: "请先确认岗位执行费用规则。",
    });

    const humanRes = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          taskText: "我需要做智能门锁主图",
          confirmCost: true,
        },
        executionStore(),
      ) as never,
      humanRes as never,
    );

    expect(humanRes.statusCode).toBe(409);
    expect(humanRes.body).toMatchObject({
      ok: false,
      error: "请先确认岗位人工确认点。",
    });
  });

  it("rejects unentitled role executions", async () => {
    const res = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          taskText: "我需要做智能门锁主图",
          confirmCost: true,
          confirmHumanCheckpoints: true,
        },
        executionStore([]),
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有该岗位的有效授权，不能执行。",
    });
  });

  it("records a completed cloud user-center execution with artifact, audit, and role usage ledger", async () => {
    const store = executionStore();
    const res = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          entitlementId: "ent_123",
          taskText: "我需要做一张智能门锁的主图，突出安全和远程开锁。",
          confirmCost: true,
          confirmHumanCheckpoints: true,
        },
        store,
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      executionId: expect.any(String),
      auditRecordId: "djaudit_123",
      packageContextDigest: expect.stringMatching(/^pkgctx_[0-9a-f]{16}$/),
      status: "completed",
      failureReason: null,
      artifacts: [
        {
          type: "design_plan_text",
          title: "智能门锁主图设计方案",
        },
      ],
      execution: {
        roleListingId: "role_123",
        packageId: "pkg_role_123",
        packageVersion: "1.0.0",
        status: "completed",
      },
      audit: {
        status: "completed",
        errorSummary: null,
      },
      ledger: {
        source: "role_usage",
        roleListingId: "role_123",
        platformReceivableCents: 0,
      },
    });
    expect(store.persisted).toMatchObject({
      actor_id: "cus_123",
      role_listing_id: "role_123",
      status: "completed",
      role_usage_ledger: {
        source: "role_usage",
      },
    });
    expect(store.persisted?.artifacts).toHaveLength(1);
    expect(store.ledgerEntry).toMatchObject({
      source: "role_usage",
      surface: "user_center",
      executionId: expect.any(String),
      roleListingId: "role_123",
    });
  });

  it("fails before execution when the authorized role package context is missing", async () => {
    const store = {
      ...executionStore(),
      async retrieveDijieRolePackage() {
        return undefined;
      },
    };
    const res = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          entitlementId: "ent_123",
          taskText: "我需要做智能门锁主图",
          confirmCost: true,
          confirmHumanCheckpoints: true,
        },
        store,
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      code: "package_context_missing",
      error: "该授权岗位缺少可执行的岗位包上下文，不能发起正式执行。",
    });
    expect(store.persisted).toBeUndefined();
    expect(store.ledgerEntry).toBeUndefined();
  });

  it("records missing input as failed/input_required without a fake artifact or ledger", async () => {
    const store = executionStore();
    const res = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          entitlementId: "ent_123",
          confirmCost: true,
          confirmHumanCheckpoints: true,
        },
        store,
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: "failed",
      failureReason: "failed/input_required",
      artifacts: [],
      ledger: null,
    });
    expect(store.persisted).toMatchObject({
      status: "failed",
      error_summary: "failed/input_required",
      role_usage_ledger: null,
    });
    expect(store.ledgerEntry).toBeUndefined();
  });

  it("records explicit image generation requests as failed/capability_missing when cloud image generation is disabled", async () => {
    const store = executionStore();
    const res = response();
    await POST(
      request(
        {
          roleListingId: "role_123",
          entitlementId: "ent_123",
          taskText: "请直接出图，生成主图图片文件。",
          confirmCost: true,
          confirmHumanCheckpoints: true,
        },
        store,
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: "failed",
      failureReason: "failed/capability_missing",
      artifacts: [],
      ledger: null,
    });
    expect(store.persisted).toMatchObject({
      status: "failed",
      error_summary: "failed/capability_missing",
    });
  });
});
