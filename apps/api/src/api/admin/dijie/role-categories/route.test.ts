import { describe, expect, it } from "bun:test";
import { GET, POST } from "./route";
import { POST as POST_PACK_BINDING } from "./[categoryRef]/pack-binding/route";
import { POST as POST_FINALIZE } from "./[categoryRef]/finalize/route";

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

function request(input: {
  body?: unknown;
  params?: Record<string, string>;
  actorId?: string;
  service?: unknown;
}) {
  return {
    body: input.body ?? {},
    params: input.params ?? {},
    auth_context: input.actorId
      ? {
          actor_id: input.actorId,
          actor_type: "user",
        }
      : undefined,
    scope: {
      resolve() {
        if (!input.service) {
          throw new Error("service unavailable");
        }
        return input.service;
      },
    },
  };
}

const approvedCatalogItem = {
  id: "tool.platform.audit-record",
  kind: "tool",
  name: "审计记录",
  version: "1.0.0",
  description: "记录调用摘要。",
  tags: ["audit"],
  provides: ["audit.record"],
  source: "openclaw",
  status: "approved",
  permissions: ["audit.record"],
  riskLevel: "low",
  auditPolicy: ["audit.record"],
  keywords: ["audit.record"],
};

const categoryRecord = {
  id: "djcatg_1",
  category_ref: "category:test@1",
  name: "测试品类",
  version: "1",
  description: "测试。",
  category_status: "approved",
  pack_binding: {
    categoryPackRef: "categorypack:test@1",
    skillPackRef: "skillpack:test@1",
    toolPackRef: "toolpack:test@1",
    catalogRefs: ["tool.platform.audit-record"],
    capabilityRefs: ["audit.record"],
    permissionSummary: ["audit.record"],
  },
  risk_policy: {},
  review_policy: {},
  reviewed_at: new Date("2026-06-11T00:00:00.000Z"),
  reviewed_by: "admin_001",
};

function service(overrides: Record<string, unknown> = {}) {
  return {
    async listDijieRoleCategoryRecords() {
      return [categoryRecord];
    },
    async listDijieRoleCategories() {
      return [categoryRecord];
    },
    async listDijieEffectiveCatalogItems() {
      return [approvedCatalogItem];
    },
    async listDijieStoredRoleListings() {
      return [
        {
          id: "djrole_1",
          category_ref: "category:test@1",
          listing_status: "published",
        },
      ];
    },
    async createDijieRoleCategoryRecord(input: unknown) {
      return {
        ok: true,
        value: {
          categoryRef: "category:new@1",
          category: {
            ...categoryRecord,
            category_ref: "category:new@1",
            name: (input as { name?: string }).name ?? "新类目",
            category_status: "draft",
          },
        },
      };
    },
    async updateDijieRoleCategoryRecord() {
      return { ok: true, value: { categoryRef: "category:test@1", category: categoryRecord } };
    },
    async bindDijieRoleCategoryPack(input: unknown) {
      expect((input as { catalogItems?: unknown[] }).catalogItems).toHaveLength(1);
      return { ok: true, value: { categoryRef: "category:test@1", category: categoryRecord } };
    },
    async submitDijieRoleCategoryReview() {
      return { ok: true, value: { categoryRef: "category:test@1", category: categoryRecord } };
    },
    async finalizeDijieRoleCategoryReview(input: unknown) {
      expect(input).toMatchObject({ result: "approved", reviewedBy: "admin_001" });
      return { ok: true, value: { categoryRef: "category:test@1", category: categoryRecord } };
    },
    async disableDijieRoleCategory() {
      return { ok: true, value: { categoryRef: "category:test@1", category: categoryRecord } };
    },
    ...overrides,
  };
}

describe("admin role category routes", () => {
  it("requires a platform reviewer account", async () => {
    const res = response();
    await GET(request({ service: service() }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
    });
  });

  it("returns role categories and approved catalog refs", async () => {
    const res = response();
    await GET(
      request({
        actorId: "admin_001",
        service: service(),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roleCategories: {
        categories: [
          {
            categoryRef: "category:test@1",
            status: "approved",
            usage: {
              roleListingCount: 1,
              publishedRoleListingCount: 1,
            },
          },
        ],
        approvedCatalogItems: [
          {
            id: "tool.platform.audit-record",
          },
        ],
      },
    });
  });

  it("creates a draft category", async () => {
    const res = response();
    await POST(
      request({
        actorId: "admin_001",
        body: {
          categoryRef: "category:new@1",
          name: "新类目",
          version: "1",
        },
        service: service(),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      categoryRef: "category:new@1",
      category: {
        category_status: "draft",
      },
    });
  });

  it("binds approved catalog refs and finalizes approval", async () => {
    const packRes = response();
    await POST_PACK_BINDING(
      request({
        actorId: "admin_001",
        params: { categoryRef: encodeURIComponent("category:test@1") },
        body: {
          categoryPackRef: "categorypack:test@1",
          skillPackRef: "skillpack:test@1",
          toolPackRef: "toolpack:test@1",
          catalogRefs: ["tool.platform.audit-record"],
        },
        service: service(),
      }) as never,
      packRes as never,
    );

    const finalizeRes = response();
    await POST_FINALIZE(
      request({
        actorId: "admin_001",
        params: { categoryRef: encodeURIComponent("category:test@1") },
        body: { result: "approved" },
        service: service(),
      }) as never,
      finalizeRes as never,
    );

    expect(packRes.statusCode).toBe(200);
    expect(finalizeRes.statusCode).toBe(200);
  });
});
