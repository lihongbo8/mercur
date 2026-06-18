import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
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

function roleRecord() {
  return {
    id: "djrole_image_review",
    package_id: "djpkg_image_review",
    package_version: "1.0.0",
    developer_ref: "acct_dev",
    title: "商品图检查岗位",
    subtitle: "检查商品图是否清晰、合规、适合上架。",
    description: "适合商品图、美工初审和图片质量检查。",
    listing_status: "published",
    review_state: "approved",
    category: "图片审核",
    category_ref: "category:image_review@1",
    capabilities: ["视觉检查", "商品图检查"],
    manifest_summary: {
      entrypoint: "role_package/manifest.json",
      manifestRef: "role_package/manifest.json",
      requiredCapabilities: ["workspace.read"],
      inputs: ["商品图", "目标平台"],
      outputs: ["巡检报告"],
    },
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 0,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 0,
    },
    role_token_pricing: {
      inputTokenCentsPerMillion: 100,
      outputTokenCentsPerMillion: 200,
      currency: "CNY",
      developerReceivableBps: 7000,
      platformFeeBps: 3000,
    },
    scopes: ["role.execute", "audit.write"],
  };
}

function request(authContext: Record<string, unknown>) {
  return {
    auth_context: authContext,
    query: {
      workspaceRef: "workspace_main",
    },
    scope: {
      resolve(name: string) {
        if (name === "query") {
          return {
            graph: async (queryInput: { entity: string }) => {
              if (queryInput.entity === "dijie_role_listing") {
                return { data: [roleRecord()] };
              }
              return { data: [] };
            },
          };
        }
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            retrieveDijieRolePackage: async () => ({
              package_id: "djpkg_image_review",
              package_version: "1.0.0",
              owner_id: "acct_dev",
              uploaded_at: new Date("2026-06-05T00:00:00.000Z"),
              manifest_summary: {
                entrypoint: "role_package/manifest.json",
                manifestRef: "role_package/manifest.json",
                requiredCapabilities: ["workspace.read", "image.inspect"],
                inputs: ["商品图", "目标平台"],
                outputs: ["主图巡检报告", "详情页优化清单"],
              },
              file_manifest: [
                { path: "role_package/manifest.json" },
                { path: "role_package/README.md" },
                { path: "role_package/listing.md" },
                { path: "role_package/standards.md" },
                { path: "role_package/cadence.md" },
                { path: "role_package/validation.md" },
              ],
              package_files: [],
              validation_issues: [],
            }),
            listDijieRoleEntitlements: async () => [
              {
                id: "djent_image_review",
                actor_id: "local_operator",
                role_listing_id: "djrole_image_review",
                package_id: "djpkg_image_review",
                package_version: "1.0.0",
                developer_ref: "acct_dev",
                listing_owner_ref: "acct_dev",
                billing_beneficiary_ref: "acct_dev",
                entitlement_status: "authorized",
                source: "zero_price",
                order_id: null,
                pricing: roleRecord().pricing,
                role_token_pricing: roleRecord().role_token_pricing,
                authorized_at: new Date("2026-06-05T01:00:00.000Z"),
              },
            ],
            listDijieRoleCategories: async () => [
              {
                category_ref: "category:image_review@1",
                name: "图片审核",
                version: "1",
                description: "测试用图片审核品类。",
                category_status: "approved",
                pack_binding: {
                  categoryPackRef: "categorypack:image_review@1",
                  skillPackRef: "skillpack:image_review@1",
                  toolPackRef: "toolpack:image_review@1",
                  capabilityRefs: ["workspace.read", "image.inspect", "audit.record"],
                  catalogRefs: ["skillpack:image_review@1", "toolpack:image_review@1"],
                  permissionSummary: ["workspace.read", "image.inspect", "audit.record"],
                },
              },
            ],
          };
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("GET /dijie/gateway/roles/read-model", () => {
  it("returns a dispatcher-facing callable role view for local system accounts", async () => {
    const res = response();

    await GET(
      request({
        actor_id: "local_operator",
        actor_type: "member",
        metadata: {
          accountLevel: "operator",
          localSystemAccess: true,
          billingAccountId: "company_001",
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      readModel: {
        actorId: "local_operator",
        billingAccountId: "company_001",
        workspaceRef: "workspace_main",
        roles: [
          {
            roleListingId: "djrole_image_review",
            title: "商品图检查岗位",
            callable: true,
            unavailableReasons: [],
            entitlement: {
              id: "djent_image_review",
              status: "authorized",
            },
            billingPolicySnapshot: {
              inputTokenCentsPerMillion: 100,
              outputTokenCentsPerMillion: 200,
              developerReceivableBps: 7000,
              platformFeeBps: 3000,
            },
            packageContext: {
              source: "package_record",
              manifest: {
                entrypoint: "role_package/manifest.json",
                manifestRef: "role_package/manifest.json",
                inputs: ["商品图", "目标平台"],
                outputs: ["主图巡检报告", "详情页优化清单"],
              },
              requiredCapabilities: ["workspace.read", "image.inspect"],
              catalogRefs: expect.arrayContaining([
                "capability:workspace.read",
                "capability:image.inspect",
              ]),
              skills: [],
              templates: [],
              validation: ["role_package/validation.md"],
              readme: ["role_package/README.md"],
              listing: ["role_package/listing.md"],
              files: [
                "role_package/manifest.json",
                "role_package/README.md",
                "role_package/listing.md",
                "role_package/standards.md",
                "role_package/cadence.md",
                "role_package/validation.md",
              ],
              validationIssues: [],
              digest: expect.stringMatching(/^pkgctx_[0-9a-f]{8}$/),
            },
            catalogRefs: expect.arrayContaining([
              "capability:workspace.read",
              "capability:image.inspect",
              "categorypack:image_review@1",
              "skillpack:image_review@1",
              "toolpack:image_review@1",
            ]),
          },
        ],
      },
    });
  });

  it("rejects cloud role users that do not have local main-system access", async () => {
    const res = response();

    await GET(
      request({
        actor_id: "acct_user",
        actor_type: "customer",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有本地主系统 Gateway 数据权限。",
    });
  });
});
