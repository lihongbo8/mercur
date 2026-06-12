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

describe("POST /vendor/dijie/role-listings/:roleListingId/publish", () => {
  it("publishes an approved developer-owned role listing", async () => {
    const calls: unknown[] = [];
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        service: testDijieRoleListingStore({
          async publishDijieRoleListing(input) {
            calls.push(input);
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: testDijieRoleListingStorageRecord({
                  listing_status: "published",
                  review_state: "approved",
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
      categoryRegistry: { categories: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roleListingId: "djrole_123",
      listing: {
        listing_status: "published",
        review_state: "approved",
      },
    });
  });

  it("keeps category pack integration conflicts as 409", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        service: testDijieRoleListingStore({
          async publishDijieRoleListing() {
            return {
              ok: false,
              status: 409,
              error:
                "岗位上架前必须绑定 approved 平台品类和基础品类包。",
            };
          },
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      error:
        "岗位上架前必须绑定 approved 平台品类和基础品类包。",
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
