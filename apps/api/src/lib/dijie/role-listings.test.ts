import { describe, expect, it } from "bun:test";
import {
  createDijieRoleDetailReadModel,
  createDijieInstalledRolesFromMarketplaceFacts,
  createDijieRoleListingFromProduct,
} from "./role-listings";

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

const publicRoleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
};

const usageInstructions =
  "使用者需要提供业务目标、素材来源、限制条件和人工确认标准后再发起任务。";

const roleProduct = {
  id: "prod_role_researcher",
  title: "资料研究岗位",
  subtitle: "整理资料并输出简报",
  description: "适合做资料收集和结构化总结。",
  handle: "research-role",
  status: "published",
  seller: {
    id: "dev_001",
    name: "迭界开发者",
  },
  metadata: {
    dijieRole: {
      kind: "role_product",
      protocolVersion: "2026-05",
      packageId: "pkg_researcher",
      packageVersion: "1.0.0",
      developerRef: "dev_001",
      listingStatus: "published",
      reviewState: "approved",
      usageInstructions,
      capabilities: ["资料收集"],
      pricing: {
        kind: "one_time_authorization",
        authorizationFeeCents: 19900,
        currency: "CNY",
        platformFeeBps: 0,
        developerReceivableCents: 19900,
      },
      roleTokenPricing,
    },
  },
};

describe("Dijie role listing projection", () => {
  it("creates a public role listing from Mercur product facts", () => {
    expect(createDijieRoleListingFromProduct(roleProduct)).toEqual({
      id: "prod_role_researcher",
      title: "资料研究岗位",
      subtitle: "整理资料并输出简报",
      description: "适合做资料收集和结构化总结。",
      usageInstructions,
      handle: "research-role",
      listingStatus: "published",
      reviewState: "approved",
      developerId: "dev_001",
      developerName: "迭界开发者",
      packageId: "pkg_researcher",
      packageVersion: "1.0.0",
      protocolVersion: "2026-05",
      capabilities: ["资料收集"],
      pricing: {
        kind: "one_time_authorization",
        authorizationFeeCents: 19900,
        currency: "CNY",
        platformFeeBps: 0,
        developerReceivableCents: 19900,
      },
      roleTokenPricing,
      scopes: ["role.execute", "audit.write"],
    });
  });

  it("creates a buyer role detail read model without raw marketplace metadata", () => {
    const listing = createDijieRoleListingFromProduct(roleProduct);
    const related = createDijieRoleListingFromProduct({
      ...roleProduct,
      id: "prod_role_writer",
      title: "商品文案岗位",
      subtitle: "整理商品卖点并生成文案",
      handle: "writer-role",
      metadata: {
        dijieRole: {
          ...(roleProduct.metadata.dijieRole as Record<string, unknown>),
          packageId: "pkg_writer",
        },
      },
    });

    expect(listing).toBeDefined();
    expect(related).toBeDefined();
    const detail = createDijieRoleDetailReadModel(listing!, [
      listing!,
      related!,
    ]);

    expect(detail).toMatchObject({
      id: "prod_role_researcher",
      title: "资料研究岗位",
      detailSections: {
        roleDetails: ["适合做资料收集和结构化总结。", "整理资料并输出简报"],
        usageInstructions: [usageInstructions],
        requiredCapabilities: ["资料收集"],
      },
      authorizationSummary: {
        authorizationFeeCents: 19900,
        currency: "CNY",
        executionFeeNote:
          "执行费用按实际输入/输出 Token 用量进入 ledger/readback。",
      },
      roleTokenPricing: publicRoleTokenPricing,
      tokenUsageSummary: {
        inputTokenFee: "¥1.20/百万 Token",
        outputTokenFee: "¥3.60/百万 Token",
        executionFeeNote:
          "消费者执行前可查看单价，执行后以账本实际用量和费用为准。",
      },
      relatedRoles: [
        {
          id: "prod_role_writer",
          title: "商品文案岗位",
          subtitle: "整理商品卖点并生成文案",
          handle: "writer-role",
        },
      ],
    });
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("metadata.dijieRole");
    expect(serialized).not.toContain("roleBuildBrief");
    expect(serialized).not.toContain("executionId");
  });

  it("projects manifest required capabilities when legacy role capabilities are empty", () => {
    const listing = createDijieRoleListingFromProduct({
      ...roleProduct,
      id: "prod_role_image_review",
      title: "商品图检查岗位",
      metadata: {
        dijieRole: {
          ...(roleProduct.metadata.dijieRole as Record<string, unknown>),
          packageId: "pkg_image_review",
          capabilities: [],
          manifestSummary: {
            entrypoint: "roles/image-review.ts",
            requiredCapabilities: [
              "workspace.read",
              "image.inspect",
              "document.write",
              "human.confirm",
            ],
            sandbox: "workspace-write",
          },
        },
      },
    });

    expect(listing).toBeDefined();
    expect(listing!.capabilities).toEqual([
      "workspace.read",
      "image.inspect",
      "document.write",
      "human.confirm",
    ]);

    const detail = createDijieRoleDetailReadModel(listing!, [listing!]);
    expect(detail.detailSections.requiredCapabilities).toEqual([
      "workspace.read",
      "image.inspect",
      "document.write",
      "human.confirm",
    ]);
    expect(JSON.stringify(detail)).not.toContain("manifestSummary");
  });

  it("does not publish products without one-time role authorization pricing", () => {
    expect(
      createDijieRoleListingFromProduct({
        id: "prod_regular",
        title: "普通商品",
        status: "published",
        metadata: {},
      }),
    ).toBeUndefined();
  });

  it("derives installed roles from paid orders only", () => {
    const installed = createDijieInstalledRolesFromMarketplaceFacts({
      products: [roleProduct],
      orderGroups: [
        {
          id: "ordgrp_paid",
          customer_id: "cus_001",
          orders: [
            {
              id: "order_paid",
              status: "completed",
              created_at: "2026-05-31T00:00:00.000Z",
              payment_collections: [
                { status: "captured", amount: 19900, captured_amount: 19900 },
              ],
              items: [{ product_id: "prod_role_researcher" }],
            },
            {
              id: "order_unpaid",
              status: "pending",
              items: [{ product_id: "prod_role_researcher" }],
            },
          ],
        },
      ],
      orders: [],
    });

    expect(installed).toHaveLength(1);
    expect(installed[0]).toMatchObject({
      entitlementId: "ordgrp_paid",
      entitlementSource: "order_group",
      orderId: "order_paid",
      authorizedAt: "2026-05-31T00:00:00.000Z",
      role: {
        id: "prod_role_researcher",
        title: "资料研究岗位",
      },
    });
  });

  it("deduplicates installed roles by role and prefers materialized local entitlements", () => {
    const installed = createDijieInstalledRolesFromMarketplaceFacts({
      products: [roleProduct],
      entitlements: [
        {
          id: "djent_paid",
          actor_id: "cus_001",
          role_listing_id: "prod_role_researcher",
          entitlement_status: "authorized",
          source: "checkout",
          order_id: "ordgrp_paid",
          authorized_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      orderGroups: [
        {
          id: "ordgrp_paid",
          customer_id: "cus_001",
          orders: [
            {
              id: "order_paid",
              status: "completed",
              payment_collections: [
                { status: "captured", amount: 19900, captured_amount: 19900 },
              ],
              items: [{ product_id: "prod_role_researcher" }],
            },
          ],
        },
      ],
      orders: [],
    });

    expect(installed).toHaveLength(1);
    expect(installed[0]).toMatchObject({
      entitlementId: "djent_paid",
      entitlementSource: "local_entitlement",
      orderId: "ordgrp_paid",
      role: {
        id: "prod_role_researcher",
        title: "资料研究岗位",
      },
    });
  });
});
