import { describe, expect, it } from "bun:test";
import { createDijieBuyerStorefrontDialogContext } from "./dialog-context";
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
  });

  it("does not invent roles when no listing matches the buyer question", () => {
    const response = createDijieDialogMessageResponse({
      context: createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_user" }),
      message: "有没有合同岗位？",
      roles: [role()],
    });

    expect(response.grounding.roles).toEqual([]);
    expect(response.reply).toContain("暂时没有找到");
  });
});
