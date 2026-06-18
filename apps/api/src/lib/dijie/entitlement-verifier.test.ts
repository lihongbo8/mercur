import { describe, expect, it } from "bun:test";
import {
  type DijieQueryGraph,
  verifyDijieEntitlement,
} from "./entitlement-verifier";

const input = {
  actorId: "cus_123",
  roleListingId: "prod_role_developer_agent",
  entitlementId: "djent_123",
  deviceId: "device_123",
  workspaceRef: "workspace_123",
  localGatewayId: "gateway_123",
};
const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: input.roleListingId,
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
        pricing: {
          kind: "one_time_authorization",
          authorizationFeeCents: 29900,
          currency: "CNY",
          platformFeeBps: 0,
          developerReceivableCents: 29900,
        },
        roleTokenPricing,
        scopes: ["role.execute", "audit.write"],
      },
    },
    ...overrides,
  };
}

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_123",
    customer_id: input.actorId,
    status: "completed",
    payment_collections: [{ status: "captured", amount: 29900, captured_amount: 29900 }],
    items: [{ product_id: input.roleListingId }],
    ...overrides,
  };
}

function queryGraph(fixtures: {
  products?: unknown[];
  entitlements?: unknown[];
  orderGroups?: unknown[];
  orders?: unknown[];
}): DijieQueryGraph {
  return async ({ entity }) => {
    if (entity === "product") {
      return { data: fixtures.products ?? [product()] };
    }
    if (entity === "order_group") {
      return { data: fixtures.orderGroups ?? [{ id: input.entitlementId, orders: [paidOrder()] }] };
    }
    if (entity === "order") {
      return { data: fixtures.orders ?? [] };
    }
    if (entity === "dijie_role_entitlement") {
      return {
        data: fixtures.entitlements ?? [
          {
            id: input.entitlementId,
            actor_id: input.actorId,
            role_listing_id: input.roleListingId,
            entitlement_status: "authorized",
            source: "checkout",
            order_id: "order_123",
            authorized_at: new Date("2026-06-10T00:00:00.000Z"),
          },
        ],
      };
    }
    return { data: [] };
  };
}

describe("verifyDijieEntitlement", () => {
  it("approves a materialized paid one-time role entitlement", async () => {
    const result = await verifyDijieEntitlement(input, queryGraph({}));

    expect(result).toEqual({
      ok: true,
      packageId: "pkg_developer",
      packageVersion: "1.0.0",
      developerRef: "dev_001",
      listingOwnerRef: "dev_001",
      billingBeneficiaryRef: "dev_001",
      pricing: {
        kind: "one_time_authorization",
        authorizationFeeCents: 29900,
        currency: "CNY",
        platformFeeBps: 0,
        developerReceivableCents: 29900,
      },
      roleTokenPricing,
      scopes: ["role.execute", "audit.write"],
    });
  });

  it("rejects paid order facts before entitlement materializes", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        entitlements: [],
        orderGroups: [
          {
            id: "ordgrp_123",
            customer_id: input.actorId,
            orders: [
              paidOrder({
                status: "pending",
                payment_collections: [
                  { status: "authorized", amount: 29900, captured_amount: 0 },
                ],
              }),
            ],
          },
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "No materialized Dijie role entitlement was found for this customer.",
    });
  });

  it("approves zero-price local entitlements against stored RoleListing records", async () => {
    const storedInput = {
      ...input,
      roleListingId: "djrole_image_qc",
      entitlementId: "djent_zero",
    };
    const result = await verifyDijieEntitlement(storedInput, async ({ entity }) => {
      if (entity === "dijie_role_listing") {
        return {
          data: [
            {
              id: storedInput.roleListingId,
              package_id: "pkg_product_image_qc",
              package_version: "0.1.0",
              developer_ref: "member_123",
              listing_owner_ref: "seller_123",
              billing_beneficiary_ref: "member_123",
              title: "商品图检查岗位",
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
      if (entity === "dijie_role_entitlement") {
        return {
          data: [
            {
              id: storedInput.entitlementId,
              actor_id: storedInput.actorId,
              role_listing_id: storedInput.roleListingId,
              entitlement_status: "authorized",
              source: "zero_price",
              authorized_at: new Date("2026-06-04T00:00:00.000Z"),
            },
          ],
        };
      }
      throw new Error("legacy product fallback should not be used");
    });

    expect(result).toEqual({
      ok: true,
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      developerRef: "member_123",
      listingOwnerRef: "seller_123",
      billingBeneficiaryRef: "member_123",
      pricing: {
        kind: "one_time_authorization",
        authorizationFeeCents: 0,
        currency: "CNY",
        platformFeeBps: 0,
        developerReceivableCents: 0,
      },
      roleTokenPricing,
      scopes: ["role.execute", "audit.write"],
    });
  });

  it("approves execution against a local entitlement before checking paid orders", async () => {
    const storedInput = {
      ...input,
      roleListingId: "djrole_image_qc",
      entitlementId: "djent_1",
    };
    const result = await verifyDijieEntitlement(storedInput, async ({ entity }) => {
      if (entity === "dijie_role_listing") {
        return {
          data: [
            {
              id: storedInput.roleListingId,
              package_id: "pkg_product_image_qc",
              package_version: "0.1.0",
              developer_ref: "member_123",
              listing_owner_ref: "seller_123",
              billing_beneficiary_ref: "member_123",
              title: "商品图检查岗位",
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
      if (entity === "dijie_role_entitlement") {
        return {
          data: [
            {
              id: storedInput.entitlementId,
              actor_id: storedInput.actorId,
              role_listing_id: storedInput.roleListingId,
              entitlement_status: "authorized",
              source: "zero_price",
              authorized_at: new Date("2026-06-04T00:00:00.000Z"),
            },
          ],
        };
      }
      throw new Error("paid order fallback should not be used");
    });

    expect(result).toMatchObject({
      ok: true,
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      developerRef: "member_123",
      listingOwnerRef: "seller_123",
      billingBeneficiaryRef: "member_123",
    });
  });

  it("rejects role listings that include a marketplace platform cut", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        products: [
          product({
            metadata: {
              dijieRole: {
                kind: "role_product",
                protocolVersion: "2026-05",
                packageId: "pkg_developer",
                packageVersion: "1.0.0",
                developerRef: "dev_001",
                listingStatus: "published",
                reviewState: "approved",
                pricing: {
                  kind: "one_time_authorization",
                  authorizationFeeCents: 29900,
                  currency: "CNY",
                  platformFeeBps: 1500,
                  developerReceivableCents: 25300,
                },
                roleTokenPricing,
              },
            },
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "Role listing metadata is not a valid Dijie role product.",
    });
  });

  it("rejects non-purchased role listings", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        entitlements: [],
        orderGroups: [{ id: "ordgrp_123", orders: [paidOrder({ items: [] })] }],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "No materialized Dijie role entitlement was found for this customer.",
    });
  });

  it("rejects unpaid orders", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        entitlements: [],
        orderGroups: [
          {
            id: "ordgrp_123",
            orders: [paidOrder({ status: "pending", payment_collections: [] })],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("rejects non-executable listing states", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        products: [
          product({
            status: "draft",
            metadata: {
              dijieRole: {
                kind: "role_product",
                protocolVersion: "2026-05",
                packageId: "pkg_developer",
                packageVersion: "1.0.0",
                developerRef: "dev_001",
                listingStatus: "draft",
                reviewState: "approved",
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
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Role listing is not executable.",
    });
  });

  it("rejects listings without one-time authorization pricing", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        products: [
          product({
            metadata: {
              dijieRole: {
                kind: "role_product",
                protocolVersion: "2026-05",
                packageId: "pkg_developer",
                packageVersion: "1.0.0",
                developerRef: "dev_001",
                listingStatus: "published",
                reviewState: "approved",
                roleTokenPricing,
              },
            },
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "Role listing metadata is not a valid Dijie role product.",
    });
  });

  it("rejects privileged role product scopes before execution token minting", async () => {
    const result = await verifyDijieEntitlement(
      input,
      queryGraph({
        products: [
          product({
            metadata: {
              dijieRole: {
                kind: "role_product",
                protocolVersion: "2026-05",
                packageId: "pkg_developer",
                packageVersion: "1.0.0",
                developerRef: "dev_001",
                listingStatus: "published",
                reviewState: "approved",
                pricing: {
                  kind: "one_time_authorization",
                  authorizationFeeCents: 29900,
                  currency: "CNY",
                  platformFeeBps: 0,
                  developerReceivableCents: 29900,
                },
                roleTokenPricing,
                scopes: ["role.execute", "operator.write"],
              },
            },
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "Role listing metadata is not a valid Dijie role product.",
    });
  });
});
