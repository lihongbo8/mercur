import { describe, expect, it } from "bun:test";
import {
  createDijieAdminReviewDialogContext,
  createDijieBuyerStorefrontDialogContext,
  createDijieDeveloperDialogContext,
  createDijieOpenClawUserDialogContext,
  createDijieUserCenterDialogContext,
} from "./dialog-context";
import { createDijieDialogMessageResponse } from "./dialog-messages";
import type { DijieRoleListing } from "./role-listings";

function role(overrides: Partial<DijieRoleListing> = {}): DijieRoleListing {
  return {
    id: "djrole_image_review",
    title: "商品图检查岗位",
    subtitle: "检查商品图是否清晰、合规、适合上架。",
    description: "适合商品图、美工初审和图片质量检查。",
    handle: "djrole_image_review",
    listingStatus: "published",
    reviewState: "approved",
    developerId: "acct_dev",
    developerName: "迭界开发者",
    packageId: "djpkg_image_review",
    packageVersion: "1.0.0",
    protocolVersion: "2026-05",
    capabilities: ["视觉检查", "商品图检查"],
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 0,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 0,
    },
    roleTokenPricing: {
      inputTokenCentsPerMillion: 0,
      outputTokenCentsPerMillion: 0,
      currency: "CNY",
      developerReceivableBps: 10000,
      platformFeeBps: 0,
    },
    scopes: ["role.execute", "audit.write"],
    ...overrides,
  };
}

describe("Dijie dialog messages", () => {
  it("answers buyer storefront questions from the real role listing collection", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_user" }),
      message: "有没有美工岗位？",
      roles: [role()],
    });

    expect(response).toMatchObject({
      modelCalled: false,
      grounding: {
        source: "role_listings",
        roles: [{ id: "djrole_image_review", title: "商品图检查岗位" }],
      },
      billingPolicy: {
        billingAccountId: "acct_user",
        ledgerSource: "marketplace_assist",
      },
    });
    expect(response.reply).toContain("当前已发布岗位库");
    expect(response.reply).toContain("商品图检查岗位");
    expect(response.actions).toEqual([
      expect.objectContaining({
        kind: "navigate_authorization",
        action: "navigate_authorization",
        path: "/us/roles/djrole_image_review",
        requiresConfirmation: false,
      }),
    ]);
  });

  it("does not invent roles when no listing matches the buyer question", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_user" }),
      message: "有没有合同岗位？",
      roles: [role()],
    });

    expect(response.grounding.roles).toEqual([]);
    expect(response.actions).toEqual([]);
    expect(response.reply).toContain("暂时没有找到");
  });

  it("returns developer-center navigation actions instead of relying on local UI guessing", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieDeveloperDialogContext({ developerAccountId: "acct_dev" }),
      message: "我要去上传岗位包",
    });

    expect(response.actions).toEqual([
      expect.objectContaining({
        kind: "navigate",
        action: "navigate_upload",
        path: "/products/create",
        requiresConfirmation: false,
      }),
    ]);
  });

  it("marks developer role package generation as a model-backed generation action", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieDeveloperDialogContext({ developerAccountId: "acct_dev" }),
      message: "生成一个智能门锁电商美工岗位 role_package",
    });

    expect(response.actions).toEqual([
      expect.objectContaining({
        kind: "generate_role_package",
        action: "generate_role_package",
        target: "developer_center.role_package_draft",
        requiresConfirmation: false,
      }),
    ]);
  });

  it("keeps admin review actions behind human confirmation", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieAdminReviewDialogContext({
        adminAccountId: "acct_admin",
        reviewId: "djreview_1",
      }),
      message: "帮我看安全合规和起草补充意见",
    });

    expect(response.actions).toEqual([
      expect.objectContaining({
        action: "evaluate_safety_compliance",
        requiresConfirmation: true,
      }),
      expect.objectContaining({
        action: "draft_review_note",
        requiresConfirmation: true,
      }),
    ]);
  });

  it("routes user center records without main workflow dispatch", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieUserCenterDialogContext({ buyerAccountId: "acct_user" }),
      message: "查一下我的岗位授权和费用",
    });

    expect(response.actions).toEqual([
      expect.objectContaining({
        action: "navigate_role",
        path: "/account/roles",
      }),
      expect.objectContaining({
        action: "navigate_ledger",
        path: "/account/ledger",
      }),
    ]);
  });

  it("turns user center execution requests into a confirmed user-center execution plan", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieUserCenterDialogContext({
        buyerAccountId: "acct_user",
        roleListingId: "djrole_image_review",
      }),
      message: "用商品图检查岗位执行这个任务",
    });

    expect(response.intent.name).toBe("execution_intent");
    expect(response.actions).toEqual([
      expect.objectContaining({
        kind: "prepare_role_execution",
        action: "prepare_role_execution",
        target: "djrole_image_review",
        executionChannel: "cloud_user_center",
        requiresConfirmation: true,
      }),
    ]);
    expect(response.requiredConfirmations).toEqual([
      expect.objectContaining({
        action: "prepare_role_execution",
      }),
    ]);
    expect(response.artifacts).toEqual([
      expect.objectContaining({
        kind: "execution_plan",
        metadata: expect.objectContaining({
          executionChannel: "cloud_user_center",
        }),
      }),
    ]);
  });

  it("only prepares OpenClaw role execution and leaves execution confirmation to the gateway", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieOpenClawUserDialogContext({
        buyerAccountId: "acct_user",
        roleListingId: "djrole_image_review",
      }),
      message: "用商品图检查岗位执行这个任务",
    });

    expect(response.actions).toEqual([
      expect.objectContaining({
        kind: "prepare_role_execution",
        action: "prepare_role_task",
        target: "djrole_image_review",
        requiresConfirmation: true,
      }),
    ]);
    expect(response.intent).toMatchObject({
      name: "main_execution_plan",
      surface: "openclaw_main",
    });
  });
});
