import { describe, expect, it } from "bun:test";
import type { DijieRoleEntitlementStorageRecord } from "./role-entitlement-store";
import type { DijieRoleListing } from "./role-listings";
import { buildDijieDispatcherGatewayRoleReadModel } from "./gateway-role-read-model";

function role(overrides: Partial<DijieRoleListing> = {}): DijieRoleListing {
  return {
    id: "djrole_image_review",
    title: "商品图检查岗位",
    subtitle: "检查商品图质量",
    description: "适合商品图、美工初审和图片质量检查。",
    handle: "djrole_image_review",
    listingStatus: "published",
    reviewState: "approved",
    developerId: "acct_dev",
    developerName: null,
    packageId: "djpkg_image_review",
    packageVersion: "1.0.0",
    protocolVersion: "2026-05",
    capabilities: ["视觉检查"],
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 0,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 0,
    },
    roleTokenPricing: {
      inputTokenCentsPerMillion: 100,
      outputTokenCentsPerMillion: 200,
      currency: "CNY",
      developerReceivableBps: 7000,
      platformFeeBps: 3000,
    },
    scopes: ["role.execute", "audit.write"],
    ...overrides,
  };
}

function entitlement(
  overrides: Partial<DijieRoleEntitlementStorageRecord & { id: string }> = {},
): DijieRoleEntitlementStorageRecord & { id: string } {
  return {
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
    authorized_at: new Date("2026-06-05T01:00:00.000Z"),
    ...overrides,
  };
}

describe("Dijie dispatcher Gateway role read model", () => {
  it("returns callable role records only when a local entitlement exists", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      billingAccountId: "company_001",
      workspaceRef: "workspace_main",
      roles: [role()],
      entitlements: [entitlement()],
      generatedAt: new Date("2026-06-05T02:00:00.000Z"),
    });

    expect(readModel).toMatchObject({
      actorId: "local_operator",
      billingAccountId: "company_001",
      workspaceRef: "workspace_main",
      generatedAt: "2026-06-05T02:00:00.000Z",
      roles: [
        {
          roleListingId: "djrole_image_review",
          callable: true,
          unavailableReasons: [],
          entitlement: {
            id: "djent_image_review",
            status: "authorized",
            source: "zero_price",
            authorizedAt: "2026-06-05T01:00:00.000Z",
          },
          billingPolicySnapshot: {
            inputTokenCentsPerMillion: 100,
            outputTokenCentsPerMillion: 200,
            developerReceivableBps: 7000,
            platformFeeBps: 3000,
          },
        },
      ],
    });
  });

  it("marks roles unavailable when the dispatcher account has no entitlement", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [],
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: false,
      entitlement: null,
      unavailableReasons: ["missing_entitlement"],
    });
  });
});
