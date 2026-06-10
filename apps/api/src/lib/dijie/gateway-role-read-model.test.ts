import { describe, expect, it } from "bun:test";
import type { DijieRoleEntitlementStorageRecord } from "./role-entitlement-store";
import type { DijieRoleListing } from "./role-listings";
import type { DijieRolePackageStorageRecord } from "./role-package-store";
import { buildDijieDispatcherGatewayRoleReadModel } from "./gateway-role-read-model";

function role(overrides: Partial<DijieRoleListing> = {}): DijieRoleListing {
  return {
    id: "djrole_image_review",
    title: "商品图检查岗位",
    subtitle: "检查商品图质量",
    description: "适合商品图、美工初审和图片质量检查。",
    usageInstructions: "使用者需要提供商品图、目标平台和人工确认标准。",
    category: null,
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
      developerReceivableBps: 10000,
      platformFeeBps: 0,
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
      developerReceivableBps: 10000,
      platformFeeBps: 0,
    },
    authorized_at: new Date("2026-06-05T01:00:00.000Z"),
    ...overrides,
  };
}

function packageRecord(
  overrides: Partial<DijieRolePackageStorageRecord> = {},
): DijieRolePackageStorageRecord & { id: string } {
  return {
    id: "djpkg_record_image_review",
    package_id: "djpkg_image_review",
    package_version: "1.0.0",
    owner_id: "acct_dev",
    uploaded_at: new Date("2026-06-05T00:00:00.000Z"),
    manifest_summary: {
      entrypoint: "role_package/manifest.json",
      manifestRef: "role_package/manifest.json",
      name: "商品图检查岗位",
      permissions: ["role.execute"],
      requiredCapabilities: ["image.inspect"],
      requiredTools: [
        {
          need: "图片理解",
          catalogRef: "tool.platform.image_inspector",
          status: "bindable",
        },
      ],
      fileCount: 3,
    },
    file_manifest: [
      { path: "role_package/manifest.json" },
      { path: "role_package/README.md" },
      { path: "role_package/skills/image-inspection.md" },
    ],
    package_files: [],
    validation_issues: null,
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
            developerReceivableBps: 10000,
            platformFeeBps: 0,
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

  it("blocks callable roles when a declared catalog binding is not approved", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [entitlement()],
      packages: [packageRecord()],
      catalogItems: [
        {
          id: "tool.platform.image_inspector",
          kind: "tool",
          name: "图片理解工具",
          version: "1.0.0",
          description: "已被平台禁用的图片理解工具。",
          tags: ["image"],
          provides: ["image.inspect"],
          source: "platform_builtin",
          status: "disabled",
          permissions: ["image.inspect"],
          riskLevel: "medium",
          auditPolicy: ["audit.record"],
          keywords: ["图片理解"],
        },
      ],
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: false,
      unavailableReasons: ["blocked_catalog_bindings"],
      packageContext: {
        catalogBindings: [
          {
            catalogRef: "tool.platform.image_inspector",
            catalogStatus: "disabled",
            approved: false,
          },
        ],
        blockedCapabilities: [
          {
            catalogRef: "tool.platform.image_inspector",
            reason: "catalog_item_not_approved",
            catalogStatus: "disabled",
          },
        ],
        effectiveCapabilities: [],
      },
    });
  });
});
