import { describe, expect, it } from "bun:test";
import { GET } from "./route";
import type {
  DijieRolePackageReader,
  DijieRolePackageStorageRecord,
} from "../../../../../../lib/dijie/role-package-store";

type TestResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (statusCode: number) => TestResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function packageRecord(overrides: Partial<DijieRolePackageStorageRecord> = {}) {
  return {
    id: "djpkg_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    uploaded_at: new Date("2026-06-04T10:00:00.000Z"),
    manifest_summary: {
      entrypoint: "role_package/adapters/openclaw-adapter.ts",
      manifestRef: "role_package/manifest.json",
      name: "商品图检查岗位",
      permissions: ["workspace.read"],
      requiredCapabilities: ["workspace.read", "image.inspect"],
      fileCount: 1,
    },
    file_manifest: [
      {
        path: "role_package/README.md",
        sha256: "readme-sha",
        sizeBytes: 64,
      },
    ],
    package_files: [
      {
        path: "role_package/README.md",
        content: "# Readme\n",
        sha256: "readme-sha",
        sizeBytes: 64,
      },
    ],
    validation_issues: null,
    ...overrides,
  };
}

function request(input: {
  reader: DijieRolePackageReader;
  actorId?: string;
  actorType?: string;
  metadata?: Record<string, unknown>;
  packageId?: string;
  version?: string;
}) {
  return {
    params: {
      packageId: input.packageId ?? "pkg_product_image_qc",
    },
    query: {
      ...(input.version ? { version: input.version } : {}),
    },
    auth_context: input.actorId
      ? {
          actor_id: input.actorId,
          actor_type: input.actorType ?? "member",
          ...(input.metadata ? { metadata: input.metadata } : {}),
        }
      : undefined,
    scope: {
      resolve() {
        return input.reader;
      },
    },
  };
}

describe("GET /vendor/dijie/role-packages/:packageId/download", () => {
  it("downloads a stored role package for the owner", async () => {
    const res = response();

    await GET(
      request({
        actorId: "member_123",
        version: "0.1.0",
        reader: {
          async retrieveDijieRolePackage(input) {
            expect(input).toEqual({
              packageId: "pkg_product_image_qc",
              packageVersion: "0.1.0",
            });
            return packageRecord();
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toBe(
      'attachment; filename="pkg_product_image_qc-0.1.0-role-package.json"',
    );
    expect(res.body).toMatchObject({
      ok: true,
      package: {
        rolePackageId: "djpkg_123",
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
        files: [
          {
            path: "role_package/README.md",
            content: "# Readme\n",
          },
        ],
      },
    });
  });

  it("allows a marketplace owner actor to download a developer package for review", async () => {
    const res = response();

    await GET(
      request({
        actorId: "marketplace_owner_001",
        actorType: "marketplace_owner",
        reader: {
          async retrieveDijieRolePackage() {
            return packageRecord();
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
  });

  it("allows a package-scoped maintainer to download package data", async () => {
    const res = response();

    await GET(
      request({
        actorId: "member_maintainer",
        metadata: {
          accountLevel: "operator",
          dataScopes: ["package:pkg_product_image_qc"],
        },
        reader: {
          async retrieveDijieRolePackage() {
            return packageRecord();
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
  });

  it("rejects non-owner downloads", async () => {
    const res = response();

    await GET(
      request({
        actorId: "member_other",
        reader: {
          async retrieveDijieRolePackage() {
            return packageRecord();
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号无权下载该岗位包。",
    });
  });

  it("returns 404 when the package does not exist", async () => {
    const res = response();

    await GET(
      request({
        actorId: "member_123",
        reader: {
          async retrieveDijieRolePackage() {
            return undefined;
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      ok: false,
      error: "未找到可下载的岗位包。",
    });
  });
});
