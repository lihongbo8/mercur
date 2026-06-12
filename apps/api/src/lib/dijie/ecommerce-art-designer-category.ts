import type { DijieRoleCategory } from "./role-category-registry";

export const DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF =
  "category:ecommerce_art_designer@1";
export const DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF =
  "categorypack:ecommerce_art_designer@1";
export const DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF =
  "skillpack:ecommerce_art_designer@1";
export const DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF =
  "toolpack:ecommerce_art_designer@1";

export const DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_NAME = "电商美工";

export const DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_SUMMARY = [
  "商品资料理解",
  "主图/详情页视觉标准",
  "图组规划",
  "产品保真自检",
  "问题记录",
  "交付/周报/月报规则",
] as const;

export const DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_CAPABILITY_REFS = [
  "workspace.read",
  "workspace.write",
  "document.write",
  "image.inspect",
  "image.generate",
  "workboard.task",
  "scheduler.cadence",
  "human.confirm",
  "audit.record",
] as const;

export const DIJIE_ECOMMERCE_ART_DESIGNER_CATALOG_REFS = [
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
  DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
  "capability:workspace.read",
  "capability:workspace.write",
  "capability:document.write",
  "capability:image.inspect",
  "capability:image.generate",
  "capability:workboard.task",
  "capability:scheduler.cadence",
  "capability:human.confirm@1.0.0",
  "capability:audit.record",
] as const;

export function createDijieEcommerceArtDesignerCategory(): DijieRoleCategory {
  return {
    categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
    name: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_NAME,
    version: "1",
    description:
      "平台审核通过的电商美工品类，用于商品资料理解、图组规划、视觉交付、自检和经营节奏记录。",
    status: "approved",
    reviewedAt: "2026-06-11T00:00:00.000Z",
    reviewedBy: "platform_seed",
    packBinding: {
      categoryPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_PACK_REF,
      skillPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_PACK_REF,
      toolPackRef: DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_PACK_REF,
      riskPolicyRef: "riskpolicy:ecommerce_art_designer@1",
      reviewPolicyRef: "reviewpolicy:ecommerce_art_designer@1",
      capabilityRefs: [...DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_CAPABILITY_REFS],
      catalogRefs: [...DIJIE_ECOMMERCE_ART_DESIGNER_CATALOG_REFS],
      permissionSummary: [
        ...DIJIE_ECOMMERCE_ART_DESIGNER_SKILL_SUMMARY,
        ...DIJIE_ECOMMERCE_ART_DESIGNER_TOOL_CAPABILITY_REFS,
        "不默认包含店铺后台、素材库、抠图、视频生成或爬虫能力",
        "图像生成仅作为能力引用，不包含第三方 provider key 或工具源码",
      ],
    },
  };
}

export function createDijieEcommerceArtDesignerCategoryStorageRecord() {
  const category = createDijieEcommerceArtDesignerCategory();

  return {
    category_ref: category.categoryRef,
    name: category.name,
    version: category.version,
    description: category.description,
    category_status: category.status,
    pack_binding: category.packBinding,
    risk_policy: {
      riskPolicyRef: category.packBinding?.riskPolicyRef,
      defaultRisk: "medium",
      humanGateRefs: ["human.confirm"],
      forbiddenDefaults: ["storefront.admin", "asset_library", "matting", "video.generate", "crawler"],
    },
    review_policy: {
      reviewPolicyRef: category.packBinding?.reviewPolicyRef,
      requiresApprovedCategory: true,
      requiresApprovedSpecialCapabilities: true,
      seedOnlyV1: true,
    },
    reviewed_at: category.reviewedAt ? new Date(category.reviewedAt) : null,
    reviewed_by: category.reviewedBy ?? null,
  };
}
