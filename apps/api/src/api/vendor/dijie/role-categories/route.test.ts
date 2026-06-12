import { describe, expect, it } from "bun:test";
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

function request(input: { actorId?: string; sellerId?: string; service?: unknown }) {
  return {
    auth_context: input.actorId
      ? {
          actor_id: input.actorId,
          actor_type: "member",
        }
      : undefined,
    seller_context: input.sellerId
      ? {
          seller_id: input.sellerId,
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

describe("GET /vendor/dijie/role-categories", () => {
  it("requires a developer session and seller context", async () => {
    const res = response();
    await GET(request({ service: {} }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
    });
  });

  it("returns only approved role categories", async () => {
    const res = response();
    await GET(
      request({
        actorId: "member_001",
        sellerId: "sel_001",
        service: {
          async listDijieRoleCategoryRecords() {
            return [
              {
                category_ref: "category:ecommerce_art_designer@1",
                name: "电商美工",
                version: "1",
                description: "电商美工品类。",
                category_status: "approved",
                pack_binding: {
                  categoryPackRef: "categorypack:ecommerce_art_designer@1",
                  skillPackRef: "skillpack:ecommerce_art_designer@1",
                  toolPackRef: "toolpack:ecommerce_art_designer@1",
                  catalogRefs: ["tool.platform.audit-record"],
                  capabilityRefs: ["audit.record"],
                  permissionSummary: ["audit.record"],
                },
              },
              {
                category_ref: "category:draft@1",
                name: "草稿品类",
                version: "1",
                description: "未启用。",
                category_status: "draft",
                pack_binding: {},
              },
            ];
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      categories: [
        {
          categoryRef: "category:ecommerce_art_designer@1",
          name: "电商美工",
          packBinding: {
            inheritedCapabilityRefCount: 1,
          },
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("category:draft@1");
  });
});
