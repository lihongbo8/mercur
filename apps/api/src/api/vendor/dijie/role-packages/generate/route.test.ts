import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
import { DIJIE_OPENCLAW_MODEL_BRIDGE } from "../../../../../lib/dijie/dialog-model-bridge";
import { POST } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

type DraftRecord = Record<string, unknown> & {
  id: string;
  owner_id: string;
};

const categoryRecord = {
  category_ref: "category:ecommerce_art_designer@1",
  name: "电商美工",
  version: "1",
  description: "电商视觉岗位品类。",
  category_status: "approved",
  reviewed_at: "2026-06-11T00:00:00.000Z",
  reviewed_by: "admin",
  pack_binding: {
    categoryPackRef: "categorypack:ecommerce_art_designer@1",
    skillPackRef: "skillpack:ecommerce_art_designer@1",
    toolPackRef: "toolpack:ecommerce_art_designer@1",
    catalogRefs: ["skill:visual.main_image.inspect@1", "tool:image.inspect@1"],
    capabilityRefs: ["image.inspect", "image.generate", "human.confirm", "audit.record"],
    permissionSummary: ["image.inspect", "image.generate", "human.confirm", "audit.record"],
  },
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

function generatedVisualRolePackageReply(overrides?: {
  omitPath?: string;
  manifestContent?: string;
  readmeContent?: string;
  standardsContent?: string;
}) {
  const manifestFiles = [
    "role_package/manifest.json",
    "role_package/README.md",
    "role_package/listing.md",
    "role_package/standards.md",
    "role_package/cadence.md",
    "role_package/validation.md",
  ];
  const files = [
    {
      path: "role_package/manifest.json",
      content:
        overrides?.manifestContent ??
        JSON.stringify({
          manifestVersion: 1,
          rolePackageId: "visual_smart_lock_designer",
          version: "1.0.0",
          name: "智能门锁电商美工岗位",
          entrypoint: "role_package/README.md",
          permissions: ["role.execute", "audit.write"],
          requiredCapabilities: [
            "browser",
            "image.inspect",
            "image.generate",
            "human.confirm",
            "audit.record",
            "aics_product_db.query_products",
            "aics_product_assets.get_main_images",
            "aics_product_assets.get_detail_images",
            "aics_product_fidelity.self_check",
            "aics_visual_issue.create_issue",
            "aics_design_standard.get_rules",
            "aics_design_standard.add_rule",
          ],
          files: manifestFiles,
        }),
    },
    {
      path: "role_package/README.md",
      content:
        overrides?.readmeContent ??
        "岗位名称：智能门锁电商美工岗位。\n岗位目标：帮助智能门锁商家完成电商视觉巡检并交付可执行的修改建议。\n服务对象：面向智能门锁品牌商家、运营团队和设计团队。\n平台品类：电商美工。\n输入：商品资料、主图、详情页素材、活动要求。输出：视觉巡检报告、问题清单、人工复核建议和交付结果。\n服务边界：不直接发布商品，不承诺替代人工最终审核。",
    },
    {
      path: "role_package/listing.md",
      content:
        "智能门锁电商美工岗位面向智能门锁商家。岗位目标是发现主图、详情页和活动素材中的视觉风险。输入包括商品资料、图片素材和运营要求。输出包括巡检报告、问题清单和验收建议。服务标准要求问题可定位、建议可执行、发布前必须人工复核。",
    },
    {
      path: "role_package/standards.md",
      content:
        overrides?.standardsContent ??
        "服务标准：所有问题必须关联商品、图片位置、问题类型、严重程度和修改建议。质量标准：不得虚构商品功能，不能遮挡锁体、把手、屏幕、摄像头和指纹区。输入资料不足时必须标记存疑。输出物标准：巡检报告要包含通过、存疑、不通过三类结果。复核标准：发布前人工复核为最终边界。",
    },
    {
      path: "role_package/cadence.md",
      content:
        "服务节奏：触发条件包括商品上新、活动素材更新和每周重点商品巡检。每日检查新上架和高风险商品；每周复盘问题清单和复核结果；每月整理常见失败标准。遇到资料缺失、合规风险或产品保真存疑时停等人工确认。",
    },
    {
      path: "role_package/validation.md",
      content:
        "验收标准：报告能说明输入、输出、问题位置、修改建议和人工复核建议即为通过。验收样例：主图遮挡锁体判定为不通过；图片来源不足判定为存疑。失败标准：无法识别商品主体、资料缺失、存在合规风险或输出不能定位问题时失败并降级为人工复核。",
    },
  ].filter((file) => file.path !== overrides?.omitPath);

  return JSON.stringify({ files });
}

function draftFromInput(input: Record<string, unknown>, id = "djdraft_1"): DraftRecord {
  const uploadSummary = input.uploadSummary as
    | {
        packageId?: string;
        packageVersion?: string;
        manifestSummary?: unknown;
        files?: unknown[];
      }
    | undefined;
  const files = Array.isArray(input.files)
    ? (input.files as Array<Record<string, unknown>>)
    : [];

  return {
    id,
    owner_id: input.ownerId as string,
    draft_status: input.status ?? "ready",
    source_message: input.sourceMessage,
    package_id: uploadSummary?.packageId ?? null,
    package_version: uploadSummary?.packageVersion ?? null,
    generated_at: new Date("2026-06-05T01:00:00.000Z"),
    manifest_summary: uploadSummary?.manifestSummary ?? null,
    file_manifest:
      uploadSummary?.files ??
      files.map((file) => ({
        path: file.path,
        ...(file.sha256 ? { sha256: file.sha256 } : {}),
        ...(file.sizeBytes ? { sizeBytes: file.sizeBytes } : {}),
      })),
    package_files: files,
    capability_report: input.capabilityReport,
    quality_report: input.qualityReport,
    upload_validation_issues: input.uploadValidationIssues,
    blocking_issues: input.blockingIssues,
    model_usage: input.modelUsage,
    submitted_package_id: null,
  };
}

function request(input: {
  body?: Record<string, unknown>;
  actorId?: string | null;
  bridge?: unknown;
  drafts?: DraftRecord[];
}) {
  const drafts = input.drafts ?? [];
  return {
    body: {
      message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
      categoryRef: "category:ecommerce_art_designer@1",
      ...(input.body ?? {}),
    },
    auth_context:
      input.actorId === null
        ? undefined
        : {
            actor_id: input.actorId ?? "acct_dev",
            actor_type: "member",
          },
    scope: {
      resolve(name: string) {
        if (name === DIJIE_OPENCLAW_MODEL_BRIDGE && input.bridge) {
          return input.bridge;
        }
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            createDijieRolePackageDraft: async (draftInput: Record<string, unknown>) => {
              const draft = draftFromInput(draftInput, `djdraft_${drafts.length + 1}`);
              drafts.push(draft);
              return { draftId: draft.id };
            },
            updateDijieRolePackageDraft: async (draftInput: Record<string, unknown>) => {
              const index = drafts.findIndex(
                (draft) =>
                  draft.id === draftInput.draftId && draft.owner_id === draftInput.ownerId,
              );
              if (index === -1) {
                return { ok: false, status: 404, error: "未找到岗位包草稿。" };
              }
              drafts[index] = {
                ...drafts[index],
                ...draftFromInput(draftInput, drafts[index].id),
              };
              return { ok: true };
            },
            retrieveLatestDijieRolePackageDraft: async (lookup: { ownerId: string }) =>
              drafts.find((draft) => draft.owner_id === lookup.ownerId),
            retrieveDijieRolePackageDraft: async (lookup: {
              draftId: string;
              ownerId: string;
            }) =>
              drafts.find(
                (draft) => draft.id === lookup.draftId && draft.owner_id === lookup.ownerId,
              ),
            listDijieRoleCategoryRecords: async () => [categoryRecord],
          };
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("POST /vendor/dijie/role-packages/generate", () => {
  it("generates one stage at a time and stores a partial draft", async () => {
    const res = response();
    const drafts: DraftRecord[] = [];
    let bridgeCalls = 0;

    await POST(
      request({
        body: {
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async (input: { message: string }) => {
            bridgeCalls += 1;
            expect(input.message).toContain("本阶段只生成“manifest.json”");
            return {
              reply: generatedVisualRolePackageReply(),
              usage: { provider: "openai", model: "gpt-5.4" },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      complete: false,
      draft: {
        draftId: "djdraft_1",
        status: "partial",
        fileCount: 1,
      },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      draft_status: "partial",
      owner_id: "acct_dev",
    });
  });

  it("continues an existing partial draft from the next missing file", async () => {
    const res = response();
    const allFiles = (JSON.parse(generatedVisualRolePackageReply()) as {
      files: Array<{ path: string; content: string }>;
    }).files;
    const manifestFile = allFiles.find((file) => file.path === "role_package/manifest.json");
    if (!manifestFile) {
      throw new Error("manifest fixture missing");
    }
    const drafts: DraftRecord[] = [
      {
        id: "djdraft_existing",
        owner_id: "acct_dev",
        draft_status: "partial",
        source_message: "old role package request",
        package_id: null,
        package_version: null,
        generated_at: new Date("2026-06-05T01:00:00.000Z"),
        manifest_summary: null,
        file_manifest: [{ path: manifestFile.path }],
        package_files: [manifestFile],
        capability_report: {},
        quality_report: {},
        upload_validation_issues: [],
        blocking_issues: [],
        model_usage: null,
        submitted_package_id: null,
      },
    ];
    let bridgeCalls = 0;

    await POST(
      request({
        body: {
          message: "继续生成智能门锁电商美工岗位 role_package。",
          draftId: "djdraft_existing",
          maxStages: 1,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async (input: { message: string }) => {
            bridgeCalls += 1;
            expect(input.message).toContain("本阶段只生成“岗位 README”");
            return {
              reply: generatedVisualRolePackageReply(),
              usage: { provider: "openai", model: "gpt-5.4" },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      complete: false,
      draft: {
        draftId: "djdraft_existing",
        status: "partial",
        fileCount: 2,
      },
    });
  });

  it("starts a new draft when adding requirements to a ready draft", async () => {
    const res = response();
    const allFiles = (JSON.parse(generatedVisualRolePackageReply()) as {
      files: Array<{ path: string; content: string }>;
    }).files;
    const drafts: DraftRecord[] = [
      {
        id: "djdraft_ready",
        owner_id: "acct_dev",
        draft_status: "ready",
        source_message: "old role package request",
        package_id: "visual_smart_lock_designer",
        package_version: "1.0.0",
        generated_at: new Date("2026-06-05T01:00:00.000Z"),
        manifest_summary: { name: "智能门锁电商美工岗位" },
        file_manifest: allFiles.map((file) => ({ path: file.path })),
        package_files: allFiles,
        capability_report: {},
        quality_report: { ok: true, score: 100 },
        upload_validation_issues: [],
        blocking_issues: [],
        model_usage: null,
        submitted_package_id: null,
      },
    ];
    let bridgeCalls = 0;

    await POST(
      request({
        body: {
          message: "增加需求：需要检查活动海报。",
          startNew: true,
          maxStages: 1,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async (input: { message: string }) => {
            bridgeCalls += 1;
            expect(input.message).toContain("本阶段只生成“manifest.json”");
            return {
              reply: generatedVisualRolePackageReply(),
              usage: { provider: "openai", model: "gpt-5.4" },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      complete: false,
      draft: {
        draftId: "djdraft_2",
        status: "partial",
        fileCount: 1,
      },
    });
    expect(drafts).toHaveLength(2);
  });

  it("honors request scoped stage timeout for long model stages", async () => {
    const res = response();
    let bridgeAborted = false;

    await POST(
      request({
        body: {
          message: "我要做一个电商美工岗位，请生成 role_package。",
          maxStages: 1,
          stageTimeoutMs: 50,
        },
        bridge: {
          completeDijieDialogMessage: (input: { signal?: AbortSignal }) => {
            input.signal?.addEventListener("abort", () => {
              bridgeAborted = true;
            });
            return new Promise(() => {});
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(504);
    expect(res.body).toMatchObject({
      ok: false,
      issues: ["manifest: model_bridge_timeout"],
      diagnostics: {
        stageId: "manifest",
        stageLabel: "manifest.json",
      },
    });
    expect(bridgeAborted).toBe(true);
  });

  it("generates and stores a validated role_package draft through the model bridge", async () => {
    const res = response();
    const drafts: DraftRecord[] = [];
    let bridgeCalls = 0;

    await POST(
      request({
        body: {
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
          maxStages: 16,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async (input: { message: string }) => {
            bridgeCalls += 1;
            expect(input.message).toContain("只返回 JSON");
            expect(input.message).toContain("智能门锁电商美工岗位");
            return {
              reply: generatedVisualRolePackageReply(),
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 2400,
                completionTokens: 1800,
                totalTokens: 4200,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 9,
                  platformReceivableCents: 9,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(6);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      modelCalled: true,
      draft: {
        draftId: "djdraft_1",
        ownerId: "acct_dev",
        status: "ready",
        packageId: "visual_smart_lock_designer",
        packageVersion: "1.0.0",
        fileCount: 6,
        qualityReport: {
          ok: true,
          score: 100,
        },
      },
      manifestSummary: {
        name: "智能门锁电商美工岗位",
        categoryRef: "category:ecommerce_art_designer@1",
        categoryName: "电商美工",
        inheritedCapabilityRefs: expect.arrayContaining(["image.inspect", "image.generate"]),
      },
      roleCapabilityPlan: {
        status: "platform_ready",
        gaps: [],
      },
      qualityReport: {
        ok: true,
        score: 100,
      },
    });
    expect(drafts).toHaveLength(1);
    const manifest = JSON.parse(
      (drafts[0].package_files as Array<{ path: string; content: string }>).find(
        (file) => file.path === "role_package/manifest.json",
      )?.content ?? "{}",
    );
    expect(manifest.categoryRef).toBe("category:ecommerce_art_designer@1");
    expect(manifest.categoryName).toBe("电商美工");
    expect(manifest.inheritedCapabilityRefs).toEqual(
      expect.arrayContaining(["image.inspect", "image.generate"]),
    );
    expect(manifest.requiredSkills).toBeUndefined();
    expect(manifest.requiredTools).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("Bearer");
    expect(JSON.stringify(res.body)).not.toContain("API key");
  });

  it("repairs upload-preflight manifest and safety field issues before marking ready", async () => {
    const res = response();
    const drafts: DraftRecord[] = [];
    const badReply = generatedVisualRolePackageReply({
      manifestContent: JSON.stringify({
        manifestVersion: 1,
        rolePackageId: "visual_smart_lock_designer",
        version: "1.0.0",
        name: "智能门锁电商美工岗位",
        entrypoint: "role_package/README.md",
        permissions: ["role.execute", "audit.write"],
        requiredCapabilities: ["图片理解", "浏览器预览"],
        files: { readme: "role_package/README.md" },
      }),
      standardsContent:
        "只声明能力需求，不包含工具源码。不要写 provider_auth、access_token、backend ids、entitlementId、ent_01TESTBACKENDID 或 ord_01TESTBACKENDID。",
    });

    await POST(
      request({
        body: {
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
          maxStages: 16,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async () => ({
            reply: badReply,
            usage: { provider: "openai", model: "gpt-5.4" },
          }),
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      complete: true,
      draft: {
        status: "ready",
        fileCount: 6,
      },
      manifestSummary: {
        requiredCapabilities: expect.arrayContaining(["image.inspect", "human.confirm"]),
      },
    });
    expect(drafts[0]).toMatchObject({
      draft_status: "ready",
      upload_validation_issues: [],
      blocking_issues: [],
    });
    expect(JSON.stringify(drafts[0].package_files)).not.toContain("provider_auth");
    expect(JSON.stringify(drafts[0].package_files)).not.toContain("access_token");
    expect(JSON.stringify(drafts[0].package_files)).not.toContain("entitlementId");
    expect(JSON.stringify(drafts[0].package_files)).not.toContain("ent_01TESTBACKENDID");
    expect(JSON.stringify(drafts[0].package_files)).not.toContain("ord_01TESTBACKENDID");
    const manifest = JSON.parse(
      (drafts[0].package_files as Array<{ path: string; content: string }>).find(
        (file) => file.path === "role_package/manifest.json",
      )?.content ?? "{}",
    );
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.requiredCapabilities).toContain("image.inspect");
  });

  it("fails closed when the model bridge is not configured", async () => {
    const res = response();

    await POST(request({}) as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      ok: false,
      error: "AI开发助手模型桥暂未配置，不能生成岗位包。",
    });
  });

  it("rejects non-JSON model replies without storing a draft", async () => {
    const res = response();
    const drafts: DraftRecord[] = [];

    await POST(
      request({
        body: {
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
          maxStages: 16,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async () => ({
            reply: "我已经帮你想好了这个岗位。",
            usage: { provider: "openai", model: "gpt-5.4" },
          }),
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      ok: false,
      error: "AI开发助手没有返回可解析的岗位包 JSON。",
      issues: ["manifest: model_reply_not_json"],
      diagnostics: {
        stageId: "manifest",
        stageLabel: "manifest.json",
        replyPreview: "我已经帮你想好了这个岗位。",
        repairReplyPreview: "我已经帮你想好了这个岗位。",
      },
      modelCalled: true,
    });
    expect(drafts).toHaveLength(0);
  });

  it("rejects incomplete or low-quality generated packages", async () => {
    const res = response();
    const drafts: DraftRecord[] = [];

    await POST(
      request({
        body: {
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
          maxStages: 16,
        },
        drafts,
        bridge: {
          completeDijieDialogMessage: async () => ({
            reply: generatedVisualRolePackageReply({
              omitPath: "role_package/validation.md",
              readmeContent: "岗位介绍：做图片。",
            }),
            usage: { provider: "openai", model: "gpt-5.4" },
          }),
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      ok: false,
      error: "AI开发助手生成的岗位包未通过质量验收。",
      modelCalled: true,
    });
    expect(JSON.stringify(res.body)).toContain(
      "missing role_package/validation.md",
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      draft_status: "blocked",
      owner_id: "acct_dev",
    });
  });
});
