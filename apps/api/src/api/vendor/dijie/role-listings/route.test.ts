import { describe, expect, it } from "bun:test";
import { GET, POST } from "./route";
import type {
  DijieRoleListingReader,
  DijieRoleListingStore,
} from "../../../../lib/dijie/role-listing-store";
import type { DijieRolePackageReader } from "../../../../lib/dijie/role-package-store";

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

function rolePackage() {
  return {
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    uploaded_at: new Date(),
    manifest_summary: {
      entrypoint: "role_package/adapters/openclaw-adapter.ts",
      manifestRef: "role_package/manifest.json",
      name: "商品图检查岗位",
      permissions: ["workspace.read"],
      requiredCapabilities: ["workspace.read", "image.inspect"],
      fileCount: 1,
    },
    file_manifest: [],
    package_files: [],
    validation_issues: null,
  };
}

function request(input: {
  body: unknown;
  actorId?: string;
  service?: (DijieRoleListingStore & DijieRolePackageReader) | DijieRoleListingReader;
}) {
  return {
    body: input.body,
    auth_context: input.actorId
      ? {
          actor_id: input.actorId,
          actor_type: "member",
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
  return {
    id: "djrole_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    developer_ref: "member_123",
    listing_owner_ref: "member_123",
    billing_beneficiary_ref: "member_123",
    title: "商品图检查岗位",
    subtitle: "检查商品图片质量",
    description: "输出图片质量问题和修改建议。",
    category: "视觉质检",
    listing_status: "proposed" as const,
    review_state: "submitted" as const,
    capabilities: ["workspace.read", "image.inspect"],
    manifest_summary: rolePackage().manifest_summary,
    pricing: {
      kind: "one_time_authorization" as const,
      authorizationFeeCents: 29900,
      currency: "CNY" as const,
      platformFeeBps: 0,
      developerReceivableCents: 29900,
    },
    role_token_pricing: {
      inputTokenCentsPerMillion: 120,
      outputTokenCentsPerMillion: 360,
      currency: "CNY" as const,
      developerReceivableBps: 10000,
      platformFeeBps: 0,
    },
    scopes: ["role.execute", "audit.write"],
    confirmation_points: 2,
    submitted_at: new Date("2026-06-04T01:00:00.000Z"),
    published_at: null,
  };
}

describe("POST /vendor/dijie/role-listings", () => {
  it("creates a role listing draft from an uploaded package", async () => {
    const res = response();

    await POST(
      request({
        actorId: "member_123",
        body: {
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          title: "商品图检查岗位",
        },
        service: {
          async retrieveDijieRolePackage(input) {
            expect(input).toEqual({
              packageId: "pkg_product_image_qc",
              packageVersion: "0.1.0",
            });
            return rolePackage();
          },
          async createDijieRoleListing(input) {
            expect(input).toMatchObject({
              ownerId: "member_123",
              packageId: "pkg_product_image_qc",
              title: "商品图检查岗位",
            });
            return {
              ok: true,
              value: {
                roleListingId: "djrole_123",
                listing: {
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
                  category: null,
                  listing_status: "draft",
                  review_state: "draft",
                  capabilities: ["workspace.read", "image.inspect"],
                  manifest_summary: rolePackage().manifest_summary,
                  pricing: {
                    kind: "one_time_authorization",
                    authorizationFeeCents: 0,
                    currency: "CNY",
                    platformFeeBps: 0,
                    developerReceivableCents: 0,
                  },
                  role_token_pricing: {
                    inputTokenCentsPerMillion: 0,
                    outputTokenCentsPerMillion: 0,
                    currency: "CNY",
                    developerReceivableBps: 10000,
                    platformFeeBps: 0,
                  },
                  scopes: ["role.execute", "audit.write"],
                  confirmation_points: 0,
                  submitted_at: null,
                  published_at: null,
                },
              },
            };
          },
          async updateDijieRoleListingDraft() {
            throw new Error("not used");
          },
          async submitDijieRoleListingForReview() {
            throw new Error("not used");
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
        body: {
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          title: "商品图检查岗位",
        },
        service: {
          async retrieveDijieRolePackage() {
            return rolePackage();
          },
          async createDijieRoleListing() {
            throw new Error("must not create");
          },
          async updateDijieRoleListingDraft() {
            throw new Error("not used");
          },
          async submitDijieRoleListingForReview() {
            throw new Error("not used");
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
      error: "读取开发者岗位商品需要登录开发者账号。",
    });
  });

  it("lists owned listings with review and package download status", async () => {
    const res = response();
    await GET(
      request({
        actorId: "member_123",
        body: {},
        service: {
          async retrieveDijieRoleListing() {
            throw new Error("not used");
          },
          async listDijieStoredRoleListings(input) {
            expect(input).toEqual({
              ownerId: "member_123",
              take: 100,
            });
            return [storedListing()];
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
