import { describe, expect, it } from "bun:test";
import {
  finalizeDijieRoleReviewWithRepository,
  saveDijieRoleReviewEvaluationsWithRepository,
  type DijieRoleReviewStorageRecord,
} from "./role-review-store";
import type { DijieRoleListingStorageRecord } from "./role-listing-store";
import {
  testDijieRoleListingStorageRecord,
  type TestDijieRoleReviewRepository,
} from "./test-fixtures.test";

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
        capabilityRefs: ["workspace.read", "image.inspect"],
        catalogRefs: ["skillpack:image_review@1", "toolpack:image_review@1"],
        permissionSummary: ["workspace.read", "image.inspect"],
      },
    },
  ],
};

function roleListing(
  overrides: Partial<DijieRoleListingStorageRecord & { id: string }> = {},
) {
  return testDijieRoleListingStorageRecord({
    id: "djrole_image_review",
    package_id: "djpkg_image_review",
    package_version: "1.0.0",
    owner_id: "acct_dev",
    developer_ref: "acct_dev",
    listing_owner_ref: "acct_dev",
    billing_beneficiary_ref: "acct_dev",
    subtitle: "检查商品图是否清晰、合规、适合上架。",
    description: null,
    category: "图片审核",
    category_ref: "category:image_review@1",
    listing_status: "proposed",
    review_state: "submitted",
    capabilities: ["workspace.read"],
    manifest_summary: {
      entrypoint: "role_package/manifest.json",
      requiredCapabilities: ["workspace.read"],
      requiredTools: [
        {
          need: "图片理解",
          catalogRef: "tool.platform.image_inspector",
          status: "bindable",
        },
      ],
      sandbox: "workspace-write",
    },
    confirmation_points: 2,
    submitted_at: new Date("2026-06-04T10:00:00.000Z"),
    ...overrides,
  });
}

function repository(input: {
  listings?: Array<DijieRoleListingStorageRecord & { id: string }>;
  reviews?: Array<DijieRoleReviewStorageRecord & { id: string }>;
}): TestDijieRoleReviewRepository {
  const listings = input.listings ?? [roleListing()];
  const reviews = input.reviews ?? [];

  return {
    createDijieRoleReviews: async (
      data: Omit<DijieRoleReviewStorageRecord, "id">,
    ) => {
      const review = { ...data, id: `djreview_${data.role_listing_id}` };
      reviews.push(review);
      return review;
    },
    listDijieRoleReviews: async (filters?: Record<string, unknown>) =>
      reviews.filter((review) =>
        filters?.role_listing_id
          ? review.role_listing_id === filters.role_listing_id
          : true,
      ),
    updateDijieRoleReviews: async (
      data: Partial<Omit<DijieRoleReviewStorageRecord, "id">> & { id: string },
    ) => {
      const index = reviews.findIndex((review) => review.id === data.id);
      if (index < 0) {
        throw new Error("review not found");
      }
      reviews[index] = { ...reviews[index], ...data };
      return reviews[index];
    },
    listDijieRoleListings: async (filters?: Record<string, unknown>) =>
      listings.filter((listing) =>
        filters?.id ? listing.id === filters.id : true,
      ),
    updateDijieRoleListings: async (
      data: Partial<Omit<DijieRoleListingStorageRecord, "id">> & { id: string },
    ) => {
      const index = listings.findIndex((listing) => listing.id === data.id);
      if (index < 0) {
        throw new Error("listing not found");
      }
      listings[index] = { ...listings[index], ...data };
      return listings[index];
    },
  };
}

describe("Dijie role review store", () => {
  it("saves the three human evaluation decisions for a submitted listing", async () => {
    const repo = repository({});

    const result = await saveDijieRoleReviewEvaluationsWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      roleStandardDecision: "pass",
      safetyComplianceDecision: "needs_changes",
      pricingReasonabilityDecision: "pass",
      summary: "需要补充生成结果样例。",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        roleListingId: "djrole_image_review",
        review: {
          reviewer_id: "admin_001",
          role_standard_decision: "pass",
          safety_compliance_decision: "needs_changes",
          pricing_reasonability_decision: "pass",
          summary: "需要补充生成结果样例。",
        },
      },
    });
  });

  it("does not approve until all three evaluations pass", async () => {
    const repo = repository({});
    await saveDijieRoleReviewEvaluationsWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      roleStandardDecision: "pass",
      safetyComplianceDecision: "needs_changes",
      pricingReasonabilityDecision: "pass",
    });

    const result = await finalizeDijieRoleReviewWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      finalResult: "approved",
      summary: "通过。",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("marks the listing approved without publishing after all evaluations pass", async () => {
    const repo = repository({});
    await saveDijieRoleReviewEvaluationsWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      roleStandardDecision: "pass",
      safetyComplianceDecision: "pass",
      pricingReasonabilityDecision: "pass",
    });

    const result = await finalizeDijieRoleReviewWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      finalResult: "approved",
      summary: "三项评估通过。",
      categoryRegistry,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        review: {
          final_result: "approved",
          summary: "三项评估通过。",
        },
        listing: {
          listing_status: "delisted",
          review_state: "approved",
          published_at: null,
        },
      },
    });
  });

  it("does not approve when category pack integration has not been completed", async () => {
    const repo = repository({
      listings: [
        roleListing({
          manifest_summary: {
            entrypoint: "role_package/manifest.json",
            requiredCapabilities: ["workspace.read"],
            sandbox: "workspace-write",
          },
        }),
      ],
    });
    await saveDijieRoleReviewEvaluationsWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      roleStandardDecision: "pass",
      safetyComplianceDecision: "pass",
      pricingReasonabilityDecision: "pass",
    });

    const result = await finalizeDijieRoleReviewWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      finalResult: "approved",
      summary: "三项评估通过。",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(result.ok ? "" : result.error).toContain("品类");
  });

  it("returns a listing to draft when the reviewer requests changes", async () => {
    const repo = repository({});
    await saveDijieRoleReviewEvaluationsWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      roleStandardDecision: "needs_changes",
      safetyComplianceDecision: "pass",
      pricingReasonabilityDecision: "pass",
    });

    const result = await finalizeDijieRoleReviewWithRepository(repo, {
      roleListingId: "djrole_image_review",
      reviewerId: "admin_001",
      finalResult: "needs_changes",
      summary: "需要补充岗位输出样例。",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        review: {
          final_result: "needs_changes",
        },
        listing: {
          listing_status: "draft",
          review_state: "needs_changes",
        },
      },
    });
  });
});
