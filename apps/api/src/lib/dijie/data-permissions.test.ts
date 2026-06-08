import { describe, expect, it } from "bun:test";
import {
  canAccessDijieExecutionData,
  canAccessDijieDialogSessionData,
  canAccessDijiePackageData,
  canReviewDijieRoles,
  canUseDijieLocalSystem,
  createDijieAccessContext,
} from "./data-permissions";

describe("Dijie data permissions", () => {
  it("lets local super admins review marketplace roles through global data access", () => {
    const context = createDijieAccessContext({
      actor_id: "local_admin_001",
      actor_type: "user",
    });

    expect(context).toMatchObject({
      accountId: "local_admin_001",
      billingAccountId: "local_admin_001",
      accountLevel: "super_admin",
      localSystemAccess: true,
      marketplaceOwnerAccess: false,
    });
    expect(context && canReviewDijieRoles(context)).toBe(true);
  });

  it("keeps billing account attribution separate from data scopes", () => {
    const context = createDijieAccessContext({
      actor_id: "employee_001",
      actor_type: "member",
      metadata: {
        billingAccountId: "company_owner_001",
        accountLevel: "operator",
        localSystemAccess: true,
        dataScopes: ["role:djrole_image_qc"],
      },
    });

    expect(context).toMatchObject({
      accountId: "employee_001",
      billingAccountId: "company_owner_001",
      dataScopes: ["role:djrole_image_qc"],
    });
  });

  it("keeps marketplace review as a separate owner-side permission", () => {
    const owner = createDijieAccessContext({
      actor_id: "marketplace_owner_001",
      actor_type: "marketplace_owner",
    });
    const scopedReviewer = createDijieAccessContext({
      actor_id: "reviewer_001",
      actor_type: "member",
      metadata: { dataScopes: ["review:role:djrole_image_qc"] },
    });

    expect(owner).toMatchObject({
      accountId: "marketplace_owner_001",
      marketplaceOwnerAccess: true,
    });
    expect(owner && canReviewDijieRoles(owner)).toBe(true);
    expect(scopedReviewer && canReviewDijieRoles(scopedReviewer, "djrole_image_qc")).toBe(true);
    expect(scopedReviewer && canReviewDijieRoles(scopedReviewer, "djrole_other")).toBe(false);
  });

  it("keeps cloud role users out of the local main system by default", () => {
    const context = createDijieAccessContext({
      actor_id: "cus_001",
      actor_type: "customer",
    });

    expect(context).toMatchObject({
      accountId: "cus_001",
      accountLevel: "member",
      localSystemAccess: false,
    });
    expect(context && canUseDijieLocalSystem(context)).toBe(false);
  });

  it("uses stored local account profile before auth-context defaults", () => {
    const context = createDijieAccessContext(
      {
        actor_id: "local_admin_001",
        actor_type: "user",
      },
      {
        account_id: "local_admin_001",
        account_level: "viewer",
        local_system_access: false,
        data_scopes: ["role:djrole_image_qc"],
      },
    );

    expect(context).toMatchObject({
      accountId: "local_admin_001",
      accountLevel: "viewer",
      localSystemAccess: false,
      dataScopes: ["role:djrole_image_qc"],
      marketplaceOwnerAccess: false,
    });
    expect(context && canUseDijieLocalSystem(context)).toBe(false);
  });

  it("allows scoped role staff to read only assigned role execution data", () => {
    const context = createDijieAccessContext({
      actor_id: "member_001",
      actor_type: "member",
      metadata: {
        accountLevel: "operator",
        localSystemAccess: true,
        dataScopes: ["role:djrole_image_qc"],
      },
    });

    expect(context && canAccessDijieExecutionData(context, {
      execution_id: "exec_1",
      actor_id: "cus_other",
      role_listing_id: "djrole_image_qc",
      entitlement_id: "djent_1",
    })).toBe(true);
    expect(context && canAccessDijieExecutionData(context, {
      execution_id: "exec_2",
      actor_id: "cus_other",
      role_listing_id: "djrole_other",
      entitlement_id: "djent_2",
    })).toBe(false);
  });

  it("lets scoped local staff read only matching dialog sessions", () => {
    const context = createDijieAccessContext({
      actor_id: "member_001",
      actor_type: "member",
      metadata: {
        accountLevel: "operator",
        localSystemAccess: true,
        dataScopes: ["role:djrole_image_qc"],
      },
    });

    expect(context && canAccessDijieDialogSessionData(context, {
      account_id: "buyer_001",
      billing_account_id: "company_001",
      subject: { roleListingId: "djrole_image_qc" },
    })).toBe(true);
    expect(context && canAccessDijieDialogSessionData(context, {
      account_id: "buyer_002",
      billing_account_id: "company_002",
      subject: { roleListingId: "djrole_other" },
    })).toBe(false);
  });

  it("lets package owners and package-scoped maintainers download package data", () => {
    const owner = createDijieAccessContext({
      actor_id: "member_owner",
      actor_type: "member",
    });
    const maintainer = createDijieAccessContext({
      actor_id: "member_maintainer",
      actor_type: "member",
      metadata: { dataScopes: ["package:pkg_123"] },
    });

    expect(owner && canAccessDijiePackageData(owner, "pkg_123", "member_owner")).toBe(true);
    expect(maintainer && canAccessDijiePackageData(maintainer, "pkg_123", "member_owner")).toBe(true);
    expect(maintainer && canAccessDijiePackageData(maintainer, "pkg_other", "member_owner")).toBe(false);
  });

  it("lets marketplace owners inspect packages for the review workflow", () => {
    const marketplaceOwner = createDijieAccessContext({
      actor_id: "marketplace_owner_001",
      actor_type: "marketplace_owner",
    });

    expect(
      marketplaceOwner &&
        canAccessDijiePackageData(marketplaceOwner, "pkg_123", "member_owner"),
    ).toBe(true);
  });
});
