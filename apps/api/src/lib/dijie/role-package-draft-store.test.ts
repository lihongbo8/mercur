import { describe, expect, it } from "bun:test";
import {
  confirmDijieRolePackageDraftFileWithRepository,
  markDijieRolePackageDraftSubmittedWithRepository,
  updateDijieRolePackageDraftWithRepository,
  type DijieRolePackageDraftStorageRecord,
} from "./role-package-draft-store";

function record(
  input?: Partial<DijieRolePackageDraftStorageRecord & { id: string }>,
): DijieRolePackageDraftStorageRecord & { id: string } {
  return {
    id: "djdraft_1",
    owner_id: "acct_dev",
    draft_status: "ready",
    source_message: "我要开发智能门锁电商美工岗位",
    package_id: "visual_smart_lock_designer",
    package_version: "1.0.0",
    generated_at: new Date("2026-06-05T01:00:00.000Z"),
    manifest_summary: {
      name: "智能门锁电商美工岗位",
      manifestRef: "role_package/manifest.json",
      requiredCapabilities: ["image.inspect", "human.confirm"],
      permissions: ["role.execute"],
      fileCount: 1,
    },
    file_manifest: [{ path: "role_package/manifest.json" }],
    package_files: [{ path: "role_package/manifest.json", content: "{}" }],
    capability_report: { ok: true, results: [], blockedReasons: [] },
    quality_report: { ok: true, score: 100, requiredChecks: [], blockingIssues: [] },
    upload_validation_issues: [],
    blocking_issues: [],
    model_usage: null,
    submitted_package_id: null,
    ...input,
  };
}

describe("role package draft store", () => {
  it("marks ready drafts submitted with the Medusa service update signature", async () => {
    const updates: unknown[] = [];
    const repo = {
      async listDijieRolePackageDrafts() {
        return [record()];
      },
      async updateDijieRolePackageDrafts(data: unknown) {
        updates.push(data);
        return [record(data as Partial<DijieRolePackageDraftStorageRecord & { id: string }>)];
      },
    };

    const result = await markDijieRolePackageDraftSubmittedWithRepository(repo, {
      draftId: "djdraft_1",
      ownerId: "acct_dev",
      submittedPackageId: "djpkg_1",
    });

    expect(result).toEqual({ ok: true });
    expect(updates).toEqual([
      {
        id: "djdraft_1",
        draft_status: "submitted",
        submitted_package_id: "djpkg_1",
      },
    ]);
  });

  it("updates generated draft files with the Medusa service update signature", async () => {
    const updates: unknown[] = [];
    const repo = {
      async listDijieRolePackageDrafts() {
        return [record({ draft_status: "partial" })];
      },
      async updateDijieRolePackageDrafts(data: unknown) {
        updates.push(data);
        return [record(data as Partial<DijieRolePackageDraftStorageRecord & { id: string }>)];
      },
    };

    const result = await updateDijieRolePackageDraftWithRepository(repo, {
      draftId: "djdraft_1",
      ownerId: "acct_dev",
      files: [{ path: "role_package/manifest.json", content: "{}" }],
      status: "ready",
      capabilityReport: { ok: true, results: [], blockedReasons: [] },
      qualityReport: { ok: true, score: 100, requiredChecks: [], blockingIssues: [] },
      uploadValidationIssues: [],
      blockingIssues: [],
      modelUsage: null,
    });

    expect(result).toEqual({ ok: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      id: "djdraft_1",
      draft_status: "ready",
      package_files: [{ path: "role_package/manifest.json", content: "{}" }],
    });
  });

  it("confirms a ready draft file against the current content hash", async () => {
    const updates: unknown[] = [];
    const repo = {
      async listDijieRolePackageDrafts() {
        return [record()];
      },
      async updateDijieRolePackageDrafts(data: unknown) {
        updates.push(data);
        return [record(data as Partial<DijieRolePackageDraftStorageRecord & { id: string }>)];
      },
    };

    const result = await confirmDijieRolePackageDraftFileWithRepository(repo, {
      draftId: "djdraft_1",
      ownerId: "acct_dev",
      path: "role_package/manifest.json",
    });

    expect(result.ok).toBe(true);
    expect(updates[0]).toMatchObject({
      id: "djdraft_1",
      file_confirmations: {
        "role_package/manifest.json": {
          path: "role_package/manifest.json",
          confirmed_by: "acct_dev",
        },
      },
    });
  });

  it("rejects file confirmation before the draft passes validation", async () => {
    const repo = {
      async listDijieRolePackageDrafts() {
        return [
          record({
            draft_status: "partial",
            blocking_issues: ["missing role_package/validation/smoke-test.md"],
          }),
        ];
      },
      async updateDijieRolePackageDrafts(data: unknown) {
        throw new Error(`should not update unready drafts: ${JSON.stringify(data)}`);
      },
    };

    const result = await confirmDijieRolePackageDraftFileWithRepository(repo, {
      draftId: "djdraft_1",
      ownerId: "acct_dev",
      path: "role_package/manifest.json",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: "岗位包草稿未通过验收，不能确认文件。",
    });
  });

  it("rejects confirmation after a draft has already been submitted", async () => {
    const repo = {
      async listDijieRolePackageDrafts() {
        return [record({ draft_status: "submitted" })];
      },
      async updateDijieRolePackageDrafts() {
        throw new Error("should not update submitted drafts");
      },
    };

    const result = await confirmDijieRolePackageDraftFileWithRepository(repo, {
      draftId: "djdraft_1",
      ownerId: "acct_dev",
      path: "role_package/manifest.json",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: "岗位包草稿已提交，不能继续确认。",
    });
  });
});
