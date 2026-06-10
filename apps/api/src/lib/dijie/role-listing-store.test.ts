import { describe, expect, it } from "bun:test";
import {
  createDijieRoleListingDraftRecord,
  createDijieRoleListingWithRepository,
  delistDijieRoleListingWithRepository,
  publishDijieRoleListingWithRepository,
  submitDijieRoleListingForReviewWithRepository,
  updateDijieRoleListingDraftWithRepository,
  type DijieRoleListingStorageRecord,
} from "./role-listing-store";

const manifestSummary = {
  entrypoint: "role_package/adapters/openclaw-adapter.ts",
  requiredCapabilities: ["workspace.read", "image.inspect"],
  permissions: ["workspace.read"],
};

const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000 as const,
  platformFeeBps: 0 as const,
};

const usageInstructions =
  "使用者需要提供商品图、目标平台、品牌卖点和人工确认标准后再发起任务。";

function draftListing(overrides: Partial<DijieRoleListingStorageRecord> = {}) {
  return {
    id: "djrole_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    developer_ref: "member_123",
    listing_owner_ref: "member_123",
    billing_beneficiary_ref: "member_123",
    title: "商品图检查岗位",
    subtitle: null,
    description: null,
    usage_instructions: usageInstructions,
    category: null,
    listing_status: "draft" as const,
    review_state: "draft" as const,
    capabilities: ["workspace.read", "image.inspect"],
    manifest_summary: manifestSummary,
    pricing: {
      kind: "one_time_authorization" as const,
      authorizationFeeCents: 0,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 0,
    },
    role_token_pricing: roleTokenPricing,
    scopes: ["role.execute", "audit.write"],
    confirmation_points: 0,
    submitted_at: null,
    published_at: null,
    ...overrides,
  };
}

describe("Dijie role listing store", () => {
  it("creates a draft role listing from a persisted package summary", () => {
    const result = createDijieRoleListingDraftRecord({
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      ownerId: "member_123",
      title: "商品图检查岗位",
      usageInstructions,
      manifestSummary,
      confirmationPoints: 2,
      roleTokenPricing,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "商品图检查岗位",
        listing_status: "draft",
        review_state: "draft",
        capabilities: ["workspace.read", "image.inspect"],
        confirmation_points: 2,
      },
    });
  });

  it("persists a valid role listing draft", async () => {
    const result = await createDijieRoleListingWithRepository(
      {
        async createDijieRoleListings(data) {
          return { ...data, id: "djrole_123" };
        },
      },
      {
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
        ownerId: "member_123",
        title: "商品图检查岗位",
        usageInstructions,
        manifestSummary,
        roleTokenPricing,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        roleListingId: "djrole_123",
        listing: {
          package_id: "pkg_product_image_qc",
          listing_status: "draft",
        },
      },
    });
  });

  it("rejects token pricing below platform cost", () => {
    const result = createDijieRoleListingDraftRecord({
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      ownerId: "member_123",
      title: "商品图检查岗位",
      usageInstructions,
      manifestSummary,
      roleTokenPricing: {
        ...roleTokenPricing,
        inputTokenCentsPerMillion: 0,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(result.ok ? "" : result.error).toContain("不能低于平台成本");
  });

  it("updates only owner-owned drafts", async () => {
    const result = await updateDijieRoleListingDraftWithRepository(
      {
        async listDijieRoleListings() {
          return [draftListing()];
        },
        async updateDijieRoleListings(data) {
          return { ...draftListing(), ...data };
        },
      },
      {
        roleListingId: "djrole_123",
        ownerId: "member_123",
        title: "商品图检查岗位 v2",
        confirmationPoints: 3,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        listing: {
          title: "商品图检查岗位 v2",
          confirmation_points: 3,
        },
      },
    });
  });

  it("submits a draft for admin review", async () => {
    const result = await submitDijieRoleListingForReviewWithRepository(
      {
        async listDijieRoleListings() {
          return [draftListing()];
        },
        async updateDijieRoleListings(data) {
          return { ...draftListing(), ...data };
        },
      },
      {
        roleListingId: "djrole_123",
        ownerId: "member_123",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        listing: {
          listing_status: "proposed",
          review_state: "submitted",
        },
      },
    });
  });

  it("publishes an approved listing", async () => {
    const result = await publishDijieRoleListingWithRepository(
      {
        async listDijieRoleListings() {
          return [
            draftListing({
              listing_status: "delisted",
              review_state: "approved",
            }),
          ];
        },
        async updateDijieRoleListings(data) {
          return {
            ...draftListing({
              listing_status: "delisted",
              review_state: "approved",
            }),
            ...data,
          };
        },
      },
      {
        roleListingId: "djrole_123",
        ownerId: "member_123",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        listing: {
          listing_status: "published",
          review_state: "approved",
        },
      },
    });
  });

  it("delists a published approved listing", async () => {
    const result = await delistDijieRoleListingWithRepository(
      {
        async listDijieRoleListings() {
          return [
            draftListing({
              listing_status: "published",
              review_state: "approved",
              published_at: new Date("2026-06-09T10:00:00.000Z"),
            }),
          ];
        },
        async updateDijieRoleListings(data) {
          return {
            ...draftListing({
              listing_status: "published",
              review_state: "approved",
            }),
            ...data,
          };
        },
      },
      {
        roleListingId: "djrole_123",
        ownerId: "member_123",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        listing: {
          listing_status: "delisted",
          review_state: "approved",
          published_at: null,
        },
      },
    });
  });

  it("rejects non-owner updates", async () => {
    const result = await updateDijieRoleListingDraftWithRepository(
      {
        async listDijieRoleListings() {
          return [draftListing()];
        },
        async updateDijieRoleListings() {
          throw new Error("must not update");
        },
      },
      {
        roleListingId: "djrole_123",
        ownerId: "member_other",
        title: "非法更新",
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "当前账号无权操作该岗位商品。",
    });
  });
});
