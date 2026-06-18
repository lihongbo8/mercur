import { describe, expect, it } from "bun:test";
import { GET } from "./route";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

const publicRoleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
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

function request(roleListingId: string) {
  return {
    params: { roleListingId },
    scope: {
      resolve() {
        return {
          graph: async () => ({
            data: [
              {
                id: "prod_image_review_role",
                title: "商品图检查岗位",
                subtitle: "检查商品图是否清晰、合规、适合上架。",
                description: "适合电商商品审核场景。",
                handle: "image-review-role",
                status: "published",
                variants: [{ id: "variant_image_review_auth" }],
                seller: { id: "dev_001", name: "迭界开发者" },
                metadata: {
                  dijieRole: {
                    kind: "role_product",
                    protocolVersion: "2026-05",
                    packageId: "pkg_image_review_role",
                    packageVersion: "1.0.0",
                    developerRef: "dev_001",
                    listingStatus: "published",
                    reviewState: "approved",
                    capabilities: ["商品图检查", "违规风险提示"],
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
              {
                id: "prod_writer_role",
                title: "商品文案岗位",
                subtitle: "整理商品卖点并生成文案。",
                handle: "writer-role",
                status: "published",
                variants: [{ id: "variant_writer_auth" }],
                metadata: {
                  dijieRole: {
                    kind: "role_product",
                    protocolVersion: "2026-05",
                    packageId: "pkg_writer_role",
                    packageVersion: "1.0.0",
                    developerRef: "dev_001",
                    listingStatus: "published",
                    reviewState: "approved",
                    capabilities: ["商品文案"],
                    pricing: {
                      kind: "one_time_authorization",
                      authorizationFeeCents: 9900,
                      currency: "CNY",
                      platformFeeBps: 0,
                      developerReceivableCents: 9900,
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

describe("GET /dijie/roles/:roleListingId", () => {
  it("returns a buyer-safe role detail projection", async () => {
    const res = response();
    await GET(request("prod_image_review_role") as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      role: {
        id: "prod_image_review_role",
        title: "商品图检查岗位",
        handle: "image-review-role",
        detailSections: {
          roleDetails: ["适合电商商品审核场景。", "检查商品图是否清晰、合规、适合上架。"],
          requiredCapabilities: ["商品图检查", "违规风险提示"],
        },
        authorizationSummary: {
          authorizationFeeCents: 19900,
          currency: "CNY",
          executionFeeNote: "执行费用按实际输入/输出 Token 用量进入 ledger/readback。",
        },
        roleTokenPricing: publicRoleTokenPricing,
        tokenUsageSummary: {
          inputTokenFee: "¥1.20/百万 Token",
          outputTokenFee: "¥3.60/百万 Token",
          executionFeeNote: "消费者执行前可查看单价，执行后以账本实际用量和费用为准。",
        },
        checkout: {
          requiresCheckout: true,
          productId: "prod_image_review_role",
          variantId: "variant_image_review_auth",
        },
        relatedRoles: [{ id: "prod_writer_role", title: "商品文案岗位" }],
      },
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("metadata.dijieRole");
    expect(serialized).not.toContain("developerReceivableBps");
    expect(serialized).not.toContain("platformFeeBps");
    expect(serialized).not.toContain("roleBuildBrief");
    expect(serialized).not.toContain("executionId");
  });

  it("returns 404 for non-public or missing roles", async () => {
    const res = response();
    await GET(request("missing_role") as never, res as never);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ ok: false });
  });
});
