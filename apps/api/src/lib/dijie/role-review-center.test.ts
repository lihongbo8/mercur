import { describe, expect, it } from "bun:test";
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
        capabilities: ["商品图检查", "违规风险提示"],
        manifestSummary: {
          entrypoint: "role_package/manifest.json",
          requiredCapabilities: ["workspace.read", "browser.use"],
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
          manifest_summary: {
            requiredCapabilities: ["workspace.read", "browser.use"],
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
    expect(model.emptyState).toBe("暂无岗位审核提交，后端接入后会显示真实审核队列。");
  });
});
