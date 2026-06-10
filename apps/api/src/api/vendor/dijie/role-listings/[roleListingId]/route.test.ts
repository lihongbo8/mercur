import { describe, expect, it } from "bun:test";
import { PATCH } from "./route";
import type { DijieRoleListingStore } from "../../../../../lib/dijie/role-listing-store";
import {
  testDijieRoleListingStorageRecord,
  testDijieRoleListingStore,
  testUsageInstructions,
} from "../../../../../lib/dijie/test-fixtures.test";

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

const usageInstructions = testUsageInstructions;

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
        service: testDijieRoleListingStore({
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
                listing: testDijieRoleListingStorageRecord({
                  title: "商品图检查岗位 v2",
                  confirmation_points: 2,
                }),
              },
            };
          },
        }),
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
        service: testDijieRoleListingStore({
          async updateDijieRoleListingDraft() {
            return {
              ok: false,
              status: 403,
              error: "当前账号无权操作该岗位商品。",
            };
          },
        }),
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
