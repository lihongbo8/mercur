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

describe("POST /admin/dijie/reviews/:reviewId/evaluations", () => {
  it("saves the three admin evaluation decisions", async () => {
    const calls: unknown[] = [];
    const store = {
      saveDijieRoleReviewEvaluations: async (input: unknown) => {
        calls.push(input);
        return {
          ok: true,
          value: {
            reviewId: "djreview_image_review",
            roleListingId: "djrole_image_review",
            review: { id: "djreview_image_review" },
            listing: { id: "djrole_image_review" },
          },
        };
      },
    };

    const res = response();
    await POST(
      request(store, {
        roleStandardDecision: "pass",
        safetyComplianceDecision: "needs_changes",
        pricingReasonabilityDecision: "pass",
        summary: "需要补充样例。",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toEqual({
      roleListingId: "djrole_image_review",
      reviewerId: "marketplace_owner_001",
      roleStandardDecision: "pass",
      safetyComplianceDecision: "needs_changes",
      pricingReasonabilityDecision: "pass",
      summary: "需要补充样例。",
    });
    expect(res.body).toMatchObject({
      ok: true,
      roleListingId: "djrole_image_review",
    });
  });

  it("requires an admin actor", async () => {
    const req = request({ saveDijieRoleReviewEvaluations: async () => undefined });
    delete (req as { auth_context?: unknown }).auth_context;

    const res = response();
    await POST(req as never, res as never);

    expect(res.statusCode).toBe(401);
  });

  it("rejects accounts without review data permission", async () => {
    const res = response();
    await POST(
      request(
        { saveDijieRoleReviewEvaluations: async () => undefined },
        { roleStandardDecision: "pass" },
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
