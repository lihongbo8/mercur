import { describe, expect, it } from "bun:test";
import { GET, POST } from "./route";
import {
  testDijieRoleListingReader,
  testDijieRoleListingStorageRecord,
  testDijieRoleListingStore,
  testDijieRolePackageReader,
  testDijieRolePackageStorageRecord,
  testDijieRoleTokenPricing,
  testUsageInstructions,
} from "../../../../lib/dijie/test-fixtures.test";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

const roleTokenPricing = testDijieRoleTokenPricing();
const usageInstructions = testUsageInstructions;

function request(input: {
  body: unknown;
  actorId?: string;
  sellerId?: string;
  service?: unknown;
}) {
  return {
    body: input.body,
    auth_context: input.actorId
      ? {
          actor_id: input.actorId,
          actor_type: "member",
        }
      : undefined,
    seller_context: input.sellerId
      ? {
          seller_id: input.sellerId,
        }
      : undefined,
    scope: {
      resolve() {
        if (!input.service) {
          throw new Error("service unavailable");
        }
        return input.service;
      },
    },
  };
}

function storedListing() {
  return testDijieRoleListingStorageRecord({
    subtitle: "检查商品图片质量",
    description: "输出图片质量问题和修改建议。",
    category: "视觉质检",
    listing_status: "proposed",
    review_state: "submitted",
    pricing: {
      kind: "one_time_authorization",
      authorizationFeeCents: 29900,
      currency: "CNY",
      platformFeeBps: 0,
      developerReceivableCents: 29900,
    },
    confirmation_points: 2,
    submitted_at: new Date("2026-06-04T01:00:00.000Z"),
  });
}

describe("POST /vendor/dijie/role-listings", () => {
  it("creates a role listing draft from an uploaded package", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        body: {
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          title: "商品图检查岗位",
          category: "电商美工",
          categoryRef: "category:ecommerce_art_designer@1",
          usageInstructions,
          roleTokenPricing,
        },
        service: {
          ...testDijieRolePackageReader(),
          ...testDijieRoleListingStore(),
          async retrieveDijieRolePackage(input) {
            expect(input).toEqual({
              packageId: "pkg_product_image_qc",
              packageVersion: "0.1.0",
            });
            return testDijieRolePackageStorageRecord();
          },
          async createDijieRoleListing(input) {
            expect(input).toMatchObject({
              ownerId: "member_123",
              developerRef: "sel_001",
              listingOwnerRef: "sel_001",
              billingBeneficiaryRef: "sel_001",
              packageId: "pkg_product_image_qc",
              title: "商品图检查岗位",
              category: "电商美工",
              categoryRef: "category:ecommerce_art_designer@1",
              usageInstructions,
              roleTokenPricing,
            });
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: testDijieRoleListingStorageRecord(),
              },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roleListingId: "djrole_123",
      listing: {
        listing_status: "draft",
        review_state: "draft",
      },
    });
  });

  it("rejects creating a listing from another developer package", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_other",
        sellerId: "sel_001",
        body: {
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          title: "商品图检查岗位",
          usageInstructions,
        },
        service: {
          ...testDijieRolePackageReader(),
          ...testDijieRoleListingStore(),
          async retrieveDijieRolePackage() {
            return testDijieRolePackageStorageRecord();
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号无权使用该岗位包创建商品。",
    });
  });
});

describe("GET /vendor/dijie/role-listings", () => {
  it("requires a developer account", async () => {
    const res = response();
    await GET(
      request({
        actorId: undefined,
        body: {},
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "读取开发者岗位商品需要登录开发者账号并选择开发者店铺。",
    });
  });

  it("lists owned listings with review and package download status", async () => {
    const res = response();
    await GET(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        body: {},
        service: testDijieRoleListingReader({
          async list(input) {
            expect(input).toEqual({
              developerRef: "sel_001",
              take: 100,
            });
            return [storedListing()];
          },
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      listings: [
        {
          id: "djrole_123",
          roleListingId: "djrole_123",
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          ownerId: "member_123",
          listingStatus: "proposed",
          reviewState: "submitted",
          confirmationPoints: 2,
          submittedAt: "2026-06-04T01:00:00.000Z",
          packageDownload: {
            available: true,
            url: "/vendor/dijie/role-packages/pkg_product_image_qc/download?version=0.1.0",
          },
        },
      ],
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("manifest_summary");
    expect(serialized).not.toContain("package_files");
    expect(serialized).not.toContain("content");
  });

  it("includes special capability requests and explicit bindings for owned listings", async () => {
    const res = response();
    const role = storedListing();

    await GET(
      request({
        actorId: "member_123",
        sellerId: "sel_001",
        body: {},
        service: {
          ...testDijieRoleListingReader({
            records: [role],
          }),
          async listDijieEffectiveCatalogItems() {
            return [];
          },
          async listDijieCatalogReviewRequests() {
            return [
              {
                id: "djcat_review_001",
                review_key: "special_capability:visual.3d_render.inspect",
                catalog_ref: "capability.platform.visual.3d_render.inspect",
                kind: "capability",
                need: "visual.3d_render.inspect",
                source: "developer_request",
                review_status: "approved",
                role_package_id: role.package_id,
                role_listing_id: role.id,
                requested_by: "member_123",
                submitted_at: new Date("2026-06-12T00:00:00.000Z"),
                reviewed_at: new Date("2026-06-12T00:10:00.000Z"),
                reviewed_by: "admin_001",
                review_note: "approved",
                candidate: null,
                risk_summary: null,
                payload: {
                  requestType: "special_capability_pack",
                },
              },
              {
                id: "djcat_review_other",
                review_key: "special_capability:video.generate",
                catalog_ref: "capability.platform.video.generate",
                kind: "capability",
                need: "video.generate",
                source: "developer_request",
                review_status: "approved",
                role_package_id: "pkg_other",
                role_listing_id: "djrole_other",
                requested_by: "member_123",
                submitted_at: new Date("2026-06-12T00:00:00.000Z"),
                reviewed_at: null,
                reviewed_by: null,
                review_note: null,
                candidate: null,
                risk_summary: null,
                payload: {
                  requestType: "special_capability_pack",
                },
              },
            ];
          },
          async listDijieSpecialCapabilityBindings() {
            return [
              {
                id: "djcapbind_001",
                binding_key: "special_capability:visual.3d_render.inspect",
                review_request_id: "djcat_review_001",
                catalog_ref: "capability.platform.visual.3d_render.inspect",
                need: "visual.3d_render.inspect",
                kind: "capability",
                role_package_id: role.package_id,
                role_listing_id: role.id,
                category_ref: "category:ecommerce_art_designer@1",
                binding_status: "bound",
                bound_by: "member_123",
                bound_at: new Date("2026-06-12T00:20:00.000Z"),
                payload: {},
              },
            ];
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      listings: [
        {
          id: "djrole_123",
          specialCapabilityRequests: [
            {
              reviewId: "djcat_review_001",
              catalogRef: "capability.platform.visual.3d_render.inspect",
              need: "visual.3d_render.inspect",
              status: "approved",
            },
          ],
          specialCapabilityBindings: [
            {
              bindingId: "djcapbind_001",
              reviewRequestId: "djcat_review_001",
              catalogRef: "capability.platform.visual.3d_render.inspect",
              status: "bound",
            },
          ],
        },
      ],
    });
  });
});
