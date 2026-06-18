import { describe, expect, it } from "bun:test";
import {
  createDijieAdminReviewDialogContext,
  createDijieBuyerStorefrontDialogContext,
  createDijieDeveloperDialogContext,
  createDijieDialogContext,
  createDijieOpenClawUserDialogContext,
  createDijieUserCenterDialogContext,
} from "./dialog-context";
import { getDijieDialogCapabilityPolicy } from "./dialog-capability-policy";

describe("Dijie dialog capability policy", () => {
  it("meters every dialog surface under the system platform billing account", () => {
    const contexts = [
      createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_buyer" }),
      createDijieUserCenterDialogContext({ buyerAccountId: "acct_buyer" }),
      createDijieDeveloperDialogContext({ developerAccountId: "acct_dev" }),
      createDijieAdminReviewDialogContext({ adminAccountId: "acct_owner" }),
      createDijieOpenClawUserDialogContext({ buyerAccountId: "acct_operator" }),
    ];

    for (const context of contexts) {
      const policy = getDijieDialogCapabilityPolicy(context);

      expect(policy.meteringPolicy.metered).toBe(true);
      expect(policy.meteringPolicy.chargedBy).toBe("system_platform");
      expect(policy.meteringPolicy.actorAccountId).toBe(context.accountId);
      expect(policy.meteringPolicy.billingAccountId).toBe(context.billingAccountId);
    }
  });

  it("keeps storefront dialog inside marketplace discovery", () => {
    const policy = getDijieDialogCapabilityPolicy(
      createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_buyer" }),
    );

    expect(policy.workflowRouter).toBe("marketplace_discovery");
    expect(policy.allowedActions).toContain("search_roles");
    expect(policy.forbiddenActions).toContain("main_workflow_dispatch");
  });

  it("allows developer center AI assistance to generate role packages", () => {
    const policy = getDijieDialogCapabilityPolicy(
      createDijieDeveloperDialogContext({ developerAccountId: "acct_dev" }),
    );

    expect(policy.workflowRouter).toBe("developer_center");
    expect(policy.allowedDataScopes).toContain("owned_role_packages");
    expect(policy.allowedActions).toContain("generate_role_package");
    expect(policy.forbiddenActions).toContain("read_buyer_private_data");
    expect(policy.meteringPolicy.metered).toBe(true);
    expect(policy.meteringPolicy.modelAllowed).toBe(true);
  });

  it("keeps admin review assistance separate from local customer administration", () => {
    const policy = getDijieDialogCapabilityPolicy(
      createDijieAdminReviewDialogContext({ adminAccountId: "marketplace_owner_001" }),
    );

    expect(policy.workflowRouter).toBe("review_assist");
    expect(policy.requiresMarketplaceOwnerAccess).toBe(true);
    expect(policy.requiresLocalSystemAccess).toBe(false);
    expect(policy.forbiddenActions).toContain("auto_approve");
    expect(policy.allowedActions).toContain("evaluate_pricing_risk");
  });

  it("routes OpenClaw user dialog through the AICS main workflow boundary", () => {
    const policy = getDijieDialogCapabilityPolicy(
      createDijieOpenClawUserDialogContext({ buyerAccountId: "local_operator" }),
    );

    expect(policy.workflowRouter).toBe("main_workflow");
    expect(policy.requiresLocalSystemAccess).toBe(true);
    expect(policy.requiresEntitlement).toBe(true);
    expect(policy.allowedActions).toContain("navigate_goal");
    expect(policy.forbiddenActions).toContain("bypass_goal_governance");
  });

  it("separates local developer workspace from customer role execution", () => {
    const policy = getDijieDialogCapabilityPolicy(
      createDijieDialogContext({
        accountId: "acct_dev",
        accountType: "developer",
        surface: "openclaw_local",
        mode: "developer",
      }),
    );

    expect(policy.workflowRouter).toBe("developer_workspace");
    expect(policy.requiresLocalSystemAccess).toBe(true);
    expect(policy.forbiddenActions).toContain("execute_customer_role_task");
  });
});
