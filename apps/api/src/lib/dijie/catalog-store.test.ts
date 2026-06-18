import { describe, expect, it } from "bun:test";
import {
  bindDijieSpecialCapabilityToRoleWithRepository,
  createDijieCatalogReviewRequestsForPlanWithRepository,
  createDijieSpecialCapabilityReviewRequestWithRepository,
  finalizeDijieCatalogReviewRequestWithRepository,
  listDijieEffectiveCatalogItemsWithRepository,
  sanitizeDijieCatalogBoundaryPayload,
  type DijieCatalogItemStorageRecord,
  type DijieCatalogReviewRequestStorageRecord,
  type DijieSpecialCapabilityBindingStorageRecord,
} from "./catalog-store";
import type { DijieRoleListingStorageRecord } from "./role-listing-store";
import type { DijieRoleCapabilityPlan } from "./role-skill-tool-planner";

function catalogRecord(
  overrides: Partial<DijieCatalogItemStorageRecord> = {},
): DijieCatalogItemStorageRecord & { id: string } {
  const now = new Date("2026-06-10T00:00:00.000Z");
  return {
    id: "djcat_item_001",
    catalog_ref: "tool.platform.image_inspector",
    kind: "tool",
    name: "图片理解工具",
    version: "1.0.1",
    description: "临时禁用的图片理解工具。",
    source: "platform_builtin",
    catalog_status: "disabled",
    permissions: ["image.inspect"],
    risk_level: "medium",
    audit_policy: ["audit.record"],
    tags: ["image"],
    provides: ["image.inspect"],
    keywords: ["图片理解"],
    payload: {},
    created_at: now,
    updated_at: now,
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  };
}

function planWithGap(): DijieRoleCapabilityPlan {
  return {
    requiredSkills: ["短视频质检"],
    requiredTools: [],
    requiredCapabilities: [],
    catalogBindings: [],
    gaps: [
      {
        need: "短视频质检",
        kind: "skill",
        reason: "平台目录暂无短视频质检 skill。",
        nextAction: "search_external",
      },
    ],
    status: "waiting_skill_tool_review",
    reviewBlockers: ["短视频质检: 平台目录暂无短视频质检 skill。"],
  };
}

function repository() {
  const catalogItems: Array<DijieCatalogItemStorageRecord & { id: string }> = [];
  const reviewRequests: Array<DijieCatalogReviewRequestStorageRecord & { id: string }> = [];
  const bindings: Array<DijieSpecialCapabilityBindingStorageRecord & { id: string }> = [];
  const roleListings: Array<DijieRoleListingStorageRecord & { id: string }> = [
    {
      id: "djrole_123",
      package_id: "djpkg_smart_lock_designer",
      package_version: "1.0.0",
      owner_id: "dev_001",
      developer_ref: "sel_001",
      listing_owner_ref: "sel_001",
      billing_beneficiary_ref: "sel_001",
      title: "智能门锁美工岗位",
      subtitle: null,
      description: null,
      usage_instructions: "提供商品资料后执行视觉质检。",
      category: "电商美工",
      category_ref: "category:ecommerce_art_designer@1",
      listing_status: "draft",
      review_state: "draft",
      capabilities: [],
      manifest_summary: {},
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
      scopes: ["role.execute"],
      confirmation_points: 0,
      submitted_at: null,
      published_at: null,
    },
  ];
  return {
    catalogItems,
    reviewRequests,
    bindings,
    roleListings,
    async listDijieCatalogItems(filters?: Partial<DijieCatalogItemStorageRecord>) {
      return catalogItems.filter((item) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => item[key as keyof DijieCatalogItemStorageRecord] === value,
        ),
      );
    },
    async createDijieCatalogItems(data: DijieCatalogItemStorageRecord) {
      const stored = { ...data, id: `djcat_item_${catalogItems.length + 1}` };
      catalogItems.push(stored);
      return stored;
    },
    async updateDijieCatalogItems(
      data: Partial<DijieCatalogItemStorageRecord> & { id: string },
    ) {
      const index = catalogItems.findIndex((item) => item.id === data.id);
      if (index === -1) {
        return [];
      }
      catalogItems[index] = { ...catalogItems[index], ...data };
      return [catalogItems[index]];
    },
    async listDijieCatalogReviewRequests(filters?: Record<string, unknown>) {
      return reviewRequests.filter((item) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => item[key as keyof typeof item] === value,
        ),
      );
    },
    async createDijieCatalogReviewRequests(data: DijieCatalogReviewRequestStorageRecord) {
      const stored = { ...data, id: `djcat_review_${reviewRequests.length + 1}` };
      reviewRequests.push(stored);
      return stored;
    },
    async updateDijieCatalogReviewRequests(
      data: Partial<DijieCatalogReviewRequestStorageRecord> & { id: string },
    ) {
      const index = reviewRequests.findIndex((item) => item.id === data.id);
      if (index === -1) {
        return [];
      }
      reviewRequests[index] = { ...reviewRequests[index], ...data };
      return [reviewRequests[index]];
    },
    async listDijieSpecialCapabilityBindings(filters?: Record<string, unknown>) {
      return bindings.filter((item) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => item[key as keyof typeof item] === value,
        ),
      );
    },
    async createDijieSpecialCapabilityBindings(data: DijieSpecialCapabilityBindingStorageRecord) {
      const stored = { ...data, id: `djcapbind_${bindings.length + 1}` };
      bindings.push(stored);
      return stored;
    },
    async updateDijieSpecialCapabilityBindings(
      data: Partial<DijieSpecialCapabilityBindingStorageRecord> & { id: string },
    ) {
      const index = bindings.findIndex((item) => item.id === data.id);
      if (index === -1) {
        return [];
      }
      bindings[index] = { ...bindings[index], ...data };
      return [bindings[index]];
    },
    async listDijieRoleListings(filters?: Record<string, unknown>) {
      return roleListings.filter((item) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => item[key as keyof typeof item] === value,
        ),
      );
    },
  };
}

describe("Dijie catalog store", () => {
  it("removes implementation bodies and secrets from catalog boundary payloads", () => {
    const sanitized = sanitizeDijieCatalogBoundaryPayload({
      catalogRef: "tool:image.generate",
      version: "1.0.0",
      sourceCode: "export default async function run() {}",
      providerKey: "sk-secret",
      nested: {
        mcpServerImplementation: "stdio server code",
        permissionSummary: ["image.generate"],
      },
    });

    expect(sanitized).toEqual({
      catalogRef: "tool:image.generate",
      version: "1.0.0",
      nested: {
        permissionSummary: ["image.generate"],
      },
    });
  });

  it("lets stored catalog records override the built-in platform catalog", async () => {
    const repo = repository();
    repo.catalogItems.push(catalogRecord());

    const items = await listDijieEffectiveCatalogItemsWithRepository(repo);

    expect(items.find((item) => item.id === "tool.platform.image_inspector")).toMatchObject({
      status: "disabled",
      version: "1.0.1",
    });
  });

  it("deduplicates gap review requests and creates catalog items when approved", async () => {
    const repo = repository();
    const first = await createDijieCatalogReviewRequestsForPlanWithRepository(repo, {
      plan: planWithGap(),
      rolePackageId: "djpkg_video",
      requestedBy: "dev_001",
    });
    const second = await createDijieCatalogReviewRequestsForPlanWithRepository(repo, {
      plan: planWithGap(),
      rolePackageId: "djpkg_video",
      requestedBy: "dev_001",
    });

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      reviewId: "djcat_review_1",
      reviewKey: expect.any(String),
      need: "短视频质检",
      kind: "skill",
      source: "role_gap",
      status: "pending_review",
      rolePackageId: "djpkg_video",
      requestedBy: "dev_001",
    });
    expect(repo.reviewRequests).toHaveLength(1);

    const finalized = await finalizeDijieCatalogReviewRequestWithRepository(repo, {
      reviewId: first[0].reviewId!,
      result: "approved",
      reviewedBy: "marketplace_owner_001",
      reviewNote: "可先作为平台 skill 候选启用。",
    });

    expect(finalized).toEqual({ ok: true });
    expect(repo.reviewRequests[0]).toMatchObject({
      review_status: "approved",
      reviewed_by: "marketplace_owner_001",
    });
    expect(repo.catalogItems[0]).toMatchObject({
      catalog_status: "approved",
      reviewed_by: "marketplace_owner_001",
    });
    expect(repo.catalogItems[0].catalog_ref.startsWith("skill.platform.item-")).toBe(true);
  });

  it("stores role gaps as catalog review summaries instead of executable packages", async () => {
    const repo = repository();
    const unsafePlan = planWithGap();
    unsafePlan.gaps[0] = {
      ...unsafePlan.gaps[0],
      sourceCode: "console.log('should not be stored')",
      apiKey: "sk-secret",
      mcpServerImplementation: { command: "node", args: ["server.js"] },
    } as DijieRoleCapabilityPlan["gaps"][number];

    await createDijieCatalogReviewRequestsForPlanWithRepository(repo, {
      plan: unsafePlan,
      rolePackageId: "djpkg_video",
      requestedBy: "dev_001",
    });

    expect(JSON.stringify(repo.reviewRequests[0].payload)).not.toContain("sourceCode");
    expect(JSON.stringify(repo.reviewRequests[0].payload)).not.toContain("sk-secret");
    expect(JSON.stringify(repo.reviewRequests[0].payload)).not.toContain("server.js");
    expect(repo.reviewRequests[0].payload).toEqual({
      gap: {
        need: "短视频质检",
        kind: "skill",
        reason: "平台目录暂无短视频质检 skill。",
        nextAction: "search_external",
      },
    });
  });

  it("stores developer special capability requests as review facts without implementations", async () => {
    const repo = repository();

    const request = await createDijieSpecialCapabilityReviewRequestWithRepository(repo, {
      need: "智能门锁三维渲染质检",
      kind: "capability",
      reason: "当前电商美工基础品类包不包含三维渲染质检。",
      categoryRef: "category:ecommerce_art_designer@1",
      rolePackageId: "djpkg_smart_lock_designer",
      requestedBy: "dev_001",
      candidate: {
        providerKey: "sk-secret",
        sourceCode: "export default async function run() {}",
        businessScenario: "检查智能门锁 3D 渲染图是否和商品结构一致。",
      },
    });

    expect(request).toMatchObject({
      reviewId: "djcat_review_1",
      need: "智能门锁三维渲染质检",
      kind: "capability",
      source: "internal_build",
      status: "pending_review",
      rolePackageId: "djpkg_smart_lock_designer",
      requestedBy: "dev_001",
    });
    expect(repo.reviewRequests[0].candidate).toMatchObject({
      requestType: "special_capability_pack",
      categoryRef: "category:ecommerce_art_designer@1",
      businessScenario: "检查智能门锁 3D 渲染图是否和商品结构一致。",
    });
    expect(JSON.stringify(repo.reviewRequests[0])).not.toContain("sk-secret");
    expect(JSON.stringify(repo.reviewRequests[0])).not.toContain("sourceCode");
  });

  it("binds only approved special capability requests to owned role listings", async () => {
    const repo = repository();
    const request = await createDijieSpecialCapabilityReviewRequestWithRepository(repo, {
      need: "visual.3d_render.inspect",
      kind: "capability",
      categoryRef: "category:ecommerce_art_designer@1",
      rolePackageId: "djpkg_smart_lock_designer",
      requestedBy: "dev_001",
    });

    const pending = await bindDijieSpecialCapabilityToRoleWithRepository(repo, {
      reviewId: request.reviewId!,
      roleListingId: "djrole_123",
      boundBy: "dev_001",
      sellerId: "sel_001",
    });
    expect(pending).toMatchObject({
      ok: false,
      status: 409,
    });

    await finalizeDijieCatalogReviewRequestWithRepository(repo, {
      reviewId: request.reviewId!,
      result: "approved",
      reviewedBy: "marketplace_owner_001",
    });
    expect(repo.reviewRequests[0].catalog_ref).toBe("capability.platform.visual.3d_render.inspect");

    const first = await bindDijieSpecialCapabilityToRoleWithRepository(repo, {
      reviewId: request.reviewId!,
      roleListingId: "djrole_123",
      boundBy: "dev_001",
      sellerId: "sel_001",
    });
    const second = await bindDijieSpecialCapabilityToRoleWithRepository(repo, {
      reviewId: request.reviewId!,
      roleListingId: "djrole_123",
      boundBy: "dev_001",
      sellerId: "sel_001",
    });

    expect(first).toMatchObject({
      ok: true,
      binding: {
        bindingId: "djcapbind_1",
        reviewRequestId: request.reviewId,
        catalogRef: "capability.platform.visual.3d_render.inspect",
        roleListingId: "djrole_123",
        status: "bound",
      },
    });
    expect(second).toEqual(first);
    expect(repo.bindings).toHaveLength(1);
  });

  it("rejects special capability binding for another developer listing", async () => {
    const repo = repository();
    const request = await createDijieSpecialCapabilityReviewRequestWithRepository(repo, {
      need: "visual.3d_render.inspect",
      kind: "capability",
      categoryRef: "category:ecommerce_art_designer@1",
      rolePackageId: "djpkg_smart_lock_designer",
      requestedBy: "dev_001",
    });
    await finalizeDijieCatalogReviewRequestWithRepository(repo, {
      reviewId: request.reviewId!,
      result: "approved",
      reviewedBy: "marketplace_owner_001",
    });

    const result = await bindDijieSpecialCapabilityToRoleWithRepository(repo, {
      reviewId: request.reviewId!,
      roleListingId: "djrole_123",
      boundBy: "dev_other",
      sellerId: "sel_other",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(repo.bindings).toHaveLength(0);
  });

  it("stores remote API catalog entries as safe routing metadata only", async () => {
    const repo = repository();

    await repo.createDijieCatalogItems({
      ...catalogRecord({
        catalog_ref: "api.opencloud.image_generation",
        kind: "api",
        name: "图片生成 API 接入",
        source: "opencloud",
        permissions: ["image.generate", "human.confirm"],
        risk_level: "high",
      }),
      payload: sanitizeDijieCatalogBoundaryPayload({
        endpointSummary: "external image generation API",
        permissionSummary: ["image.generate", "human.confirm"],
        apiKey: "sk-secret",
        oauthAccessToken: "oauth-secret",
        rawResponse: { privateUrl: "https://provider.example/raw" },
        toolSchema: { implementation: "call provider directly" },
      }),
    });

    expect(repo.catalogItems[0].payload).toEqual({
      endpointSummary: "external image generation API",
      permissionSummary: ["image.generate", "human.confirm"],
    });
  });
});
