import { describe, expect, it } from "bun:test";
import type { DijieCapabilityMatchReport } from "./capability-bridge";
import {
  createDijieRolePackageDraftReadModel,
  markDijieRolePackageDraftSubmittedWithRepository,
  updateDijieRolePackageDraftWithRepository,
  type DijieRolePackageDraftStorageRecord,
} from "./role-package-draft-store";

const passingCapabilityReport = {
  ok: true,
  requiredSkills: [],
  requiredCapabilities: [],
  results: [],
  matchedSkills: [],
  matchedTools: [],
  adapterNeeded: [],
  missing: [],
  blockedReasons: [],
} satisfies DijieCapabilityMatchReport;

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
      entrypoint: "role_package/README.md",
      manifestRef: "role_package/manifest.json",
      requiredCapabilities: ["image.inspect", "human.confirm"],
      permissions: ["role.execute"],
      fileCount: 1,
    },
    file_manifest: [{ path: "role_package/manifest.json" }],
    package_files: [{ path: "role_package/manifest.json", content: "{}" }],
    capability_report: passingCapabilityReport,
    quality_report: { ok: true, score: 100, requiredChecks: [], blockingIssues: [] },
    upload_validation_issues: [],
    blocking_issues: [],
    model_usage: null,
    submitted_package_id: null,
    ...input,
  };
}

describe("role package draft store", () => {
  it("includes linked catalog review requests in the safe draft read model", () => {
    const readModel = createDijieRolePackageDraftReadModel(record(), {
      catalogReviewRequests: [
        {
          reviewId: "djcatrev_001",
          reviewKey: "skill-short-video-review",
          catalogRef: null,
          need: "短视频质检",
          kind: "skill",
          source: "role_gap",
          status: "pending_review",
          rolePackageId: "visual_smart_lock_designer",
          roleListingId: null,
          requestedBy: "acct_dev",
          submittedAt: "2026-06-10T00:00:00.000Z",
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          candidate: { reason: "平台目录暂无短视频质检 skill。" },
          riskSummary: { requiresHumanReview: true },
        },
      ],
    });

    expect(readModel.catalogReviewRequests).toEqual([
      expect.objectContaining({
        reviewId: "djcatrev_001",
        need: "短视频质检",
        kind: "skill",
        status: "pending_review",
        rolePackageId: "visual_smart_lock_designer",
      }),
    ]);
    expect(JSON.stringify(readModel)).not.toContain("package_files");
  });

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
      capabilityReport: passingCapabilityReport,
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
});
