import { describe, expect, it } from "bun:test";
import { POST } from "./route";
import type { DijieRoleListingStore } from "../../../../../../lib/dijie/role-listing-store";

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

function request(input: { actorId?: string; sellerId?: string; service?: DijieRoleListingStore }) {
  return {
    params: {
      roleListingId: "djrole_123",
    },
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

describe("POST /vendor/dijie/role-listings/:roleListingId/submit-review", () => {
  it("submits a draft role listing for admin review", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        service: {
          async createDijieRoleListing() {
            throw new Error("not used");
          },
          async updateDijieRoleListingDraft() {
            throw new Error("not used");
          },
          async submitDijieRoleListingForReview(input) {
            expect(input).toEqual({
              roleListingId: "djrole_123",
              ownerId: "member_123",
              sellerId: "sel_001",
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
                  title: "商品图检查岗位",
                  subtitle: null,
                  description: null,
                  category: null,
                  listing_status: "proposed",
                  review_state: "submitted",
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
                  confirmation_points: 0,
                  submitted_at: new Date("2026-06-04T10:00:00.000Z"),
                  published_at: null,
                },
              },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      listing: {
        listing_status: "proposed",
        review_state: "submitted",
      },
    });
  });
});
