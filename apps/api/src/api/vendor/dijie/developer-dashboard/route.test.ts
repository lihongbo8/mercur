import { describe, expect, it } from "bun:test";
import { GET } from "./route";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";

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

function manifestSummary() {
  return {
    entrypoint: "role_package/README.md",
    manifestRef: "role_package/manifest.json",
    name: "智能门锁电商美工岗位",
    permissions: ["workspace.read"],
    requiredCapabilities: ["workspace.read", "image.inspect", "document.write"],
    fileCount: 3,
  };
}

function storedListing() {
  return {
    id: "djrole_lock_designer",
    package_id: "pkg_lock_designer",
    package_version: "0.1.0",
    owner_id: "member_123",
    developer_ref: "sel_001",
    listing_owner_ref: "sel_001",
    billing_beneficiary_ref: "sel_001",
    title: "智能门锁电商美工岗位",
    subtitle: "主图巡检与方案输出",
    description: "为智能门锁商品图输出主图方案、巡检报告和优化清单。",
    category: "电商美工",
    listing_status: "proposed" as const,
    review_state: "submitted" as const,
    capabilities: ["workspace.read", "image.inspect", "document.write"],
    manifest_summary: manifestSummary(),
    pricing: {
      kind: "one_time_authorization" as const,
      authorizationFeeCents: 39900,
      currency: "CNY" as const,
      platformFeeBps: 0,
      developerReceivableCents: 39900,
    },
    role_token_pricing: {
      inputTokenCentsPerMillion: 120,
      outputTokenCentsPerMillion: 360,
      currency: "CNY" as const,
      developerReceivableBps: 10000,
      platformFeeBps: 0,
    },
    scopes: ["role.execute", "audit.write"],
    confirmation_points: 2,
    submitted_at: new Date("2026-06-07T08:00:00.000Z"),
    published_at: null,
  };
}

function latestDraft() {
  return {
    id: "draft_001",
    owner_id: "member_123",
    draft_status: "ready" as const,
    source_message: "创建智能门锁电商美工岗位",
    package_id: "pkg_lock_designer",
    package_version: "0.1.0",
    generated_at: new Date("2026-06-07T07:00:00.000Z"),
    manifest_summary: manifestSummary(),
    file_manifest: [{ path: "role_package/manifest.json" }],
    package_files: [],
    capability_report: {
      ok: true,
      needs: [],
      available: [],
      missing: [],
      generatedCandidates: [],
      adapterNeeded: [],
      blocked: [],
    },
    quality_report: {
      ok: true,
      issues: [],
      warnings: [],
    },
    upload_validation_issues: [],
    blocking_issues: [],
    model_usage: null,
    submitted_package_id: null,
  };
}

function request(input: { actorId?: string; sellerId?: string }) {
  return {
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
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            async listDijieStoredRoleListings(listInput: unknown) {
              expect(listInput).toEqual({
                developerRef: "sel_001",
                take: 100,
              });
              return [storedListing()];
            },
            async retrieveLatestDijieRolePackageDraft(lookup: unknown) {
              expect(lookup).toEqual({ ownerId: "member_123" });
              return latestDraft();
            },
          };
        }
        if (name === "query") {
          return {
            async graph(input: { entity: string; filters?: Record<string, unknown> }) {
              if (input.entity === "dijie_audit_record") {
                expect(input.filters).toEqual({ billing_beneficiary_ref: "sel_001" });
              }
              if (input.entity === "dijie_role_listing") {
                expect(input.filters).toEqual({ billing_beneficiary_ref: "sel_001" });
              }
              if (input.entity === "dijie_role_entitlement") {
                expect(input.filters).toEqual({
                  billing_beneficiary_ref: "sel_001",
                  entitlement_status: "authorized",
                });
              }
              return { data: [] };
            },
          };
        }
        throw new Error(`Unknown dependency: ${name}`);
      },
    },
  };
}

describe("GET /vendor/dijie/developer-dashboard", () => {
  it("requires a developer account and selected seller", async () => {
    const res = response();
    await GET(request({ actorId: "member_123" }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "读取开发者中心需要登录开发者账号并选择开发者店铺。",
    });
  });

  it("returns seller-scoped developer dashboard facts", async () => {
    const res = response();
    await GET(
      request({ actorId: "member_123", sellerId: "sel_001" }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      dashboard: {
        actorId: "member_123",
        sellerId: "sel_001",
        listings: {
          total: 1,
          byListingStatus: { proposed: 1 },
          byReviewState: { submitted: 1 },
          pendingReview: 1,
          confirmationPoints: 2,
          recent: [
            {
              roleListingId: "djrole_lock_designer",
              title: "智能门锁电商美工岗位",
              reviewState: "submitted",
              allowedActions: ["download_package"],
            },
          ],
        },
        latestDraft: {
          draftId: "draft_001",
          status: "ready",
          packageId: "pkg_lock_designer",
        },
        receivables: {
          summary: {
            currency: "CNY",
            totalDeveloperReceivableCents: 0,
          },
        },
      },
    });
  });

  it("keeps the dashboard usable when the latest draft read model is unavailable", async () => {
    const res = response();
    await GET(
      {
        auth_context: {
          actor_id: "member_123",
          actor_type: "member",
        },
        seller_context: {
          seller_id: "sel_001",
        },
        scope: {
          resolve(name: string) {
            if (name === DIJIE_AUDIT_MODULE) {
              return {
                async listDijieStoredRoleListings() {
                  return [storedListing()];
                },
                async retrieveLatestDijieRolePackageDraft() {
                  throw new Error("draft store unavailable");
                },
              };
            }
            if (name === "query") {
              return {
                async graph() {
                  return { data: [] };
                },
              };
            }
            throw new Error(`Unknown dependency: ${name}`);
          },
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      dashboard: {
        latestDraft: null,
        listings: {
          total: 1,
        },
      },
    });
  });
});
