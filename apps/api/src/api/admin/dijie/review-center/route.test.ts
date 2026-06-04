import { describe, expect, it } from "bun:test";
import { GET } from "./route";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

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

function request() {
  return {
    auth_context: { actor_id: "admin_001" },
    scope: {
      resolve() {
        return {
          graph: async () => ({
            data: [
              {
                id: "prod_image_review_role",
                title: "商品图检查岗位",
                subtitle: "检查商品图是否清晰、合规、适合上架。",
                status: "proposed",
                seller: { id: "dev_001", name: "迭界开发者" },
                metadata: {
                  dijieRole: {
                    kind: "role_product",
                    protocolVersion: "2026-05",
                    packageId: "pkg_image_review_role",
                    packageVersion: "1.0.0",
                    developerRef: "dev_001",
                    listingStatus: "proposed",
                    reviewState: "submitted",
                    capabilities: ["商品图检查", "违规风险提示"],
                    manifestSummary: {
                      entrypoint: "role_package/manifest.json",
                      requiredCapabilities: ["workspace.read", "browser.use"],
                      sandbox: "workspace-write",
                    },
                    pricing: {
                      kind: "one_time_authorization",
                      authorizationFeeCents: 19900,
                      currency: "CNY",
                      platformFeeBps: 0,
                      developerReceivableCents: 19900,
                    },
                    roleTokenPricing,
                  },
                },
              },
            ],
          }),
        };
      },
    },
  };
}

describe("GET /admin/dijie/review-center", () => {
  it("returns the admin role review read model with one review dialog context", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      reviewCenter: {
        title: "审核中心",
        sampleRoleTitle: "商品图检查岗位",
        dialogContext: {
          accountId: "admin_001",
          accountType: "admin",
          surface: "admin_review",
          mode: "review",
          billingAccountId: "admin_001",
          subject: {
            roleListingId: "prod_image_review_role",
            packageId: "pkg_image_review_role",
            reviewId: "review_prod_image_review_role",
          },
        },
        statusPanel: {
          pendingRoles: 1,
          safetySummary: "未命中敏感项",
          auditReadback: "脱敏",
          confirmationPoints: 2,
        },
        reviewChecklist: [
          { id: "public_materials", title: "公开材料" },
          { id: "safety_summary", title: "安全摘要" },
          { id: "pricing_confirmation", title: "价格确认" },
        ],
      },
    });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('"agents"');
    expect(serialized).not.toContain("三智能体");
    expect(serialized).not.toContain("metadata.dijieRole");
  });
});
