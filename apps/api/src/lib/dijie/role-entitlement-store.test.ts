import { describe, expect, it } from "bun:test";
import {
  authorizeDijiePaidRoleListingWithRepository,
  authorizeDijieRoleListingWithRepository,
  type DijieRoleEntitlementStorageRecord,
} from "./role-entitlement-store";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
} as const;

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: "djrole_image_qc",
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
    ...overrides,
  };
}

function paidListing(overrides: Record<string, unknown> = {}) {
  return listing({
    id: "djrole_paid",
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 29900,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 29900,
    },
    ...overrides,
  });
}

function repository(options: {
  listings?: unknown[];
  entitlements?: Array<DijieRoleEntitlementStorageRecord & { id: string }>;
} = {}) {
  const entitlements = [...(options.entitlements ?? [])];
  return {
    entitlements,
    async listDijieRoleListings() {
      return (options.listings ?? [listing()]) as never;
    },
    async listDijieRoleEntitlements() {
      return entitlements;
    },
    async createDijieRoleEntitlements(
      data: Omit<DijieRoleEntitlementStorageRecord, "id">,
    ) {
      const created = { id: `djent_${entitlements.length + 1}`, ...data };
      entitlements.push(created);
      return created;
    },
  };
}

describe("authorizeDijieRoleListingWithRepository", () => {
  it("creates a local entitlement for zero-price published listings", async () => {
    const repo = repository();
    const result = await authorizeDijieRoleListingWithRepository(repo, {
      actorId: "cus_001",
      roleListingId: "djrole_image_qc",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        entitlementId: "djent_1",
        entitlement: {
          actor_id: "cus_001",
          role_listing_id: "djrole_image_qc",
          package_id: "pkg_product_image_qc",
          package_version: "0.1.0",
          developer_ref: "member_123",
          listing_owner_ref: "seller_123",
          billing_beneficiary_ref: "member_123",
          entitlement_status: "authorized",
          source: "zero_price",
          order_id: null,
        },
      },
    });
  });

  it("returns an existing authorized entitlement idempotently", async () => {
    const existing = {
      id: "djent_existing",
      actor_id: "cus_001",
      role_listing_id: "djrole_image_qc",
      package_id: "pkg_product_image_qc",
      package_version: "0.1.0",
      developer_ref: "member_123",
      listing_owner_ref: "seller_123",
      billing_beneficiary_ref: "member_123",
      entitlement_status: "authorized",
      source: "zero_price",
      order_id: null,
      pricing: listing().pricing,
      role_token_pricing: roleTokenPricing,
      authorized_at: new Date("2026-06-04T00:00:00.000Z"),
    } satisfies DijieRoleEntitlementStorageRecord & { id: string };
    const repo = repository({ entitlements: [existing] });
    const result = await authorizeDijieRoleListingWithRepository(repo, {
      actorId: "cus_001",
      roleListingId: "djrole_image_qc",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        entitlementId: "djent_existing",
      },
    });
    expect(repo.entitlements).toHaveLength(1);
  });

  it("requires checkout for paid listings", async () => {
    const result = await authorizeDijieRoleListingWithRepository(
      repository({
        listings: [
          listing({
            pricing: {
              kind: "one_time_authorization",
              authorizationFeeCents: 29900,
              currency: "CNY",
              platformFeeBps: 0,
              developerReceivableCents: 29900,
            },
          }),
        ],
      }),
      {
        actorId: "cus_001",
        roleListingId: "djrole_image_qc",
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 402,
      code: "checkout_required",
      error: "该岗位需要完成结算后才能生成授权。",
    });
  });
});

describe("authorizeDijiePaidRoleListingWithRepository", () => {
  it("materializes a checkout entitlement for paid published listings", async () => {
    const repo = repository({ listings: [paidListing()] });
    const result = await authorizeDijiePaidRoleListingWithRepository(repo, {
      actorId: "cus_001",
      roleListingId: "djrole_paid",
      orderId: "ordgrp_paid_1",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        entitlementId: "djent_1",
        entitlement: {
          actor_id: "cus_001",
          role_listing_id: "djrole_paid",
          package_id: "pkg_product_image_qc",
          package_version: "0.1.0",
          entitlement_status: "authorized",
          source: "checkout",
          order_id: "ordgrp_paid_1",
          pricing: {
            authorizationFeeCents: 29900,
          },
        },
      },
    });
  });

  it("returns an existing checkout entitlement for the same paid order", async () => {
    const existing = {
      id: "djent_existing_paid",
      actor_id: "cus_001",
      role_listing_id: "djrole_paid",
      package_id: "pkg_product_image_qc",
      package_version: "0.1.0",
      developer_ref: "member_123",
      listing_owner_ref: "seller_123",
      billing_beneficiary_ref: "member_123",
      entitlement_status: "authorized",
      source: "checkout",
      order_id: "ordgrp_paid_1",
      pricing: paidListing().pricing,
      role_token_pricing: roleTokenPricing,
      authorized_at: new Date("2026-06-04T00:00:00.000Z"),
    } satisfies DijieRoleEntitlementStorageRecord & { id: string };
    const repo = repository({ listings: [paidListing()], entitlements: [existing] });
    const result = await authorizeDijiePaidRoleListingWithRepository(repo, {
      actorId: "cus_001",
      roleListingId: "djrole_paid",
      orderId: "ordgrp_paid_1",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        entitlementId: "djent_existing_paid",
      },
    });
    expect(repo.entitlements).toHaveLength(1);
  });

  it("does not silently re-authorize a revoked checkout order", async () => {
    const revoked = {
      id: "djent_revoked",
      actor_id: "cus_001",
      role_listing_id: "djrole_paid",
      package_id: "pkg_product_image_qc",
      package_version: "0.1.0",
      developer_ref: "member_123",
      listing_owner_ref: "seller_123",
      billing_beneficiary_ref: "member_123",
      entitlement_status: "revoked",
      source: "checkout",
      order_id: "ordgrp_paid_1",
      pricing: paidListing().pricing,
      role_token_pricing: roleTokenPricing,
      authorized_at: new Date("2026-06-04T00:00:00.000Z"),
    } satisfies DijieRoleEntitlementStorageRecord & { id: string };
    const repo = repository({ listings: [paidListing()], entitlements: [revoked] });
    const result = await authorizeDijiePaidRoleListingWithRepository(repo, {
      actorId: "cus_001",
      roleListingId: "djrole_paid",
      orderId: "ordgrp_paid_1",
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "该订单对应的岗位授权已被撤销，不能再次使用。",
    });
    expect(repo.entitlements).toHaveLength(1);
  });
});
