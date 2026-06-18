import { describe, expect, it } from "bun:test";
import type {
  DijieCatalogReviewRequestStorageRecord,
  DijieSpecialCapabilityBindingStorageRecord,
} from "./catalog-store";
import type { DijieRoleEntitlementStorageRecord } from "./role-entitlement-store";
import type { DijieRoleListing } from "./role-listings";
import type { DijieRolePackageStorageRecord } from "./role-package-store";
import {
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
  createDijieEcommerceArtDesignerCategory,
} from "./ecommerce-art-designer-category";
import { buildDijieDispatcherGatewayRoleReadModel } from "./gateway-role-read-model";

const categoryRegistry = {
  categories: [
    {
      categoryRef: "category:image_review@1",
      name: "图片审核",
      version: "1",
      description: "测试用图片审核品类。",
      status: "approved" as const,
      packBinding: {
        categoryPackRef: "categorypack:image_review@1",
        skillPackRef: "skillpack:image_review@1",
        toolPackRef: "toolpack:image_review@1",
        capabilityRefs: ["image.inspect", "audit.record"],
        catalogRefs: ["skillpack:image_review@1", "toolpack:image_review@1"],
        permissionSummary: ["image.inspect", "audit.record"],
      },
    },
  ],
};

function role(overrides: Partial<DijieRoleListing> = {}): DijieRoleListing {
  return {
    id: "djrole_image_review",
    title: "商品图检查岗位",
    subtitle: "检查商品图质量",
    description: "适合商品图、美工初审和图片质量检查。",
    usageInstructions: "使用者需要提供商品图、目标平台和人工确认标准。",
    category: "图片审核",
    categoryRef: "category:image_review@1",
    handle: "djrole_image_review",
    listingStatus: "published",
    reviewState: "approved",
    developerId: "acct_dev",
    developerName: null,
    packageId: "djpkg_image_review",
    packageVersion: "1.0.0",
    protocolVersion: "2026-05",
    manifestSummary: null,
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
      fileCount: 6,
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
    validation_issues: null,
    ...overrides,
  };
}

function specialCapabilityRequest(
  overrides: Partial<DijieCatalogReviewRequestStorageRecord & { id: string }> = {},
): DijieCatalogReviewRequestStorageRecord & { id: string } {
  return {
    id: "djcat_review_3d_render",
    review_key: "special-capability-capability-3d-render",
    catalog_ref: "capability:visual.3d_render.inspect",
    need: "visual.3d_render.inspect",
    kind: "capability",
    source: "internal_build",
    review_status: "approved",
    role_package_id: "djpkg_image_review",
    role_listing_id: null,
    requested_by: "acct_dev",
    submitted_at: new Date("2026-06-06T00:00:00.000Z"),
    reviewed_at: new Date("2026-06-07T00:00:00.000Z"),
    reviewed_by: "marketplace_owner",
    review_note: "平台已建设特殊能力包。",
    candidate: {
      requestType: "special_capability_pack",
      reason: "基础品类包不包含三维渲染质检。",
    },
    risk_summary: {
      riskLevel: "medium",
      requiresHumanReview: true,
    },
    payload: {
      requestType: "special_capability_pack",
      categoryRef: "category:image_review@1",
    },
    ...overrides,
  };
}

function specialCapabilityBinding(
  overrides: Partial<DijieSpecialCapabilityBindingStorageRecord & { id: string }> = {},
): DijieSpecialCapabilityBindingStorageRecord & { id: string } {
  return {
    id: "djcapbind_3d_render",
    binding_key: "special-capability-binding-3d-render",
    review_request_id: "djcat_review_3d_render",
    catalog_ref: "capability:visual.3d_render.inspect",
    need: "visual.3d_render.inspect",
    kind: "capability",
    role_package_id: "djpkg_image_review",
    role_listing_id: "djrole_image_review",
    category_ref: "category:image_review@1",
    binding_status: "bound",
    bound_by: "acct_dev",
    bound_at: new Date("2026-06-08T00:00:00.000Z"),
    payload: {
      requestType: "special_capability_binding",
    },
    ...overrides,
  };
}

describe("Dijie dispatcher Gateway role read model", () => {
  it("returns ecommerce art designer inherited category capabilities for OpenClaw", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [
        role({
          category: "电商美工",
          categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
        }),
      ],
      entitlements: [entitlement()],
      categoryRegistry: {
        categories: [createDijieEcommerceArtDesignerCategory()],
      },
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: true,
      packageContext: {
        category: {
          categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
          name: "电商美工",
          status: "approved",
        },
        inheritedCatalogRefs: expect.arrayContaining([
          DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
          DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
          DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
        ]),
        inheritedCapabilityRefs: expect.arrayContaining([
          "workspace.read",
          "workspace.write",
          "document.write",
          "image.inspect",
          "image.generate",
          "workboard.task",
          "scheduler.cadence",
          "human.confirm",
          "audit.record",
        ]),
      },
    });
    const serialized = JSON.stringify(readModel);
    expect(serialized).not.toContain("provider_key");
    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("rawRequest");
  });

  it("returns callable role records only when a local entitlement exists", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      billingAccountId: "company_001",
      workspaceRef: "workspace_main",
      roles: [role()],
      entitlements: [entitlement()],
      categoryRegistry,
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
      categoryRegistry,
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: false,
      entitlement: null,
      unavailableReasons: ["missing_entitlement"],
    });
  });

  it("ignores legacy manifest catalog bindings and relies on the approved category pack", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [entitlement()],
      packages: [
        packageRecord({
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
            fileCount: 6,
          } as unknown as DijieRolePackageStorageRecord["manifest_summary"],
        }),
      ],
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
      categoryRegistry,
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: true,
      unavailableReasons: [],
      packageContext: {
        catalogBindings: [],
        blockedCapabilities: [],
        effectiveCapabilities: expect.arrayContaining(["image.inspect", "audit.record"]),
        inheritedCatalogRefs: expect.arrayContaining([
          "categorypack:image_review@1",
          "skillpack:image_review@1",
          "toolpack:image_review@1",
        ]),
      },
    });
  });

  it("merges only bound approved special capabilities into the OpenClaw read model", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [entitlement()],
      packages: [packageRecord()],
      categoryRegistry,
      catalogReviewRequests: [
        specialCapabilityRequest(),
        specialCapabilityRequest({
          id: "djcat_review_pending_video",
          review_key: "special-capability-api-video",
          catalog_ref: null,
          need: "video.generate",
          kind: "api",
          review_status: "pending_review",
        }),
      ],
      specialCapabilityBindings: [specialCapabilityBinding()],
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: true,
      unavailableReasons: [],
      packageContext: {
        specialCapabilityRequests: expect.arrayContaining([
          expect.objectContaining({
            requestRef: "djcat_review_3d_render",
            need: "visual.3d_render.inspect",
            status: "approved",
          }),
          expect.objectContaining({
            requestRef: "djcat_review_pending_video",
            need: "video.generate",
            status: "pending_review",
          }),
        ]),
        specialCapabilityBindings: expect.arrayContaining([
          expect.objectContaining({
            ref: "visual.3d_render.inspect",
            catalogRef: "capability:visual.3d_render.inspect",
            approved: true,
          }),
        ]),
        effectiveCapabilities: expect.arrayContaining([
          "image.inspect",
          "visual.3d_render.inspect",
        ]),
        capabilityRequirements: expect.arrayContaining([
          expect.objectContaining({
            ref: "visual.3d_render.inspect",
            catalogRef: "capability:visual.3d_render.inspect",
            approved: true,
          }),
        ]),
        blockedCapabilities: [],
      },
    });
    expect(readModel.roles[0].packageContext.effectiveCapabilities).not.toEqual(
      expect.arrayContaining(["video.generate"]),
    );
  });

  it("does not merge approved special capability requests before developer binding", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [entitlement()],
      packages: [packageRecord()],
      categoryRegistry,
      catalogReviewRequests: [specialCapabilityRequest()],
      specialCapabilityBindings: [],
    });

    expect(readModel.roles[0]).toMatchObject({
      callable: true,
      unavailableReasons: [],
      packageContext: {
        specialCapabilityRequests: [
          expect.objectContaining({
            need: "visual.3d_render.inspect",
            status: "approved",
          }),
        ],
        specialCapabilityBindings: [],
      },
    });
    expect(readModel.roles[0].packageContext.effectiveCapabilities).not.toEqual(
      expect.arrayContaining(["visual.3d_render.inspect"]),
    );
  });

  it("does not project manifest Skill/Tool fields into the local OpenClaw capability router", () => {
    const readModel = buildDijieDispatcherGatewayRoleReadModel({
      actorId: "local_operator",
      roles: [role()],
      entitlements: [entitlement()],
      packages: [
        packageRecord({
          manifest_summary: {
            entrypoint: "role_package/manifest.json",
            manifestRef: "role_package/manifest.json",
            name: "商品图生成岗位",
            permissions: ["role.execute"],
            requiredCapabilities: ["image.generate", "human.confirm"],
            requiredTools: [
              {
                need: "图片生成",
                catalogRef: "api.opencloud.image_generation",
                kind: "api",
                status: "bindable",
              },
              {
                need: "人工确认",
                catalogRef: "tool.platform.human_confirmation",
                kind: "tool",
                status: "bindable",
              },
            ],
            fileCount: 3,
          } as unknown as DijieRolePackageStorageRecord["manifest_summary"],
        }),
      ],
      categoryRegistry,
    });

    expect(readModel.roles[0].packageContext.catalogRefs).toEqual(
      expect.arrayContaining([
        "capability:image.generate",
        "capability:human.confirm",
        "categorypack:image_review@1",
        "skillpack:image_review@1",
        "toolpack:image_review@1",
      ]),
    );
    expect(readModel.roles[0].catalogRefs).toEqual(
      expect.arrayContaining([
        "capability:image.generate",
        "capability:human.confirm",
        "categorypack:image_review@1",
        "skillpack:image_review@1",
        "toolpack:image_review@1",
      ]),
    );
    expect(readModel.roles[0].packageContext.catalogRefs).not.toContain("api:image.generate@1.0.0");
    expect(readModel.roles[0].packageContext.catalogRefs).not.toContain(
      "capability:human.confirm@1.0.0",
    );
    expect(readModel.roles[0].packageContext.capabilityRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogRef: "categorypack:image_review@1",
          routeKind: "unsupported",
        }),
        expect.objectContaining({
          catalogRef: "skillpack:image_review@1",
          routeKind: "local_skill",
        }),
        expect.objectContaining({
          catalogRef: "toolpack:image_review@1",
          routeKind: "local_tool",
        }),
      ]),
    );
  });

});
