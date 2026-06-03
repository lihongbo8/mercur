import { describe, expect, it } from "bun:test";
import { POST } from "./route";

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

function validManifest() {
  return {
    manifestVersion: 1,
    rolePackageId: "pkg_product_image_qc",
    version: "0.1.0",
    name: "商品图检查岗位",
    entrypoint: "role_package/adapters/openclaw-adapter.ts",
    permissions: ["workspace.read", "workspace.write"],
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
      path: "role_package/adapters/openclaw-adapter.ts",
      content: "export const adapter = 'openclaw';\n",
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

    await POST({ body: { files: validFiles() } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      package: {
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
        manifestSummary: {
          entrypoint: "role_package/adapters/openclaw-adapter.ts",
          manifestRef: "role_package/manifest.json",
          name: "商品图检查岗位",
          permissions: ["workspace.read", "workspace.write"],
          fileCount: 5,
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("content");
  });

  it("rejects role_package uploads that leak backend ids or secrets", async () => {
    const res = response();
    const manifest = {
      ...validManifest(),
      roleListingId: "prod_role_private",
    };

    await POST(
      {
        body: {
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
        },
      } as never,
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
      {
        body: {
          manifest: validManifest(),
          files: [
            {
              path: "role_package/manifest.json",
              content: JSON.stringify(validManifest()),
            },
          ],
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain("missing role_package/listing.md");
    expect(JSON.stringify(res.body)).toContain("missing role_package/README.md");
  });

  it("rejects path traversal and private developer-mode context in package files", async () => {
    const res = response();

    await POST(
      {
        body: {
          files: [
            ...validFiles(),
            {
              path: "role_package/../private-history.md",
              content: "prompt and chatHistory must not ship in a public role package",
            },
          ],
        },
      } as never,
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
      {
        body: {
          manifest: validManifest(),
          files: [
            {
              path: "role_package/manifest.json",
              content: "{ invalid json",
            },
            ...validFiles().slice(1),
          ],
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain(
      "role_package/manifest.json is required and must contain valid JSON.",
    );
  });
});
