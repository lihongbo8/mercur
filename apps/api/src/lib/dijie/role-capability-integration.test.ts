import { describe, expect, it } from "bun:test";
import {
  listDijieRoleCapabilityIntegrationLegacyIssues,
  validateDijieRoleCapabilityIntegration,
} from "./role-capability-integration";

describe("validateDijieRoleCapabilityIntegration", () => {
  const categoryRegistry = {
    categories: [
      {
        categoryRef: "category:test@1",
        name: "测试品类",
        version: "1",
        description: "测试用平台品类。",
        status: "approved" as const,
        packBinding: {
          categoryPackRef: "categorypack:test@1",
          skillPackRef: "skillpack:test@1",
          toolPackRef: "toolpack:test@1",
          capabilityRefs: ["image.inspect", "audit.record"],
          catalogRefs: ["skillpack:test@1", "toolpack:test@1", "tool:image.inspect@1"],
          permissionSummary: ["image.inspect", "audit.record"],
        },
      },
    ],
  };

  it("accepts listings bound to an approved platform category pack", () => {
    expect(
      validateDijieRoleCapabilityIntegration({
        categoryRef: "category:test@1",
        categoryRegistry,
        manifestSummary: {
          requiredTools: [
            {
              catalogRef: "tool:image.inspect@1",
              status: "approved",
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: true,
      missing: [],
      blocked: [],
      inheritedCatalogRefs: expect.arrayContaining([
        "categorypack:test@1",
        "skillpack:test@1",
        "toolpack:test@1",
      ]),
    });
  });

  it("rejects listings without a platform category", () => {
    expect(
      validateDijieRoleCapabilityIntegration({
        manifestSummary: {
          requiredTools: [
            {
              catalogRef: "tool:image.inspect@1",
              status: "approved",
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: false,
      missing: ["categoryRef"],
    });
  });

  it("ignores manifest Skill/Tool fields and special requests when an approved category pack is bound", () => {
    expect(
      validateDijieRoleCapabilityIntegration({
        categoryRef: "category:test@1",
        categoryRegistry,
        manifestSummary: {
          requiredSkills: [{ name: "图片规格审核" }],
          specialCapabilityRequests: [
            {
              requestRef: "special:image.generate",
              need: "图片生成",
              status: "pending_review",
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: true,
      missing: [],
      blocked: [],
      inheritedCatalogRefs: expect.arrayContaining([
        "categorypack:test@1",
        "skillpack:test@1",
        "toolpack:test@1",
      ]),
    });
  });
});

describe("listDijieRoleCapabilityIntegrationLegacyIssues", () => {
  it("reports approved public or re-publishable listings with missing capability integration", () => {
    const issues = listDijieRoleCapabilityIntegrationLegacyIssues([
      {
        id: "djrole_legacy_published",
        title: "旧版已发布岗位",
        listing_status: "published",
        review_state: "approved",
        manifest_summary: {
          requiredCapabilities: ["image.inspect"],
        },
      },
      {
        id: "djrole_legacy_delisted",
        title: "旧版已审核下架岗位",
        listing_status: "delisted",
        review_state: "approved",
        manifest_summary: {
          requiredTools: [{ catalogRef: "tool:image.inspect@1", status: "pending_review" }],
        },
      },
      {
        id: "djrole_catalog_only",
        title: "只带旧 catalogRefs 的岗位",
        listing_status: "published",
        review_state: "approved",
        manifest_summary: {
          requiredSkills: [{ catalogRef: "skill:image-review@1", status: "approved" }],
        },
      },
      {
        id: "djrole_draft",
        title: "草稿岗位",
        listing_status: "draft",
        review_state: "draft",
        manifest_summary: {},
      },
    ]);

    expect(issues).toEqual([
      expect.objectContaining({
        roleListingId: "djrole_legacy_published",
        title: "旧版已发布岗位",
        listingStatus: "published",
        reviewState: "approved",
        missing: ["categoryRef"],
      }),
      expect.objectContaining({
        roleListingId: "djrole_legacy_delisted",
        title: "旧版已审核下架岗位",
        listingStatus: "delisted",
        reviewState: "approved",
        missing: ["categoryRef"],
      }),
      expect.objectContaining({
        roleListingId: "djrole_catalog_only",
        title: "只带旧 catalogRefs 的岗位",
        listingStatus: "published",
        reviewState: "approved",
        missing: ["categoryRef"],
      }),
    ]);
  });
});
