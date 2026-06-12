import { describe, expect, it } from "bun:test";
import { POST } from "./route";
import type { DijieRoleListingStore } from "../../../../../../lib/dijie/role-listing-store";
import {
  testDijieRoleListingStorageRecord,
  testDijieRoleListingStore,
} from "../../../../../../lib/dijie/test-fixtures.test";

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

describe("POST /vendor/dijie/role-listings/:roleListingId/submit-review", () => {
  it("submits a draft role listing for admin review", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        service: testDijieRoleListingStore({
          async submitDijieRoleListingForReview(input) {
            expect(input).toEqual({
              roleListingId: "djrole_123",
              ownerId: "member_123",
              sellerId: "sel_001",
              categoryRegistry: { categories: [] },
            });
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: testDijieRoleListingStorageRecord({
                  listing_status: "proposed",
                  review_state: "submitted",
                  submitted_at: new Date("2026-06-04T10:00:00.000Z"),
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
        listing_status: "proposed",
        review_state: "submitted",
      },
    });
  });
});
