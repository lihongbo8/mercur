import { describe, expect, it } from "bun:test";
import { PATCH } from "./route";
import type { DijieRoleListingStore } from "../../../../../lib/dijie/role-listing-store";

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
  body: unknown;
  actorId?: string;
  sellerId?: string;
  service?: DijieRoleListingStore;
}) {
  return {
    params: {
      roleListingId: "djrole_123",
    },
    body: input.body,
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

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

const usageInstructions =
  "使用者需要提供商品图、目标平台、品牌卖点和人工确认标准后再发起任务。";

describe("PATCH /vendor/dijie/role-listings/:roleListingId", () => {
  it("updates a developer-owned role listing draft", async () => {
    const res = response();

    await PATCH(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        body: {
          title: "商品图检查岗位 v2",
          usageInstructions,
          confirmationPoints: 2,
        },
        service: {
          async createDijieRoleListing() {
            throw new Error("not used");
          },
          async updateDijieRoleListingDraft(input) {
            expect(input).toMatchObject({
              roleListingId: "djrole_123",
              ownerId: "member_123",
              sellerId: "sel_001",
              title: "商品图检查岗位 v2",
              confirmationPoints: 2,
            });
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: {
                  id: "djrole_123",
                  package_id: "pkg_product_image_qc",
                  package_version: "0.1.0",
                  owner_id: "member_123",
                  developer_ref: "sel_001",
                  listing_owner_ref: "sel_001",
                  billing_beneficiary_ref: "sel_001",
                  title: "商品图检查岗位 v2",
                  subtitle: null,
                  description: null,
                  usage_instructions: usageInstructions,
                  category: null,
                  listing_status: "draft",
                  review_state: "draft",
                  capabilities: [],
                  manifest_summary: {},
                  pricing: {
                    kind: "one_time_authorization",
                    authorizationFeeCents: 0,
                    currency: "CNY",
                    platformFeeBps: 0,
                    developerReceivableCents: 0,
                  },
                  role_token_pricing: roleTokenPricing,
                  scopes: ["role.execute", "audit.write"],
                  confirmation_points: 2,
                  submitted_at: null,
                  published_at: null,
                },
              },
            };
          },
          async submitDijieRoleListingForReview() {
            throw new Error("not used");
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      listing: {
        title: "商品图检查岗位 v2",
      },
    });
  });

  it("keeps business errors as their original status", async () => {
    const res = response();

    await PATCH(
      request({
        actorId: "member_other",
        sellerId: "sel_002",
        body: {
          title: "非法更新",
        },
        service: {
          async createDijieRoleListing() {
            throw new Error("not used");
          },
          async updateDijieRoleListingDraft() {
            return {
              ok: false,
              status: 403,
              error: "当前账号无权操作该岗位商品。",
            };
          },
          async submitDijieRoleListingForReview() {
            throw new Error("not used");
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号无权操作该岗位商品。",
    });
  });
});
