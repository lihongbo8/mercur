import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
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

function categoryRecord(status = "approved") {
  return {
    category_ref: "category:ecommerce_art_designer@1",
    name: "电商美工",
    version: "1",
    description: "电商视觉岗位品类。",
    category_status: status,
    pack_binding: {
      categoryPackRef: "categorypack:ecommerce_art_designer@1",
      skillPackRef: "skillpack:ecommerce_art_designer@1",
      toolPackRef: "toolpack:ecommerce_art_designer@1",
      catalogRefs: ["skill:visual.main_image.inspect@1"],
      capabilityRefs: ["image.inspect", "audit.record"],
      permissionSummary: ["image.inspect", "audit.record"],
    },
  };
}

function request(input: {
  actorId?: string | null;
  sellerId?: string | null;
  body?: Record<string, unknown>;
  service?: unknown;
}) {
  return {
    auth_context:
      input.actorId === null
        ? undefined
        : {
            actor_id: input.actorId ?? "acct_dev",
            actor_type: "member",
          },
    seller_context:
      input.sellerId === null
        ? undefined
        : {
            seller_id: input.sellerId ?? "sel_001",
          },
    body: {
      need: "智能门锁三维渲染质检",
      kind: "capability",
      reason: "基础品类包不含三维渲染质检。",
      categoryRef: "category:ecommerce_art_designer@1",
      rolePackageId: "djpkg_smart_lock_designer",
      ...(input.body ?? {}),
    },
    scope: {
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE && input.service) {
          return input.service;
        }
        throw new Error("service unavailable");
      },
    },
  };
}

describe("POST /vendor/dijie/special-capability-requests", () => {
  it("requires a developer session and seller context", async () => {
    const res = response();

    await POST(
      request({
        actorId: null,
        service: {},
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rejects requests without an approved base category pack", async () => {
    const res = response();

    await POST(
      request({
        service: {
          listDijieRoleCategoryRecords: async () => [categoryRecord("draft")],
          createDijieSpecialCapabilityReviewRequest: async () => {
            throw new Error("should not be called");
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      issues: ["category:ecommerce_art_designer@1: draft"],
    });
  });

  it("creates an independent special capability pack review request", async () => {
    const calls: unknown[] = [];
    const res = response();

    await POST(
      request({
        service: {
          listDijieRoleCategoryRecords: async () => [categoryRecord()],
          createDijieSpecialCapabilityReviewRequest: async (input: unknown) => {
            calls.push(input);
            return {
              reviewId: "djcat_review_001",
              reviewKey: "special-capability-capability-smart-lock-3d",
              catalogRef: null,
              need: "智能门锁三维渲染质检",
              kind: "capability",
              source: "internal_build",
              status: "pending_review",
              rolePackageId: "djpkg_smart_lock_designer",
              roleListingId: null,
              requestedBy: "acct_dev",
              submittedAt: "2026-06-12T00:00:00.000Z",
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
              candidate: {},
              riskSummary: {},
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toMatchObject({
      need: "智能门锁三维渲染质检",
      kind: "capability",
      reason: "基础品类包不含三维渲染质检。",
      categoryRef: "category:ecommerce_art_designer@1",
      rolePackageId: "djpkg_smart_lock_designer",
      requestedBy: "acct_dev",
      riskSummary: {
        requestedFrom: "developer_center",
        sellerId: "sel_001",
        requiresPlatformBuild: true,
      },
    });
    expect(res.body).toMatchObject({
      ok: true,
      request: {
        reviewId: "djcat_review_001",
        status: "pending_review",
      },
    });
  });
});
