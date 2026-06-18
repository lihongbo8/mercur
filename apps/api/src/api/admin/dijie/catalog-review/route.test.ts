import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { GET } from "./route";

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
  authContext?: Record<string, unknown>,
  query: Record<string, unknown> = { status: "pending_review" },
) {
  return {
    auth_context:
      authContext ?? {
        actor_id: "marketplace_owner_001",
        actor_type: "marketplace_owner",
      },
    query,
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

describe("GET /admin/dijie/catalog-review", () => {
  it("returns catalog items and pending Skill/Tool review requests", async () => {
    const store = {
      listDijieEffectiveCatalogItems: async () => [
        { id: "tool.platform.image_inspector", status: "approved" },
      ],
      listDijieCatalogReviewRequests: async (input: unknown) => [
        {
          id: "djcat_review_001",
          review_key: "skill-short-video-review",
          catalog_ref: null,
          need: "短视频质检",
          kind: "skill",
          source: "role_gap",
          review_status: "pending_review",
          role_package_id: "djpkg_video",
          role_listing_id: null,
          requested_by: "dev_001",
          submitted_at: new Date("2026-06-10T00:00:00.000Z"),
          reviewed_at: null,
          reviewed_by: null,
          review_note: null,
          candidate: {},
          risk_summary: {},
          payload: {},
          input,
        },
      ],
    };
    const res = response();

    await GET(request(store) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      catalogItems: [{ id: "tool.platform.image_inspector", status: "approved" }],
      reviewRequests: [
        {
          id: "djcat_review_001",
          reviewId: "djcat_review_001",
          reviewKey: "skill-short-video-review",
          need: "短视频质检",
          kind: "skill",
          source: "role_gap",
          status: "pending_review",
          rolePackageId: "djpkg_video",
          input: { status: "pending_review" },
        },
      ],
    });
  });

  it("passes non-pending status filters to the catalog review store", async () => {
    const calls: unknown[] = [];
    const store = {
      listDijieEffectiveCatalogItems: async () => [],
      listDijieCatalogReviewRequests: async (input: unknown) => {
        calls.push(input);
        return [];
      },
    };
    const res = response();

    await GET(request(store, undefined, { status: "approved" }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([{ status: "approved" }]);
  });

  it("rejects accounts without review permission", async () => {
    const res = response();

    await GET(
      request(
        {
          listDijieEffectiveCatalogItems: async () => [],
          listDijieCatalogReviewRequests: async () => [],
        },
        { actor_id: "member_001", actor_type: "member" },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
  });
});
