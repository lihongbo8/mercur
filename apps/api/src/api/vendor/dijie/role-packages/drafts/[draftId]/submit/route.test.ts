import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../../../lib/dijie/audit-store";
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

const approvedCategoryRecord = {
  category_ref: "category:ecommerce_art_designer@1",
  name: "电商美工",
  version: "1",
  description: "电商视觉岗位品类。",
  category_status: "approved",
  pack_binding: {
    categoryPackRef: "categorypack:ecommerce_art_designer@1",
    skillPackRef: "skillpack:ecommerce_art_designer@1",
    toolPackRef: "toolpack:ecommerce_art_designer@1",
    catalogRefs: ["skill:visual.main_image.inspect@1", "tool:image.inspect@1"],
    capabilityRefs: ["image.inspect", "image.generate", "human.confirm", "audit.record"],
    permissionSummary: ["image.inspect", "image.generate", "human.confirm", "audit.record"],
  },
};

function draft(input?: { ownerId?: string; status?: "partial" | "ready" | "blocked" | "submitted" }) {
  return {
    id: "djdraft_1",
    owner_id: input?.ownerId ?? "acct_dev",
    draft_status: input?.status ?? "ready",
    source_message: "我要做一个智能门锁电商美工岗位",
    package_id: "visual_smart_lock_designer",
    package_version: "1.0.0",
    generated_at: new Date("2026-06-05T01:00:00.000Z"),
    manifest_summary: {
      name: "智能门锁电商美工岗位",
      manifestRef: "role_package/manifest.json",
      categoryRef: "category:ecommerce_art_designer@1",
      categoryName: "电商美工",
      categoryPackRef: "categorypack:ecommerce_art_designer@1",
      skillPackRef: "skillpack:ecommerce_art_designer@1",
      toolPackRef: "toolpack:ecommerce_art_designer@1",
      inheritedCapabilityRefs: ["image.inspect", "image.generate", "human.confirm", "audit.record"],
      requiredCapabilities: ["image.inspect", "human.confirm"],
      permissions: ["role.execute"],
      fileCount: 2,
    },
    file_manifest: [
      {
        path: "role_package/manifest.json",
        sha256: "sha256",
        sizeBytes: 128,
      },
      {
        path: "role_package/README.md",
        sha256: "sha256-readme",
        sizeBytes: 256,
      },
    ],
    package_files: [
      {
        path: "role_package/manifest.json",
        content: JSON.stringify({
          manifestVersion: 1,
          rolePackageId: "visual_smart_lock_designer",
          version: "1.0.0",
          name: "智能门锁电商美工岗位",
          categoryRef: "category:ecommerce_art_designer@1",
          entrypoint: "role_package/README.md",
          permissions: ["role.execute"],
          requiredCapabilities: ["image.inspect", "human.confirm"],
          requiredTools: [
            {
              need: "图片理解",
              catalogRef: "tool.platform.image_inspector",
              status: "bindable",
            },
          ],
          files: [],
        }),
      },
      {
        path: "role_package/README.md",
        content: "岗位定位：负责智能门锁电商视觉巡检。",
      },
    ],
    capability_report: { ok: true, results: [], blockedReasons: [] },
    quality_report: { ok: true, score: 100, requiredChecks: [], blockingIssues: [] },
    upload_validation_issues: [],
    blocking_issues: input?.status === "blocked" ? ["缺少主图巡检 skill"] : [],
    model_usage: null,
    submitted_package_id: null,
  };
}

function request(input?: {
  actorId?: string | null;
  draftId?: string;
  draftRecord?: ReturnType<typeof draft>;
  catalogItems?: unknown[];
  categoryRecords?: unknown[];
}) {
  let submittedPackageId: string | undefined;
  return {
    params: {
      draftId: input?.draftId ?? "djdraft_1",
    },
    auth_context:
      input?.actorId === null
        ? undefined
        : {
            actor_id: input?.actorId ?? "acct_dev",
            actor_type: "member",
          },
    scope: {
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            createDijieRolePackageDraft: async () => ({ draftId: "unused" }),
            updateDijieRolePackageDraft: async () => ({ ok: true }),
            retrieveLatestDijieRolePackageDraft: async () => input?.draftRecord,
            retrieveDijieRolePackageDraft: async (lookup: {
              draftId: string;
              ownerId: string;
            }) =>
              input?.draftRecord?.id === lookup.draftId &&
              input.draftRecord.owner_id === lookup.ownerId
                ? input.draftRecord
                : undefined,
            listDijieEffectiveCatalogItems: input?.catalogItems
              ? async () => input.catalogItems
              : undefined,
            listDijieRoleCategoryRecords: async () =>
              input?.categoryRecords ?? [approvedCategoryRecord],
            storeDijieRolePackage: async (storeInput: {
              summary: {
                packageId: string;
                packageVersion: string;
              };
              ownerId: string;
            }) => {
              expect(storeInput.ownerId).toBe(input?.actorId ?? "acct_dev");
              expect(storeInput.summary.packageId).toBe("visual_smart_lock_designer");
              return {
                rolePackageId: "djpkg_1",
                packageId: storeInput.summary.packageId,
                packageVersion: storeInput.summary.packageVersion,
              };
            },
            markDijieRolePackageDraftSubmitted: async (markInput: {
              draftId: string;
              ownerId: string;
              submittedPackageId?: string;
            }) => {
              submittedPackageId = markInput.submittedPackageId;
              expect(markInput).toMatchObject({
                draftId: input?.draftId ?? "djdraft_1",
                ownerId: input?.actorId ?? "acct_dev",
              });
              return { ok: true };
            },
            get submittedPackageId() {
              return submittedPackageId;
            },
          };
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("POST /vendor/dijie/role-packages/drafts/:draftId/submit", () => {
  it("submits a ready AI draft as a formal role package", async () => {
    const res = response();

    await POST(request({ draftRecord: draft() }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      rolePackageId: "djpkg_1",
      packageId: "visual_smart_lock_designer",
      packageVersion: "1.0.0",
      downloadUrl:
        "/vendor/dijie/role-packages/visual_smart_lock_designer/download?version=1.0.0",
    });
  });

  it("rejects blocked drafts before they become formal packages", async () => {
    const res = response();

    await POST(request({ draftRecord: draft({ status: "blocked" }) }) as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      error: "岗位包草稿未通过验收，不能提交。",
      draft: {
        status: "blocked",
        blockingIssues: ["缺少主图巡检 skill"],
      },
    });
  });

  it("rejects ready drafts when the platform category is no longer approved", async () => {
    const res = response();

    await POST(
      request({
        draftRecord: draft(),
        categoryRecords: [
          {
            ...approvedCategoryRecord,
            category_status: "disabled",
          },
        ],
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      error: "岗位绑定的品类尚未审核启用。",
      blockedReasons: ["category:ecommerce_art_designer@1: disabled"],
    });
  });

  it("rejects partial drafts before all files are generated", async () => {
    const res = response();

    await POST(request({ draftRecord: draft({ status: "partial" }) }) as never, res as never);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      ok: false,
      error: "岗位包草稿未通过验收，不能提交。",
      draft: {
        status: "partial",
      },
    });
  });

  it("does not allow another developer to submit the draft", async () => {
    const res = response();

    await POST(
      request({
        actorId: "acct_other",
        draftRecord: draft({ ownerId: "acct_dev" }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      ok: false,
      error: "未找到岗位包草稿。",
    });
  });

  it("requires a developer account", async () => {
    const res = response();

    await POST(request({ actorId: null, draftRecord: draft() }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "提交岗位包草稿需要登录开发者账号。",
    });
  });
});
