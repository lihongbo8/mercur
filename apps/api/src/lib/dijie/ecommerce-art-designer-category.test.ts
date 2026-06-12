import { describe, expect, it } from "bun:test";
import {
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_NAME,
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
  createDijieEcommerceArtDesignerCategory,
  createDijieEcommerceArtDesignerCategoryStorageRecord,
} from "./ecommerce-art-designer-category";
import { validateDijieRoleCategoryIntegration } from "./role-category-registry";

describe("ecommerce art designer category seed definition", () => {
  it("defines the approved platform category and package refs", () => {
    const category = createDijieEcommerceArtDesignerCategory();

    expect(category).toMatchObject({
      categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
      name: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_NAME,
      status: "approved",
      packBinding: {
        categoryPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
        skillPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
        toolPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
      },
    });
    expect(category.packBinding?.capabilityRefs).toEqual(
      expect.arrayContaining([
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
    );
    expect(JSON.stringify(category)).not.toContain("provider_key");
    expect(JSON.stringify(category)).not.toContain("sourceCode");
    expect(JSON.stringify(category)).not.toContain("mcpServer");
  });

  it("can be used by the category integration gate", () => {
    const category = createDijieEcommerceArtDesignerCategory();
    const result = validateDijieRoleCategoryIntegration({
      categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
      registry: { categories: [category] },
    });

    expect(result).toMatchObject({
      ok: true,
      category: {
        name: "电商美工",
      },
      inheritedCatalogRefs: expect.arrayContaining([
        DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
        DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
        DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
      ]),
      inheritedCapabilityRefs: expect.arrayContaining([
        "image.generate",
        "human.confirm",
        "audit.record",
      ]),
    });
  });

  it("stores only metadata, review facts, and refs", () => {
    const record = createDijieEcommerceArtDesignerCategoryStorageRecord();

    expect(record).toMatchObject({
      category_ref: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
      name: "电商美工",
      category_status: "approved",
      reviewed_by: "platform_seed",
    });
    expect(JSON.stringify(record)).not.toContain("apiKey");
    expect(JSON.stringify(record)).not.toContain("oauthToken");
    expect(JSON.stringify(record)).not.toContain("/Users/");
    expect(JSON.stringify(record)).not.toContain("rawRequest");
  });
});
