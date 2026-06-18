import { describe, expect, it } from "bun:test";
import {
  testDijieRoleListingStorageRecord,
  testDijieRoleListingStore,
} from "../../../../../../lib/dijie/test-fixtures.test";
import type { DijieRoleListingStore } from "../../../../../../lib/dijie/role-listing-store";
import { POST } from "./route";

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
  actorId?: string;
  sellerId?: string;
  roleListingId?: string;
  service?: DijieRoleListingStore;
}) {
  return {
    params: {
      roleListingId: input.roleListingId ?? "djrole_123",
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

describe("POST /vendor/dijie/role-listings/:roleListingId/delist", () => {
  it("delists a developer-owned role listing without changing review approval", async () => {
    const calls: unknown[] = [];
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        service: testDijieRoleListingStore({
          async delistDijieRoleListing(input) {
            calls.push(input);
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: testDijieRoleListingStorageRecord({
                  listing_status: "delisted",
                  review_state: "approved",
                  published_at: new Date("2026-06-11T09:00:00.000Z"),
                }),
              },
            };
          },
        }),
      }) as never,
      res as never,
    );

    expect(calls[0]).toEqual({
      roleListingId: "djrole_123",
      ownerId: "member_123",
      sellerId: "sel_001",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roleListingId: "djrole_123",
      listing: {
        listing_status: "delisted",
        review_state: "approved",
      },
    });
  });

  it("keeps business errors as their original status", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_other",
        sellerId: "sel_002",
        service: testDijieRoleListingStore({
          async delistDijieRoleListing() {
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

  it("requires a developer session and seller context", async () => {
    const res = response();

    await POST(
      request({
        service: testDijieRoleListingStore(),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
  });
});
