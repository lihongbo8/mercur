import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import { GET } from "./route";

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

function draft(ownerId = "acct_dev") {
  return {
    id: "djdraft_1",
    owner_id: ownerId,
    draft_status: "ready" as const,
    source_message: "我要做一个智能门锁电商美工岗位",
    package_id: "visual_smart_lock_designer",
    package_version: "1.0.0",
    generated_at: new Date("2026-06-05T01:00:00.000Z"),
    manifest_summary: {
      name: "智能门锁电商美工岗位",
      manifestRef: "role_package/manifest.json",
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
        content: "{}",
      },
    ],
    capability_report: { ok: true, results: [], blockedReasons: [] },
    quality_report: { ok: true, score: 100, requiredChecks: [], blockingIssues: [] },
    upload_validation_issues: [],
    blocking_issues: [],
    model_usage: null,
    submitted_package_id: null,
  };
}

function request(input?: { actorId?: string | null; latestDraft?: ReturnType<typeof draft> }) {
  return {
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
            retrieveLatestDijieRolePackageDraft: async (lookup: { ownerId: string }) =>
              input?.latestDraft?.owner_id === lookup.ownerId ? input.latestDraft : undefined,
            retrieveDijieRolePackageDraft: async () => undefined,
          };
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("GET /vendor/dijie/role-packages/drafts/latest", () => {
  it("returns the latest draft for the current developer as a safe read model", async () => {
    const res = response();

    await GET(request({ latestDraft: draft() }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      draft: {
        draftId: "djdraft_1",
        ownerId: "acct_dev",
        status: "ready",
        packageId: "visual_smart_lock_designer",
        packageVersion: "1.0.0",
        fileCount: 2,
        qualityReport: {
          ok: true,
          score: 100,
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("package_files");
    expect(JSON.stringify(res.body)).not.toContain("content");
  });

  it("returns null when the current developer has no draft", async () => {
    const res = response();

    await GET(request({ latestDraft: draft("acct_other") }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      draft: null,
    });
  });

  it("requires a developer account", async () => {
    const res = response();

    await GET(request({ actorId: null }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      ok: false,
      error: "读取岗位包草稿需要登录开发者账号。",
    });
  });
});
