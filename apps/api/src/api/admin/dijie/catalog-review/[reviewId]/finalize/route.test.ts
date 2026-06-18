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
  store: unknown,
  body: Record<string, unknown> = {},
  authContext: Record<string, unknown> = {
    actor_id: "marketplace_owner_001",
    actor_type: "marketplace_owner",
  },
) {
  return {
    auth_context: authContext,
    params: { reviewId: "djcat_review_001" },
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

describe("POST /admin/dijie/catalog-review/:reviewId/finalize", () => {
  it("finalizes a Skill/Tool catalog review decision", async () => {
    const calls: unknown[] = [];
    const store = {
      finalizeDijieCatalogReviewRequest: async (input: unknown) => {
        calls.push(input);
        return { ok: true };
      },
    };
    const res = response();

    await POST(
      request(store, {
        result: "approved",
        reviewNote: "可先进入平台目录。",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toEqual({
      reviewId: "djcat_review_001",
      result: "approved",
      reviewedBy: "marketplace_owner_001",
      reviewNote: "可先进入平台目录。",
    });
    expect(res.body).toEqual({
      ok: true,
      reviewId: "djcat_review_001",
      result: "approved",
    });
  });

  it("rejects unsupported review results", async () => {
    const res = response();

    await POST(
      request({ finalizeDijieCatalogReviewRequest: async () => ({ ok: true }) }, {
        result: "pending",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
  });

  it("rejects accounts without review permission", async () => {
    const res = response();

    await POST(
      request(
        { finalizeDijieCatalogReviewRequest: async () => ({ ok: true }) },
        { result: "approved" },
        { actor_id: "member_001", actor_type: "member" },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
  });
});
