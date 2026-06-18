import { describe, expect, it } from "bun:test";
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

function roleProduct() {
  return {
    id: "prod_image_review_role",
    title: "商品图检查岗位",
    seller: { id: "sel_001" },
    metadata: {
      dijieRole: {
        kind: "role_product",
        protocolVersion: "2026-05",
        packageId: "pkg_image_review",
        packageVersion: "0.1.0",
        developerRef: "sel_001",
        listingOwnerRef: "sel_001",
        billingBeneficiaryRef: "sel_001",
        listingStatus: "published",
        reviewState: "approved",
        capabilities: [],
        manifestSummary: {
          requiredCapabilities: ["workspace.read", "image.inspect"],
        },
        pricing: {
          kind: "one_time_authorization",
          authorizationFeeCents: 39900,
          currency: "CNY",
          platformFeeBps: 0,
          developerReceivableCents: 39900,
        },
        roleTokenPricing: {
          inputTokenCentsPerMillion: 120,
          outputTokenCentsPerMillion: 360,
          currency: "CNY",
          developerReceivableBps: 10000,
          platformFeeBps: 0,
        },
      },
    },
  };
}

function request(sellerId?: string) {
  return {
    seller_context: sellerId ? { seller_id: sellerId } : undefined,
    scope: {
      resolve(name: string) {
        if (name !== "query") {
          throw new Error(`Unknown dependency: ${name}`);
        }

        return {
          async graph(input: { entity: string; filters?: Record<string, unknown> }) {
            if (input.entity === "product") {
              return { data: [roleProduct()] };
            }
            if (input.entity === "order_group") {
              return {
                data: [
                  {
                    id: "ordgrp_private",
                    orders: [
                      {
                        id: "order_private",
                        status: "completed",
                        created_at: "2026-06-04T04:00:00.000Z",
                        payment_collections: [
                          { status: "completed", amount: 39900, captured_amount: 39900 },
                        ],
                        items: [{ product_id: "prod_image_review_role" }],
                      },
                    ],
                  },
                ],
              };
            }
            if (input.entity === "order") {
              return { data: [] };
            }
            if (input.entity === "dijie_audit_record") {
              expect(input.filters).toEqual({ billing_beneficiary_ref: "sel_001" });
              return {
                data: [
                  {
                    execution_id: "exec_private",
                    role_listing_id: "prod_image_review_role",
                    package_id: "pkg_image_review",
                    package_version: "0.1.0",
                    billing_beneficiary_ref: "sel_001",
                    role_usage_ledger: {
                      ledger: "usage",
                      source: "role_usage",
                      developerReceivableCents: 3,
                      billingBeneficiaryRef: "sel_001",
                      roleListingId: "prod_image_review_role",
                      packageId: "pkg_image_review",
                      packageVersion: "0.1.0",
                      meters: [
                        { name: "input_tokens", quantity: 1200, unit: "token" },
                        { name: "output_tokens", quantity: 800, unit: "token" },
                      ],
                    },
                    model_proxy_usage: {
                      inputTokens: 1200,
                      outputTokens: 800,
                    },
                    received_at: "2026-06-04T05:00:00.000Z",
                  },
                ],
              };
            }
            return { data: [] };
          },
        };
      },
    },
  };
}

describe("GET /vendor/dijie/receivables", () => {
  it("requires a selected seller context", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "读取迭界AI岗位应收需要先选择开发者店铺。",
    });
  });

  it("returns a seller-scoped safe receivables summary", async () => {
    const res = response();
    await GET(request("sel_001") as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      receivables: {
        summary: {
          currency: "CNY",
          authorizationReceivableCents: 39900,
          roleUsageReceivableCents: 3,
          totalDeveloperReceivableCents: 39903,
          platformReceivableCents: 0,
          authorizationCount: 1,
          executionCount: 1,
          inputTokens: 1200,
          outputTokens: 800,
        },
      },
    });

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("dijieRole");
    expect(serialized).not.toContain("order_private");
    expect(serialized).not.toContain("ordgrp_private");
    expect(serialized).not.toContain("exec_private");
  });
});
