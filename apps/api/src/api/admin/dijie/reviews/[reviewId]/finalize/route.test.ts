import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
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

function request(
  store?: unknown,
  body: Record<string, unknown> = {},
  authContext: Record<string, unknown> = {
    actor_id: "marketplace_owner_001",
    actor_type: "marketplace_owner",
  },
) {
  return {
    auth_context: authContext,
    params: { reviewId: "review_djrole_image_review" },
    body,
    scope: {
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE) {
          return store;
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("POST /admin/dijie/reviews/:reviewId/finalize", () => {
  it("finalizes an admin review decision", async () => {
    const calls: unknown[] = [];
    const store = {
      finalizeDijieRoleReview: async (input: unknown) => {
        calls.push(input);
        return {
          ok: true,
          value: {
            reviewId: "djreview_image_review",
            roleListingId: "djrole_image_review",
            review: { id: "djreview_image_review", final_result: "approved" },
            listing: {
              id: "djrole_image_review",
              listing_status: "delisted",
              review_state: "approved",
            },
          },
        };
      },
    };

    const res = response();
    await POST(
      request(store, {
        finalResult: "approved",
        summary: "三项评估通过。",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toEqual({
      roleListingId: "djrole_image_review",
      reviewerId: "marketplace_owner_001",
      finalResult: "approved",
      summary: "三项评估通过。",
    });
    expect(res.body).toMatchObject({
      ok: true,
      listing: {
        listing_status: "delisted",
        review_state: "approved",
      },
    });
  });

  it("rejects an unsupported final result", async () => {
    const res = response();
    await POST(
      request({ finalizeDijieRoleReview: async () => undefined }, { finalResult: "pending" }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
  });

  it("rejects accounts without review data permission", async () => {
    const res = response();
    await POST(
      request(
        { finalizeDijieRoleReview: async () => undefined },
        { finalResult: "approved" },
        { actor_id: "member_001", actor_type: "member" },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有该岗位审核数据权限。",
    });
  });
});
