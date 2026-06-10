import { describe, expect, it } from "bun:test";
import {
  createDijieCatalogReviewRequestsForPlanWithRepository,
  finalizeDijieCatalogReviewRequestWithRepository,
  listDijieEffectiveCatalogItemsWithRepository,
  type DijieCatalogItemStorageRecord,
  type DijieCatalogReviewRequestStorageRecord,
} from "./catalog-store";
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
  return {
    catalogItems,
    reviewRequests,
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
  };
}

describe("Dijie catalog store", () => {
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
});
