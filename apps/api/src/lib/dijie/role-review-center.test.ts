import { describe, expect, it } from "bun:test";
import {
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
  createDijieEcommerceArtDesignerCategory,
} from "./ecommerce-art-designer-category";
import { createDijieReviewCenterReadModel } from "./role-review-center";

function roleProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_image_review_role",
    title: "商品图检查岗位",
    subtitle: "检查商品图是否清晰、合规、适合上架。",
    status: "proposed",
    seller: { id: "dev_001", name: "迭界开发者" },
    metadata: {
      dijieRole: {
        kind: "role_product",
        protocolVersion: "2026-05",
        packageId: "pkg_image_review_role",
        packageVersion: "1.0.0",
        developerRef: "dev_001",
        listingStatus: "proposed",
        reviewState: "submitted",
        usageInstructions:
          "使用者需要上传商品图、说明品牌卖点、目标平台、风格限制和人工确认标准。",
        capabilities: ["商品图检查", "违规风险提示"],
        manifestSummary: {
          entrypoint: "role_package/manifest.json",
          requiredCapabilities: ["workspace.read", "browser.use"],
          requiredTools: [
            {
              need: "浏览器审核",
              catalogRef: "tool.platform.browser_review",
              status: "bindable",
            },
          ],
          sandbox: "workspace-write",
        },
        pricing: {
          kind: "one_time_authorization",
          authorizationFeeCents: 19900,
          currency: "CNY",
          platformFeeBps: 0,
          developerReceivableCents: 19900,
        },
        roleTokenPricing: {
          inputTokenCentsPerMillion: 120,
          outputTokenCentsPerMillion: 360,
          currency: "CNY",
          developerReceivableBps: 10000,
          platformFeeBps: 0,
        },
        ...overrides,
      },
    },
  };
}

describe("Dijie review center read model", () => {
  it("projects stored role listings as the primary admin review queue", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_image_review",
          package_id: "djpkg_image_review",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "商品图检查岗位",
          subtitle: "检查商品图是否清晰、合规、适合上架。",
          listing_status: "proposed",
          review_state: "submitted",
          usage_instructions:
            "使用者需要上传商品图、说明品牌卖点、目标平台、风格限制和人工确认标准。",
          manifest_summary: {
            requiredCapabilities: ["workspace.read", "browser.use"],
            requiredTools: [
              {
                need: "浏览器审核",
                catalogRef: "tool.platform.browser_review",
                status: "bindable",
              },
            ],
          },
          pricing: { currency: "CNY" },
          confirmation_points: 2,
        },
      ],
      { adminAccountId: "admin_001" },
    );

    expect(model).toMatchObject({
      sampleRoleTitle: "商品图检查岗位",
      dialogContext: {
        subject: {
          roleListingId: "djrole_image_review",
          packageId: "djpkg_image_review",
          reviewId: "review_djrole_image_review",
        },
      },
      statusPanel: {
        pendingRoles: 1,
      },
    });
    expect(model.queue[0]).toMatchObject({
      id: "djrole_image_review",
      packageId: "djpkg_image_review",
      reviewState: "submitted",
      listingStatus: "proposed",
      requiredCapabilities: ["workspace.read", "browser.use"],
    });
  });

  it("shows ecommerce art designer category and inherited capability gate", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_ecommerce_art",
          package_id: "djpkg_ecommerce_art",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "智能门锁电商美工岗位",
          subtitle: "生成和检查电商商品图组。",
          category: "电商美工",
          category_ref: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
          listing_status: "proposed",
          review_state: "submitted",
          usage_instructions:
            "使用者需要提供商品资料、目标平台、风格限制和人工确认标准。",
          manifest_summary: {
            requiredCapabilities: ["image.inspect", "image.generate"],
          },
          pricing: { currency: "CNY" },
        },
      ],
      {
        categoryRegistry: {
          categories: [createDijieEcommerceArtDesignerCategory()],
        },
      },
    );

    const categoryGate = model.queue[0].capabilityChecks.find(
      (item) => item.id === "platform_category",
    );

    expect(model.queue[0]).toMatchObject({
      categoryRef: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
    });
    expect(categoryGate).toMatchObject({
      status: "pass",
      label: "平台品类",
    });
    expect(categoryGate?.note).toContain("电商美工");
    expect(categoryGate?.note).toContain("继承");
  });

  it("keeps a stable action review id after a stored review exists", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_image_review",
          package_id: "djpkg_image_review",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "商品图检查岗位",
          listing_status: "proposed",
          review_state: "submitted",
          manifest_summary: {
            requiredCapabilities: ["workspace.read", "browser.use"],
            requiredTools: [
              {
                need: "浏览器审核",
                catalogRef: "tool.platform.browser_review",
                status: "bindable",
              },
            ],
          },
        },
      ],
      {
        reviews: [
          {
            id: "djreview_image_review",
            role_listing_id: "djrole_image_review",
            reviewer_id: "admin_001",
            role_standard_decision: "pass",
            safety_compliance_decision: "pending",
            pricing_reasonability_decision: "pending",
            final_result: "pending",
            summary: null,
            records: [],
            finalized_at: null,
          },
        ],
      },
    );

    expect(model.queue[0]).toMatchObject({
      reviewId: "review_djrole_image_review",
      evaluations: {
        roleStandard: "pass",
        safetyCompliance: "pending",
        pricingReasonability: "pending",
      },
    });
  });

  it("does not treat image.inspect inspection roles as missing image understanding", () => {
    const model = createDijieReviewCenterReadModel([
      {
        id: "djrole_image_inspect",
        package_id: "djpkg_image_inspect",
        package_version: "1.0.0",
        developer_ref: "acct_dev",
        title: "智能门锁电商美工岗位",
        description: "提供主图巡检、商品图检查和详情页优化清单。",
        listing_status: "proposed",
        review_state: "submitted",
        manifest_summary: {
          requiredCapabilities: ["image.inspect", "audit.record"],
        },
        pricing: { currency: "CNY" },
      },
    ]);

    const imageUnderstanding = model.queue[0].specialtyChecks.find(
      (item) => item.id === "image_understanding",
    );

    expect(imageUnderstanding).toMatchObject({
      status: "pass",
    });
    expect(model.queue[0].statusReason).not.toContain("图片理解");
  });

  it("blocks category pack integration that is no longer approved in the platform catalog", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_image_inspect",
          package_id: "djpkg_image_inspect",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "智能门锁电商美工岗位",
          description: "提供主图巡检、商品图检查和详情页优化清单。",
          listing_status: "proposed",
          review_state: "submitted",
          usage_instructions:
            "使用者需要上传商品图、目标平台、风格限制和人工确认标准。",
          manifest_summary: {
            requiredCapabilities: ["image.inspect", "audit.record"],
            requiredTools: [
              {
                need: "图片理解",
                catalogRef: "tool.platform.image_inspector",
                status: "bindable",
              },
            ],
          },
          pricing: { currency: "CNY" },
        },
      ],
      {
        catalogItems: [
          {
            id: "tool.platform.image_inspector",
            kind: "tool",
            name: "图片理解工具",
            version: "1.0.0",
            description: "平台禁用的图片理解工具。",
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
      },
    );

    const catalogCheck = model.queue[0].capabilityChecks.find(
      (item) => item.id === "platform_category",
    );

    expect(catalogCheck).toMatchObject({
      status: "blocked",
    });
    expect(model.queue[0].statusReason).toContain("需处理");
  });

  it("does not allow approval while automatic blocking checks remain", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_blocked_designer",
          package_id: "djpkg_blocked_designer",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "商品图美工岗位",
          listing_status: "proposed",
          review_state: "submitted",
          manifest_summary: {
            requiredCapabilities: ["workspace.read"],
          },
          pricing: { currency: "CNY" },
        },
      ],
      {
        reviews: [
          {
            id: "djreview_blocked_designer",
            role_listing_id: "djrole_blocked_designer",
            reviewer_id: "admin_001",
            role_standard_decision: "pass",
            safety_compliance_decision: "pass",
            pricing_reasonability_decision: "pass",
            final_result: "pending",
            summary: null,
            records: [],
            finalized_at: null,
          },
        ],
      },
    );

    expect(model.queue[0].statusReason).toContain("需处理");
    expect(model.queue[0].allowedActions).toContain("save_evaluations");
    expect(model.queue[0].allowedActions).not.toContain("finalize_approved");
  });

  it("requires completed category pack integration before approval", () => {
    const model = createDijieReviewCenterReadModel(
      [
        {
          id: "djrole_missing_integration",
          package_id: "djpkg_missing_integration",
          package_version: "1.0.0",
          developer_ref: "acct_dev",
          title: "智能门锁电商美工岗位",
          description: "提供主图巡检、商品图检查和详情页优化清单。",
          listing_status: "proposed",
          review_state: "submitted",
          usage_instructions:
            "使用者需要上传商品图、目标平台、风格限制和人工确认标准。",
          manifest_summary: {
            requiredCapabilities: ["image.inspect", "audit.record"],
          },
          pricing: {
            authorizationFeeCents: 39900,
            currency: "CNY",
            platformFeeBps: 0,
            developerReceivableCents: 39900,
            developerReceivableBps: 10000,
          },
          role_token_pricing: {
            inputTokenCentsPerMillion: 120,
            outputTokenCentsPerMillion: 360,
            currency: "CNY",
            developerReceivableBps: 10000,
            platformFeeBps: 0,
          },
        },
      ],
      {
        reviews: [
          {
            id: "djreview_missing_integration",
            role_listing_id: "djrole_missing_integration",
            reviewer_id: "admin_001",
            role_standard_decision: "pass",
            safety_compliance_decision: "pass",
            pricing_reasonability_decision: "pass",
            final_result: "pending",
            summary: null,
            records: [],
            finalized_at: null,
          },
        ],
      },
    );

    const catalogCheck = model.queue[0].safetyChecks.find(
      (item) => item.id === "catalog_binding_review",
    );

    expect(catalogCheck).toMatchObject({
      status: "blocked",
    });
    expect(catalogCheck?.note).toContain("品类");
    expect(model.queue[0].allowedActions).not.toContain("finalize_approved");
  });

  it("shows post-approval missing fields as review suggestions instead of blockers", () => {
    const model = createDijieReviewCenterReadModel([
      {
        id: "djrole_approved_designer",
        package_id: "djpkg_approved_designer",
        package_version: "1.0.0",
        developer_ref: "acct_dev",
        title: "智能门锁电商美工岗位",
        description: "提供主图巡检、设计方案输出和详情页优化清单。",
        listing_status: "published",
        review_state: "approved",
        usage_instructions: null,
        manifest_summary: {
          requiredCapabilities: [
            "image.inspect",
            "image.generate",
            "document.write",
            "audit.record",
          ],
        },
        pricing: {
          authorizationFeeCents: 39900,
          currency: "CNY",
          platformFeeBps: 0,
          developerReceivableCents: 39900,
          developerReceivableBps: 10000,
        },
        role_token_pricing: {
          inputTokenCentsPerMillion: 120,
          outputTokenCentsPerMillion: 360,
          currency: "CNY",
          developerReceivableBps: 10000,
          platformFeeBps: 0,
        },
      },
    ]);

    expect(model.queue[0]).toMatchObject({
      reviewState: "approved",
      listingStatus: "published",
      allowedActions: [],
    });
    expect(model.queue[0].statusReason).toContain("复核建议");
    expect(model.queue[0].statusReason).not.toContain("需处理");
    expect(
      [
        ...model.queue[0].capabilityChecks,
        ...model.queue[0].specialtyChecks,
        ...model.queue[0].safetyChecks,
        ...model.queue[0].pricingSummary.checks,
      ].some((item) => item.status === "blocked"),
    ).toBe(false);
  });

  it("projects the admin UI as one role review with checklist items", () => {
    const model = createDijieReviewCenterReadModel([roleProduct()], {
      adminAccountId: "admin_001",
    });

    expect(model).toMatchObject({
      title: "审核中心",
      sampleRoleTitle: "商品图检查岗位",
      dialogContext: {
        accountId: "admin_001",
        accountType: "admin",
        surface: "admin_review",
        mode: "review",
        subject: {
          roleListingId: "prod_image_review_role",
          packageId: "pkg_image_review_role",
          reviewId: "review_prod_image_review_role",
        },
        billingAccountId: "admin_001",
      },
      statusPanel: {
        pendingRoles: 1,
        materialCompleteness: "已完整",
        safetySummary: "未命中敏感项",
        pricingAndBilling: "已配置",
        auditReadback: "脱敏",
        confirmationPoints: 2,
      },
      reviewChecklist: [
        { id: "public_materials", title: "公开材料" },
        { id: "usage_instructions", title: "使用规范" },
        { id: "safety_summary", title: "安全摘要" },
        { id: "pricing_confirmation", title: "价格确认" },
      ],
    });
    expect(model.queue).toHaveLength(1);
    expect(model.queue[0]).toMatchObject({
      id: "prod_image_review_role",
      title: "商品图检查岗位",
      packageId: "pkg_image_review_role",
      packageVersion: "1.0.0",
      reviewState: "submitted",
      reviewStateLabel: "待审核",
      listingStatus: "proposed",
      developerName: "迭界开发者",
    });
  });

  it("does not expose an agent model or raw role metadata", () => {
    const model = createDijieReviewCenterReadModel([roleProduct()]);
    const serialized = JSON.stringify(model);

    expect(serialized).not.toContain('"agents"');
    expect(serialized).not.toContain("三智能体");
    expect(serialized).not.toContain("metadata.dijieRole");
    expect(serialized).not.toContain("roleTokenPricing");
    expect(serialized).not.toContain("authorizationFeeCents");
  });

  it("keeps the page in a truthful empty state when no role review exists", () => {
    const model = createDijieReviewCenterReadModel([]);

    expect(model.sampleRoleTitle).toBeNull();
    expect(model.statusPanel.pendingRoles).toBe(0);
    expect(model.queue).toEqual([]);
    expect(model.emptyState).toBe(
      "暂无岗位审核提交，后端接入后会显示真实审核队列。",
    );
  });
});
