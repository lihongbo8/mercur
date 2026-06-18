import { describe, expect, it } from "bun:test";
import { validateDijieRoleCategoryIntegration } from "./role-category-registry";

const approvedCategory = {
  categoryRef: "category:general_ops@1",
  name: "通用运营",
  version: "1",
  description: "平台审核通过的通用运营品类。",
  status: "approved" as const,
  packBinding: {
    categoryPackRef: "categorypack:general_ops@1",
    skillPackRef: "skillpack:general_ops@1",
    toolPackRef: "toolpack:general_ops@1",
    capabilityRefs: ["document.write", "audit.record"],
    catalogRefs: ["skillpack:general_ops@1", "toolpack:general_ops@1"],
    permissionSummary: ["document.write", "audit.record"],
  },
};

describe("validateDijieRoleCategoryIntegration", () => {
  it("rejects roles that did not choose a platform category", () => {
    expect(validateDijieRoleCategoryIntegration({})).toMatchObject({
      ok: false,
      missing: ["categoryRef"],
    });
  });

  it("rejects unknown, disabled, or unpacked categories", () => {
    expect(
      validateDijieRoleCategoryIntegration({
        categoryRef: "category:missing@1",
        registry: { categories: [] },
      }),
    ).toMatchObject({
      ok: false,
      missing: ["category:missing@1"],
    });

    expect(
      validateDijieRoleCategoryIntegration({
        categoryRef: "category:disabled@1",
        registry: {
          categories: [
            {
              ...approvedCategory,
              categoryRef: "category:disabled@1",
              status: "disabled",
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: false,
      blocked: ["category:disabled@1: disabled"],
    });

    expect(
      validateDijieRoleCategoryIntegration({
        categoryRef: "category:empty@1",
        registry: {
          categories: [
            {
              ...approvedCategory,
              categoryRef: "category:empty@1",
              packBinding: null,
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: false,
      missing: ["category:empty@1: category_pack_binding"],
    });
  });

  it("inherits approved category pack refs without accepting manifest special requests", () => {
    expect(
      validateDijieRoleCategoryIntegration({
        categoryRef: "category:general_ops@1",
        registry: { categories: [approvedCategory] },
      }),
    ).toMatchObject({
      ok: true,
      inheritedCatalogRefs: expect.arrayContaining([
        "categorypack:general_ops@1",
        "skillpack:general_ops@1",
        "toolpack:general_ops@1",
      ]),
      inheritedCapabilityRefs: ["document.write", "audit.record"],
    });

    expect(
      validateDijieRoleCategoryIntegration({
        categoryRef: "category:general_ops@1",
        registry: { categories: [approvedCategory] },
        manifestSummary: {
          specialCapabilityRequests: [
            {
              requestRef: "special:private-api",
              need: "企业私有 API",
              status: "pending_review",
            },
          ],
        },
      }),
    ).toMatchObject({
      ok: true,
      specialCapabilityRequests: [],
    });
  });
});
