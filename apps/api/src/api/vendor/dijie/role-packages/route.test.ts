import { describe, expect, it } from "bun:test";
import { GET, POST } from "./route";
import type {
  DijieRolePackageReader,
  DijieRolePackageStore,
} from "../../../../lib/dijie/role-package-store";

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

function request(
  body: unknown,
  store?: DijieRolePackageStore | DijieRolePackageReader,
  actorId: string | null = "member_123",
) {
  return {
    body,
    auth_context: actorId
      ? {
          actor_id: actorId,
          actor_type: "member",
        }
      : undefined,
    scope: {
      resolve() {
        if (!store) {
          throw new Error("store unavailable");
        }
        return store;
      },
    },
  };
}

function storedRolePackage() {
  return {
    id: "djpkg_123",
    package_id: "pkg_product_image_qc",
    package_version: "0.1.0",
    owner_id: "member_123",
    uploaded_at: new Date("2026-06-04T00:00:00.000Z"),
    manifest_summary: {
      entrypoint: "role_package/adapters/openclaw-adapter.ts",
      manifestRef: "role_package/manifest.json",
      name: "商品图检查岗位",
      permissions: ["workspace.read", "workspace.write"],
      requiredCapabilities: ["workspace.read", "image.inspect"],
      fileCount: 6,
    },
    file_manifest: [
      {
        path: "role_package/manifest.json",
        sha256: "sha256",
        sizeBytes: 512,
      },
    ],
    package_files: [
      {
        path: "role_package/manifest.json",
        content: JSON.stringify(validManifest()),
      },
    ],
    validation_issues: null,
  };
}

function validManifest() {
  return {
    manifestVersion: 1,
    rolePackageId: "pkg_product_image_qc",
    version: "0.1.0",
    name: "商品图检查岗位",
    entrypoint: "role_package/adapters/openclaw-adapter.ts",
    permissions: ["workspace.read", "workspace.write"],
    requiredCapabilities: ["workspace.read", "image.inspect", "document.write", "human.confirm"],
    files: [
      {
        path: "role_package/manifest.json",
        sha256: "sha256",
        sizeBytes: 512,
      },
    ],
  };
}

function validFiles() {
  return [
    {
      path: "role_package/manifest.json",
      content: JSON.stringify(validManifest()),
    },
    {
      path: "role_package/listing.md",
      content: "# 商品图检查岗位\n",
    },
    {
      path: "role_package/README.md",
      content: "# Role package\n",
    },
    {
      path: "role_package/knowledge/business-workflow.md",
      content: "# 业务流程\n先检查图片清晰度，再判断标题和图片是否一致，最后输出修改清单。\n",
    },
    {
      path: "role_package/adapters/openclaw-adapter.ts",
      content:
        "export const capabilityMapping = ['workspace.read', 'image.inspect', 'document.write'];\n",
    },
    {
      path: "role_package/validation/smoke-test.md",
      content: "# Smoke test\n",
    },
  ];
}

describe("POST /vendor/dijie/role-packages", () => {
  it("accepts a safe role_package upload and returns a public receipt", async () => {
    const res = response();
    let persisted: Parameters<DijieRolePackageStore["storeDijieRolePackage"]>[0] | undefined;

    await POST(
      request(
        { files: validFiles() },
        {
          async storeDijieRolePackage(input) {
            persisted = input;
            return {
              rolePackageId: "djpkg_123",
              packageId: input.summary.packageId,
              packageVersion: input.summary.packageVersion,
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      rolePackageId: "djpkg_123",
      package: {
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
        manifestSummary: {
          entrypoint: "role_package/adapters/openclaw-adapter.ts",
          manifestRef: "role_package/manifest.json",
          name: "商品图检查岗位",
          permissions: ["workspace.read", "workspace.write"],
          requiredCapabilities: [
            "workspace.read",
            "image.inspect",
            "document.write",
            "human.confirm",
          ],
          fileCount: 6,
        },
      },
      downloadUrl:
        "/vendor/dijie/role-packages/pkg_product_image_qc/download?version=0.1.0",
    });
    expect(JSON.stringify(res.body)).not.toContain("content");
    expect(persisted).toMatchObject({
      ownerId: "member_123",
      summary: {
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
      },
    });
    expect(persisted?.files[0]).toMatchObject({
      path: "role_package/manifest.json",
      content: expect.any(String),
    });
  });

  it("fails closed when role_package storage is not configured", async () => {
    const res = response();

    await POST(request({ files: validFiles() }) as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      error: "迭界AI岗位包存储暂未配置，无法保存上传文件包。",
    });
  });

  it("rejects role_package uploads that leak backend ids or secrets", async () => {
    const res = response();
    const manifest = {
      ...validManifest(),
      roleListingId: "prod_role_private",
    };

    await POST(
      request({
        files: [
          {
            path: "role_package/manifest.json",
            content: JSON.stringify(manifest),
          },
          ...validFiles().slice(1),
          {
            path: "role_package/README-private.md",
            content: "Bearer cloud_customer_token_1234567890",
          },
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
    });
    expect(JSON.stringify(res.body)).toContain("roleListingId");
    expect(JSON.stringify(res.body)).toContain("raw tokens");
    expect(JSON.stringify(res.body)).toContain("backend-only field names");
  });

  it("rejects incomplete packages before product listing metadata is created", async () => {
    const res = response();

    await POST(
      request({
        manifest: validManifest(),
        files: [
          {
            path: "role_package/manifest.json",
            content: JSON.stringify(validManifest()),
          },
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain("missing role_package/listing.md");
    expect(JSON.stringify(res.body)).toContain("missing role_package/README.md");
  });

  it("rejects path traversal and private developer-mode context in package files", async () => {
    const res = response();

    await POST(
      request({
        files: [
          ...validFiles(),
          {
            path: "role_package/../private-history.md",
            content: "prompt and chatHistory must not ship in a public role package",
          },
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      message: "迭界AI岗位包上传校验失败。",
    });
    expect(JSON.stringify(res.body)).toContain("role_package/../private-history.md");
    expect(JSON.stringify(res.body)).toContain("backend-only field names");
  });

  it("rejects invalid manifest file content even when body manifest is valid", async () => {
    const res = response();

    await POST(
      request({
        manifest: validManifest(),
        files: [
          {
            path: "role_package/manifest.json",
            content: "{ invalid json",
          },
          ...validFiles().slice(1),
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain(
      "role_package/manifest.json is required and must contain valid JSON.",
    );
  });

  it("rejects packages that ship implementation tools instead of abstract capabilities", async () => {
    const res = response();
    const manifest = {
      ...validManifest(),
      toolDefinitions: [
        {
          name: "browser_tool",
          implementation: "open browser directly",
        },
      ],
    };

    await POST(
      request({
        files: [
          {
            path: "role_package/manifest.json",
            content: JSON.stringify(manifest),
          },
          ...validFiles().slice(1),
          {
            path: "role_package/tools/browser-tool.ts",
            content: "export async function browserTool() { return 'runs locally'; }\n",
          },
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain("toolDefinitions");
    expect(JSON.stringify(res.body)).toContain("must not ship implementation tools");
    expect(JSON.stringify(res.body)).toContain("requiredCapabilities");
  });
});

describe("GET /vendor/dijie/role-packages", () => {
  it("requires a developer account", async () => {
    const res = response();
    await GET(request({}, undefined, null) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "读取开发者岗位包需要登录开发者账号。",
    });
  });

  it("lists only packages owned by the current developer as safe summaries", async () => {
    const res = response();

    await GET(
      request(
        {},
        {
          async retrieveDijieRolePackage() {
            throw new Error("not used");
          },
          async listDijieRolePackages(input) {
            expect(input).toEqual({
              ownerId: "member_123",
              take: 100,
            });
            return [storedRolePackage()];
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      packages: [
        {
          rolePackageId: "djpkg_123",
          packageId: "pkg_product_image_qc",
          packageVersion: "0.1.0",
          ownerId: "member_123",
          uploadedAt: "2026-06-04T00:00:00.000Z",
          fileCount: 1,
          download: {
            available: true,
            url: "/vendor/dijie/role-packages/pkg_product_image_qc/download?version=0.1.0",
          },
        },
      ],
    });
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("package_files");
    expect(serialized).not.toContain("content");
  });
});
