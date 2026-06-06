import { describe, expect, it } from "bun:test";
import {
  DIJIE_DIALOG_BILLING_SURFACE_MATRIX,
  createDijieAdminReviewDialogContext,
  createDijieBuyerStorefrontDialogContext,
  createDijieDeveloperDialogContext,
  createDijieOpenClawUserDialogContext,
  createDijieUserCenterDialogContext,
  getDijieDialogBillingPolicy,
  normalizeDijieDialogContext,
} from "./dialog-context";

describe("Dijie dialog context", () => {
  it("normalizes a reused buyer storefront dialog context", () => {
    expect(
      normalizeDijieDialogContext({
        accountId: "cus_001",
        accountType: "buyer",
        surface: "buyer_storefront",
        mode: "user",
        subject: { roleListingId: "prod_role_001" },
      }),
    ).toEqual({
      accountId: "cus_001",
      accountType: "buyer",
      surface: "buyer_storefront",
      mode: "user",
      subject: { roleListingId: "prod_role_001" },
      billingAccountId: "cus_001",
    });
  });

  it("keeps admin review as one admin account reviewing one role package", () => {
    expect(
      createDijieAdminReviewDialogContext({
        adminAccountId: "admin_001",
        roleListingId: "prod_role_001",
        packageId: "pkg_role_001",
        reviewId: "review_001",
      }),
    ).toEqual({
      accountId: "admin_001",
      accountType: "admin",
      surface: "admin_review",
      mode: "review",
      subject: {
        roleListingId: "prod_role_001",
        packageId: "pkg_role_001",
        reviewId: "review_001",
      },
      billingAccountId: "admin_001",
    });
  });

  it("separates OpenClaw user execution from developer package generation", () => {
    expect(
      createDijieOpenClawUserDialogContext({
        buyerAccountId: "cus_001",
        roleListingId: "prod_role_001",
        entitlementId: "ordgrp_001",
        executionId: "exec_001",
      }),
    ).toMatchObject({
      accountType: "buyer",
      surface: "openclaw_local",
      mode: "user",
      subject: {
        roleListingId: "prod_role_001",
        entitlementId: "ordgrp_001",
        executionId: "exec_001",
      },
    });

    expect(
      createDijieDeveloperDialogContext({
        developerAccountId: "dev_001",
        surface: "openclaw_local",
        packageId: "pkg_role_001",
      }),
    ).toEqual({
      accountId: "dev_001",
      accountType: "developer",
      surface: "openclaw_local",
      mode: "developer",
      subject: { packageId: "pkg_role_001" },
      billingAccountId: "dev_001",
    });
  });

  it("rejects unknown context modes and surfaces", () => {
    expect(
      normalizeDijieDialogContext({
        accountId: "admin_001",
        accountType: "admin",
        surface: "admin_review",
        mode: "agent",
      }),
    ).toBeNull();
    expect(
      normalizeDijieDialogContext({
        accountId: "admin_001",
        accountType: "admin",
        surface: "admin_agents",
        mode: "review",
      }),
    ).toBeNull();
  });

  it("keeps billing policy explicit for every dialog surface", () => {
    expect(
      getDijieDialogBillingPolicy(
        createDijieBuyerStorefrontDialogContext({
          buyerAccountId: "cus_001",
          roleListingId: "prod_role_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "cus_001",
      payerAccountId: "cus_001",
      billableModelUsage: true,
      ledgerSource: "marketplace_assist",
      requiresEntitlement: false,
    });

    expect(
      getDijieDialogBillingPolicy(
        createDijieUserCenterDialogContext({
          buyerAccountId: "cus_001",
          entitlementId: "ent_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "cus_001",
      payerAccountId: "cus_001",
      billableModelUsage: true,
      ledgerSource: "user_assist",
      requiresEntitlement: false,
    });

    expect(
      getDijieDialogBillingPolicy(
        createDijieAdminReviewDialogContext({
          adminAccountId: "admin_001",
          roleListingId: "prod_role_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "admin_001",
      payerAccountId: "admin_001",
      billableModelUsage: true,
      ledgerSource: "admin_review_assist",
      requiresEntitlement: false,
    });

    expect(
      getDijieDialogBillingPolicy(
        createDijieDeveloperDialogContext({
          developerAccountId: "dev_001",
          packageId: "pkg_role_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "dev_001",
      payerAccountId: "dev_001",
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
    });

    expect(
      getDijieDialogBillingPolicy(
        createDijieDeveloperDialogContext({
          developerAccountId: "dev_001",
          surface: "openclaw_local",
          packageId: "pkg_role_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "dev_001",
      payerAccountId: "dev_001",
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
    });

    expect(
      getDijieDialogBillingPolicy(
        createDijieOpenClawUserDialogContext({
          buyerAccountId: "cus_001",
          roleListingId: "prod_role_001",
          entitlementId: "ordgrp_001",
        }),
      ),
    ).toMatchObject({
      billingAccountId: "cus_001",
      payerAccountId: "cus_001",
      billableModelUsage: true,
      ledgerSource: "role_usage",
      requiresEntitlement: true,
    });
  });

  it("documents every model-capable dialog entry in the billing surface matrix", () => {
    expect(DIJIE_DIALOG_BILLING_SURFACE_MATRIX).toEqual([
      {
        surface: "buyer_storefront",
        mode: "user",
        accountType: "buyer",
        billableModelUsage: true,
        ledgerSource: "marketplace_assist",
        requiresEntitlement: false,
      },
      {
        surface: "user_center",
        mode: "user",
        accountType: "buyer",
        billableModelUsage: true,
        ledgerSource: "user_assist",
        requiresEntitlement: false,
      },
      {
        surface: "developer_center",
        mode: "developer",
        accountType: "developer",
        billableModelUsage: true,
        ledgerSource: "developer_assist",
        requiresEntitlement: false,
      },
      {
        surface: "openclaw_local",
        mode: "developer",
        accountType: "developer",
        billableModelUsage: true,
        ledgerSource: "developer_assist",
        requiresEntitlement: false,
      },
      {
        surface: "admin_review",
        mode: "review",
        accountType: "admin",
        billableModelUsage: true,
        ledgerSource: "admin_review_assist",
        requiresEntitlement: false,
      },
      {
        surface: "openclaw_local",
        mode: "user",
        accountType: "buyer",
        billableModelUsage: true,
        ledgerSource: "role_usage",
        requiresEntitlement: true,
      },
    ]);
  });
});
