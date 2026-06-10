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
  toolRequirementsContent?: string;
}) {
  const manifestFiles = [
    "role_package/manifest.json",
    "role_package/README.md",
    "role_package/listing.md",
    "role_package/tool_requirements.md",
    "role_package/integrations/openclaw-wrapper.md",
    "role_package/skills/main-image-inspection.md",
    "role_package/skills/detail-page-inspection.md",
    "role_package/skills/product-fidelity-self-check.md",
    "role_package/skills/visual-issue-record.md",
    "role_package/skills/design-standard-maintenance.md",
    "role_package/knowledge/sop.md",
    "role_package/knowledge/design-rules.md",
    "role_package/templates/main-image-inspection-record.md",
    "role_package/templates/detail-page-optimization-checklist.md",
    "role_package/validation/smoke-test.md",
    "role_package/validation/acceptance-samples.md",
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
        "岗位定位：负责智能门锁电商视觉维护。任务型工作包括主图巡检、详情页巡检、产品保真自检、问题记录。日常型工作包括素材库维护和设计标准维护。",
    },
    {
      path: "role_package/listing.md",
      content: "智能门锁电商美工岗位，可进行主图巡检、详情页巡检、产品保真自检和问题记录。",
    },
    {
      path: "role_package/tool_requirements.md",
      content:
        overrides?.toolRequirementsContent ??
        "只声明能力需求，不包含工具源码。需要 browser、image.inspect、image.generate、human.confirm、audit.record 和 AICS 商品图片 adapter。",
    },
    {
      path: "role_package/integrations/openclaw-wrapper.md",
      content: "通过 requiredCapabilities 调用主系统工具，不包含实现代码。",
    },
    {
      path: "role_package/skills/main-image-inspection.md",
      content:
        "主图巡检 skill。输入：商品主图和商品资料。检查产品主体是否突出、背景是否杂乱、卖点是否明显、文字是否遮挡产品、产品是否变形。输出：《主图巡检记录》。失败标准：缺少图片理解能力或没有主图时失败。",
    },
    {
      path: "role_package/skills/detail-page-inspection.md",
      content:
        "详情页巡检 skill。检查模块顺序是否合理、风格统一、文案是否好读、卖点是否清楚、是否有重复低清空洞模块。输出：《详情页视觉优化清单》。失败标准：没有浏览器或图片理解能力时失败。",
    },
    {
      path: "role_package/skills/product-fidelity-self-check.md",
      content:
        "产品保真自检 skill。输入标准产品图和生成图。输出通过/存疑/不通过、风险点、人工复核建议。人工复核为最终发布边界。",
    },
    {
      path: "role_package/skills/visual-issue-record.md",
      content:
        "问题记录 skill。记录商品、图片或页面位置、问题类型、严重程度、修改建议、状态。没有问题台账 adapter 时只能输出清单。",
    },
    {
      path: "role_package/skills/design-standard-maintenance.md",
      content:
        "设计标准维护 skill。反复出现的问题沉淀为规则，例如主图文字不得遮挡锁体、把手、屏幕、摄像头、指纹区。",
    },
    {
      path: "role_package/knowledge/sop.md",
      content:
        "每日 SOP：巡检重点商品主图并记录问题。每周 SOP：复盘详情页视觉优化清单。每月 SOP：更新设计标准和验收样例。",
    },
    {
      path: "role_package/knowledge/design-rules.md",
      content:
        "设计标准：主图文字不得遮挡锁体、把手、屏幕、摄像头、指纹区。AI 生成图必须经过产品保真自检和人工复核。",
    },
    {
      path: "role_package/templates/main-image-inspection-record.md",
      content: "《主图巡检记录》：商品、图片位置、问题、严重程度、修改建议、状态。",
    },
    {
      path: "role_package/templates/detail-page-optimization-checklist.md",
      content: "《详情页视觉优化清单》：模块顺序、风格统一、文案、卖点、低清重复模块。",
    },
    {
      path: "role_package/validation/smoke-test.md",
      content: "smoke 测试：主图巡检、详情页巡检、产品保真自检、问题记录。失败标准必须明确降级。",
    },
    {
      path: "role_package/validation/acceptance-samples.md",
      content: "验收样例：产品保真自检：存疑。风险点：把手边缘疑似被重绘。建议：提交人工复核。",
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
    body: input.body ?? {
      message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
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

    expect(bridgeCalls).toBe(16);
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
        fileCount: 16,
        qualityReport: {
          ok: true,
          score: 100,
        },
      },
      manifestSummary: {
        name: "智能门锁电商美工岗位",
        requiredSkills: expect.arrayContaining([
          expect.objectContaining({
            catalogRef: "skill.platform.visual_main_image_inspection",
            status: "bindable",
          }),
        ]),
        requiredTools: expect.arrayContaining([
          expect.objectContaining({
            catalogRef: "tool.platform.image_inspector",
            status: "bindable",
          }),
        ]),
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
    expect(manifest.requiredSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogRef: "skill.platform.visual_main_image_inspection",
        }),
      ]),
    );
    expect(manifest.requiredTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogRef: "tool.platform.image_inspector",
        }),
      ]),
    );
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
      toolRequirementsContent:
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
        fileCount: 16,
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
              omitPath: "role_package/skills/product-fidelity-self-check.md",
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
      "missing role_package/skills/product-fidelity-self-check.md",
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      draft_status: "blocked",
      owner_id: "acct_dev",
    });
  });
});
