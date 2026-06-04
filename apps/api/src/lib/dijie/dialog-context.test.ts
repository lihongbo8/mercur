import { describe, expect, it } from "bun:test";
import {
  createDijieAdminReviewDialogContext,
  createDijieDeveloperDialogContext,
  createDijieOpenClawUserDialogContext,
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
});
