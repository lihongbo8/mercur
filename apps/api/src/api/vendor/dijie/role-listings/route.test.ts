import { describe, expect, it } from "bun:test";
import { GET, POST } from "./route";
import type {
  DijieRoleListingReader,
  DijieRoleListingStore,
} from "../../../../lib/dijie/role-listing-store";
import type { DijieRolePackageReader } from "../../../../lib/dijie/role-package-store";
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
  service?:
    | (DijieRoleListingStore & DijieRolePackageReader)
    | DijieRoleListingReader;
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
});
