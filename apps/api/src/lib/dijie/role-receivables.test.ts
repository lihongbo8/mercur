import { describe, expect, it } from "bun:test";
import { createDijieVendorReceivablesReadModel } from "./role-receivables";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

function roleProduct(overrides: Record<string, unknown> = {}) {
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
          requiredCapabilities: [
            "workspace.read",
            "image.inspect",
            "document.write",
            "human.confirm",
          ],
        },
        pricing: {
          kind: "one_time_authorization",
          authorizationFeeCents: 39900,
          currency: "CNY",
          platformFeeBps: 0,
          developerReceivableCents: 39900,
        },
        roleTokenPricing,
        ...overrides,
      },
    },
  };
}

function auditRecord(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: "exec_001",
    role_listing_id: "prod_image_review_role",
    package_id: "pkg_image_review",
    package_version: "0.1.0",
    billing_beneficiary_ref: "sel_001",
    role_usage_ledger: {
      ledger: "usage",
      source: "role_usage",
      entryId: "role_usage_exec_001",
      executionId: "exec_001",
      developerRef: "sel_001",
      billingBeneficiaryRef: "sel_001",
      roleListingId: "prod_image_review_role",
      packageId: "pkg_image_review",
      packageVersion: "0.1.0",
      developerReceivableCents: 3,
      platformReceivableCents: 0,
      currency: "CNY",
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
    ...overrides,
  };
}

describe("Dijie vendor receivables read model", () => {
  it("aggregates seller role authorization and role token receivables", () => {
    const readModel = createDijieVendorReceivablesReadModel({
      sellerId: "sel_001",
      products: [
        roleProduct(),
        {
          ...roleProduct({ billingBeneficiaryRef: "sel_002", developerRef: "sel_002", listingOwnerRef: "sel_002" }),
          id: "prod_other_role",
          title: "其他岗位",
          seller: { id: "sel_002" },
        },
      ],
      orderGroups: [
        {
          id: "ordgrp_paid",
          customer_id: "cus_private",
          orders: [
            {
              id: "order_paid",
              status: "completed",
              created_at: "2026-06-04T04:00:00.000Z",
              payment_collections: [
                { status: "completed", amount: 39900, captured_amount: 39900 },
              ],
              items: [{ product_id: "prod_image_review_role" }],
            },
            {
              id: "order_cancelled",
              status: "canceled",
              payment_collections: [
                { status: "completed", amount: 39900, captured_amount: 39900 },
              ],
              items: [{ product_id: "prod_image_review_role" }],
            },
          ],
        },
      ],
      orders: [
        {
          id: "order_other_seller",
          status: "completed",
          payment_collections: [
            { status: "completed", amount: 39900, captured_amount: 39900 },
          ],
          items: [{ product_id: "prod_other_role" }],
        },
      ],
      auditRecords: [
        auditRecord(),
        auditRecord({
          execution_id: "exec_002",
          billing_beneficiary_ref: "sel_002",
          role_usage_ledger: {
            ...auditRecord().role_usage_ledger,
            billingBeneficiaryRef: "sel_002",
            developerReceivableCents: 99,
          },
        }),
      ],
    });

    expect(readModel).toEqual({
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
      authorizationByRole: [
        {
          roleListingId: "prod_image_review_role",
          title: "商品图检查岗位",
          authorizationCount: 1,
          authorizationReceivableCents: 39900,
          lastAuthorizedAt: "2026-06-04T04:00:00.000Z",
        },
      ],
      roleUsageByRole: [
        {
          roleListingId: "prod_image_review_role",
          title: "商品图检查岗位",
          packageId: "pkg_image_review",
          packageVersion: "0.1.0",
          executionCount: 1,
          inputTokens: 1200,
          outputTokens: 800,
          roleUsageReceivableCents: 3,
          lastReceivedAt: "2026-06-04T05:00:00.000Z",
        },
      ],
      authorizationEvents: [],
      usageEvents: [
        {
          roleListingId: "prod_image_review_role",
          title: "商品图检查岗位",
          packageId: "pkg_image_review",
          packageVersion: "0.1.0",
          inputTokens: 1200,
          outputTokens: 800,
          developerReceivableCents: 3,
          currency: "CNY",
          receivedAt: "2026-06-04T05:00:00.000Z",
        },
      ],
    });
  });

  it("keeps private marketplace and local execution facts out of the response", () => {
    const readModel = createDijieVendorReceivablesReadModel({
      sellerId: "sel_001",
      products: [roleProduct()],
      orderGroups: [
        {
          id: "ordgrp_private",
          customer_id: "cus_private",
          orders: [
            {
              id: "order_private",
              status: "completed",
              payment_collections: [
                { status: "completed", amount: 39900, captured_amount: 39900 },
              ],
              items: [
                {
                  product_id: "prod_image_review_role",
                  metadata: { localGatewayId: "gateway_private" },
                },
              ],
            },
          ],
        },
      ],
      orders: [],
      auditRecords: [
        auditRecord({
          device_id: "device_private",
          workspace_ref: "/Users/private/workspace",
          local_gateway_id: "gateway_private",
        }),
      ],
    });

    const serialized = JSON.stringify(readModel);
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("dijieRole");
    expect(serialized).not.toContain("order_private");
    expect(serialized).not.toContain("ordgrp_private");
    expect(serialized).not.toContain("cus_private");
    expect(serialized).not.toContain("device_private");
    expect(serialized).not.toContain("gateway_private");
    expect(serialized).not.toContain("/Users/private");
    expect(serialized).not.toContain("Bearer ");
    expect(serialized).not.toContain("secret");
  });

  it("returns a truthful empty summary when no receivable facts exist", () => {
    expect(
      createDijieVendorReceivablesReadModel({
        sellerId: "sel_empty",
        products: [],
        orderGroups: [],
        orders: [],
        auditRecords: [],
      }),
    ).toEqual({
      summary: {
        currency: "CNY",
        authorizationReceivableCents: 0,
        roleUsageReceivableCents: 0,
        totalDeveloperReceivableCents: 0,
        platformReceivableCents: 0,
        authorizationCount: 0,
        executionCount: 0,
        inputTokens: 0,
        outputTokens: 0,
      },
      authorizationByRole: [],
      roleUsageByRole: [],
      authorizationEvents: [],
      usageEvents: [],
    });
  });
});
