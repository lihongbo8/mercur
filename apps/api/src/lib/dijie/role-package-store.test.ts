import { describe, expect, it } from "bun:test";
import {
  createDijieRolePackageDownloadReadModel,
  createDijieRolePackageStorageRecord,
  retrieveDijieRolePackageWithRepository,
  storeDijieRolePackageWithRepository,
  type DijieRolePackageStorageRecord,
} from "./role-package-store";
import type { DijieRolePackageUploadSummary } from "./role-package-upload";

const summary: DijieRolePackageUploadSummary = {
  packageId: "pkg_product_image_qc",
  packageVersion: "0.1.0",
  manifestSummary: {
    entrypoint: "role_package/adapters/openclaw-adapter.ts",
    manifestRef: "role_package/manifest.json",
    name: "商品图检查岗位",
    permissions: ["workspace.read"],
    requiredCapabilities: ["workspace.read", "image.inspect"],
    fileCount: 2,
  },
  files: [
    {
      path: "role_package/manifest.json",
      sha256: "manifest-sha",
      sizeBytes: 128,
    },
    {
      path: "role_package/README.md",
      sha256: "readme-sha",
      sizeBytes: 64,
    },
  ],
};

describe("Dijie role package store", () => {
  it("creates a storage record with safe manifest and downloadable files", () => {
    const record = createDijieRolePackageStorageRecord({
      summary,
      ownerId: "member_123",
      uploadedAt: new Date("2026-06-04T10:00:00.000Z"),
      files: [
        {
          path: "role_package/manifest.json",
          content: "{\"rolePackageId\":\"pkg_product_image_qc\"}",
          sha256: "manifest-sha",
          sizeBytes: 128,
        },
        {
          path: "role_package/README.md",
          content: "# Readme\n",
          sha256: "readme-sha",
          sizeBytes: 64,
        },
      ],
    });

    expect(record).toMatchObject({
      package_id: "pkg_product_image_qc",
      package_version: "0.1.0",
      owner_id: "member_123",
      manifest_summary: summary.manifestSummary,
      file_manifest: summary.files,
    });
    expect(record.package_files[0]).toMatchObject({
      path: "role_package/manifest.json",
      content: "{\"rolePackageId\":\"pkg_product_image_qc\"}",
    });
  });

  it("stores through the repository and returns a receipt", async () => {
    let persisted: DijieRolePackageStorageRecord | undefined;

    const result = await storeDijieRolePackageWithRepository(
      {
        async createDijieRolePackages(data) {
          persisted = data;
          return { id: "djpkg_123" };
        },
      },
      {
        summary,
        ownerId: "member_123",
        files: [
          {
            path: "role_package/manifest.json",
            content: "{}",
          },
        ],
      },
    );

    expect(result).toEqual({
      rolePackageId: "djpkg_123",
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
    });
    expect(persisted?.owner_id).toBe("member_123");
  });

  it("retrieves the latest matching package and builds a download model", async () => {
    const uploadedAt = new Date("2026-06-04T10:00:00.000Z");
    const record = createDijieRolePackageStorageRecord({
      summary,
      uploadedAt,
      files: [
        {
          path: "role_package/README.md",
          content: "# Readme\n",
        },
      ],
    });

    const retrieved = await retrieveDijieRolePackageWithRepository(
      {
        async listDijieRolePackages(filters, config) {
          expect(filters).toEqual({ package_id: "pkg_product_image_qc" });
          expect(config).toMatchObject({
            take: 1,
            order: { uploaded_at: "DESC" },
          });
          return [{ ...record, id: "djpkg_123" }];
        },
      },
      {
        packageId: "pkg_product_image_qc",
      },
    );

    expect(retrieved?.id).toBe("djpkg_123");
    expect(createDijieRolePackageDownloadReadModel(retrieved!)).toMatchObject({
      rolePackageId: "djpkg_123",
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      uploadedAt: uploadedAt.toISOString(),
      files: [
        {
          path: "role_package/README.md",
          content: "# Readme\n",
        },
      ],
    });
  });
});
