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

function request() {
  return {
    scope: {
      resolve() {
        return {
          graph: async () => ({
            data: [
              {
                id: "prod_role_developer",
                title: "开发岗位",
                status: "published",
                metadata: {
                  dijieRole: {
                    kind: "role_product",
                    protocolVersion: "2026-05",
                    packageId: "pkg_developer",
                    packageVersion: "1.0.0",
                    developerRef: "dev_001",
                    listingStatus: "published",
                    reviewState: "approved",
                    capabilities: ["代码生成"],
                    pricing: {
                      kind: "one_time_authorization",
                      authorizationFeeCents: 29900,
                      currency: "CNY",
                      platformFeeBps: 0,
                      developerReceivableCents: 29900,
                    },
                    roleTokenPricing,
                  },
                },
              },
              {
                id: "prod_regular",
                title: "普通商品",
                status: "published",
                metadata: {},
              },
            ],
          }),
        };
      },
    },
  };
}

function storedListingRequest() {
  return {
    scope: {
      resolve() {
        return {
          graph: async (input: { entity: string }) => {
            if (input.entity === "dijie_role_listing") {
              return {
                data: [
                  {
                    id: "djrole_image_qc",
                    package_id: "pkg_product_image_qc",
                    package_version: "0.1.0",
                    developer_ref: "member_123",
                    title: "商品图检查岗位",
                    subtitle: "检查商品图片质量",
                    description: "输出图片质量问题和修改建议。",
                    listing_status: "published",
                    review_state: "approved",
                    capabilities: ["workspace.read", "image.inspect"],
                    manifest_summary: {
                      requiredCapabilities: ["workspace.read", "image.inspect"],
                    },
                    pricing: {
                      kind: "one_time_authorization",
                      authorizationFeeCents: 0,
                      currency: "CNY",
                      platformFeeBps: 0,
                      developerReceivableCents: 0,
                    },
                    role_token_pricing: roleTokenPricing,
                    scopes: ["role.execute", "audit.write"],
                  },
                ],
              };
            }
            throw new Error("product fallback should not be used when stored listings exist");
          },
        };
      },
    },
  };
}

describe("GET /dijie/roles", () => {
  it("returns public Dijie role listings from marketplace products", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roles: [
        {
          id: "prod_role_developer",
          title: "开发岗位",
          listingStatus: "published",
          reviewState: "approved",
          capabilities: ["代码生成"],
          pricing: {
            kind: "one_time_authorization",
            authorizationFeeCents: 29900,
            currency: "CNY",
          },
          authorizationSummary: {
            authorizationFeeCents: 29900,
            currency: "CNY",
            executionFeeNote: "执行费用按实际输入/输出 Token 用量进入 ledger/readback。",
          },
          roleTokenPricing: publicRoleTokenPricing,
          tokenUsageSummary: {
            inputTokenFee: "¥1.20/百万 Token",
            outputTokenFee: "¥3.60/百万 Token",
            executionFeeNote: "消费者执行前可查看单价，执行后以账本实际用量和费用为准。",
          },
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("developerReceivableBps");
    expect(JSON.stringify(res.body)).not.toContain("platformFeeBps");
  });

  it("prefers stored role listings over legacy product metadata", async () => {
    const res = response();
    await GET(storedListingRequest() as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roles: [
        {
          id: "djrole_image_qc",
          title: "商品图检查岗位",
          listingStatus: "published",
          reviewState: "approved",
          capabilities: ["workspace.read", "image.inspect"],
          pricing: {
            kind: "one_time_authorization",
            authorizationFeeCents: 0,
            currency: "CNY",
          },
          authorizationSummary: {
            authorizationFeeCents: 0,
            currency: "CNY",
          },
          roleTokenPricing: publicRoleTokenPricing,
          tokenUsageSummary: {
            inputTokenFee: "¥1.20/百万 Token",
            outputTokenFee: "¥3.60/百万 Token",
          },
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("developerReceivableBps");
    expect(JSON.stringify(res.body)).not.toContain("platformFeeBps");
  });
});
