import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { DIJIE_OPENCLAW_MODEL_BRIDGE } from "../../../../lib/dijie/dialog-model-bridge";
import { POST } from "./route";
import { POST as POST_STREAM } from "./stream/route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

type TestStreamResponse = TestResponse & {
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
  end: () => void;
  flushHeaders: () => void;
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

function streamResponse(): TestStreamResponse {
  return {
    ...response(),
    headers: {},
    chunks: [],
    ended: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
    },
    end() {
      this.ended = true;
    },
    flushHeaders() {
      return undefined;
    },
  };
}

function request(
  body: Record<string, unknown>,
  authContext: Record<string, unknown> = { actor_id: "acct_user" },
  bridge?: unknown,
) {
  const drafts: Array<Record<string, unknown> & { id: string; owner_id: string }> = [];
  return {
    auth_context: authContext,
    body,
    scope: {
      resolve(name: string) {
        if (name === "query") {
          return {
            graph: async (queryInput: { entity: string }) => {
              if (queryInput.entity === "dijie_role_listing") {
                return {
                  data: [
                    {
                      id: "djrole_image_review",
                      package_id: "djpkg_image_review",
                      package_version: "1.0.0",
                      developer_ref: "acct_dev",
                      title: "商品图检查岗位",
                      subtitle: "检查商品图是否清晰、合规、适合上架。",
                      description: "适合商品图、美工初审和图片质量检查。",
                      listing_status: "published",
                      review_state: "approved",
                      capabilities: ["视觉检查", "商品图检查"],
                      manifest_summary: {
                        requiredCapabilities: ["workspace.read"],
                      },
                      pricing: {
                        kind: "one_time_authorization",
                        authorizationFeeCents: 0,
                        currency: "CNY",
                        platformFeeBps: 0,
                        developerReceivableCents: 0,
                      },
                      role_token_pricing: {
                        inputTokenCentsPerMillion: 120,
                        outputTokenCentsPerMillion: 360,
                        currency: "CNY",
                        developerReceivableBps: 10000,
                        platformFeeBps: 0,
                      },
                      scopes: ["role.execute", "audit.write"],
                    },
                  ],
                };
              }
              return { data: [] };
            },
          };
        }
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            createDijieRolePackageDraft: async (input: Record<string, unknown>) => {
              const id = `djdraft_${drafts.length + 1}`;
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
              drafts.push({
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
              });
              return { draftId: id };
            },
            updateDijieRolePackageDraft: async (input: Record<string, unknown>) => {
              const index = drafts.findIndex(
                (draft) =>
                  draft.id === input.draftId && draft.owner_id === input.ownerId,
              );
              if (index === -1) {
                return { ok: false, status: 404, error: "未找到岗位包草稿。" };
              }
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
              drafts[index] = {
                ...drafts[index],
                draft_status: input.status ?? drafts[index].draft_status,
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
              };
              return { ok: true };
            },
            retrieveLatestDijieRolePackageDraft: async (input: { ownerId: string }) =>
              drafts.find((draft) => draft.owner_id === input.ownerId),
            retrieveDijieRolePackageDraft: async (input: { draftId: string; ownerId: string }) =>
              drafts.find((draft) => draft.id === input.draftId && draft.owner_id === input.ownerId),
            recordDijieDialogTurn: async (input: {
              context: {
                accountId: string;
                accountType: string;
                surface: string;
                mode: string;
                billingAccountId: string;
              };
              userMessage: string;
              capabilityPolicy: unknown;
              assistantReply: {
                reply: string;
                grounding: unknown;
                modelCalled: boolean;
                modelUsage: unknown;
              };
            }) => ({
              ok: true,
              value: {
                session: {
                  id: "djdlg_test",
                  account_id: input.context.accountId,
                  account_type: input.context.accountType,
                  surface: input.context.surface,
                  mode: input.context.mode,
                  billing_account_id: input.context.billingAccountId,
                  subject: {},
                  capability_policy: input.capabilityPolicy,
                  title: input.userMessage,
                  last_message_at: new Date("2026-06-05T01:00:00.000Z"),
                },
                userMessage: {
                  id: "djmsg_user",
                  session_id: "djdlg_test",
                  account_id: input.context.accountId,
                  message_role: "user",
                  content: input.userMessage,
                  grounding: null,
                  model_called: false,
                  model_usage: null,
                  ledger_entry_id: null,
                  occurred_at: new Date("2026-06-05T01:00:00.000Z"),
                },
                assistantMessage: {
                  id: "djmsg_assistant",
                  session_id: "djdlg_test",
                  account_id: input.context.accountId,
                  message_role: "assistant",
                  content: input.assistantReply.reply,
                  grounding: input.assistantReply.grounding,
                  model_called: input.assistantReply.modelCalled,
                  model_usage: input.assistantReply.modelUsage,
                  ledger_entry_id: "djledger_test",
                  occurred_at: new Date("2026-06-05T01:00:00.000Z"),
                },
                ledgerEntry: {
                  id: "djledger_test",
                  account_id: input.context.accountId,
                  billing_account_id: input.context.billingAccountId,
                  source: "dialog_usage",
                  usage_kind: input.assistantReply.modelCalled ? "model_tokens" : "other",
                  surface: input.context.surface,
                  mode: input.context.mode,
                  subject: {},
                  meters: input.assistantReply.modelCalled
                    ? [
                        { name: "dialog_message", quantity: 1, unit: "message" },
                        { name: "input_tokens", quantity: 1200, unit: "token" },
                        { name: "output_tokens", quantity: 300, unit: "token" },
                      ]
                    : [{ name: "dialog_message", quantity: 1, unit: "message" }],
                  currency: "CNY",
                  gross_amount_cents: input.assistantReply.modelCalled ? 3 : 0,
                  platform_receivable_cents: input.assistantReply.modelCalled ? 3 : 0,
                  developer_receivable_cents: 0,
                  model_provider: input.assistantReply.modelCalled ? "openai" : null,
                  model_id: input.assistantReply.modelCalled ? "gpt-5.4" : null,
                  model_pricing_known: input.assistantReply.modelCalled,
                  model_pricing_source: input.assistantReply.modelCalled
                    ? "platform_review_config"
                    : null,
                  provider_cost_cents: input.assistantReply.modelCalled ? 2 : null,
                  provider_cost_currency: input.assistantReply.modelCalled ? "CNY" : null,
                  role_listing_id: null,
                  package_id: null,
                  execution_id: null,
                  entitlement_id: null,
                  developer_ref: null,
                  occurred_at: new Date("2026-06-05T01:00:00.000Z"),
                },
              },
            }),
          };
        }
        if (name === DIJIE_OPENCLAW_MODEL_BRIDGE && bridge) {
          return bridge;
        }
        throw new Error("unknown service");
      },
    },
  };
}

function generatedVisualRolePackageReply() {
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
      content: JSON.stringify({
        manifestVersion: 1,
        rolePackageId: "visual_smart_lock_designer",
        version: "1.0.0",
        name: "智能门锁电商美工岗位",
        entrypoint: "role_package/README.md",
        permissions: ["role.execute", "audit.write"],
        requiredCapabilities: [
          "browser",
          "web_search",
          "web_fetch",
          "image.inspect",
          "image.generate",
          "human.confirm",
          "audit.record",
          "aics_product_db.query_products",
          "aics_product_assets.get_reference_images",
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
  ];
  return JSON.stringify({ files });
}

describe("POST /dijie/dialog/messages", () => {
  it("answers storefront role questions from published role listings", async () => {
    const res = response();

    await POST(
      request({
        surface: "buyer_storefront",
        message: "有没有美工岗位？",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      sessionId: "djdlg_test",
      ledgerEntryId: "djledger_test",
      message: {
        role: "assistant",
      },
      grounding: {
        source: "role_listings",
        roles: [{ id: "djrole_image_review", title: "商品图检查岗位" }],
      },
      billingPolicy: {
        billingAccountId: "acct_user",
        metered: true,
        ledgerSource: "marketplace_assist",
      },
      capabilityPolicy: {
        workflowRouter: "marketplace_discovery",
        meteringPolicy: {
          metered: true,
          chargedBy: "system_platform",
        },
      },
      modelUsage: null,
      modelCalled: false,
    });
    expect(JSON.stringify(res.body)).toContain("商品图检查岗位");
  });

  it("calls the model bridge for developer center AI assistance", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "developer_center",
          message: "我怎么设计岗位包的验收标准？",
        },
        { actor_id: "acct_user" },
        {
          completeDijieDialogMessage: async (input: { fallbackReply: string }) => {
            bridgeCalls += 1;
            expect(input.fallbackReply).toContain("AI 开发助手");
            return {
              reply: "我可以帮你生成岗位包并解释上传步骤。",
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 800,
                completionTokens: 120,
                totalTokens: 920,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 2,
                  platformReceivableCents: 2,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      sessionId: "djdlg_test",
      ledgerEntryId: "djledger_test",
      modelCalled: true,
      billingPolicy: {
        metered: true,
        modelAllowed: true,
        billableModelUsage: true,
        ledgerSource: "developer_assist",
      },
      capabilityPolicy: {
        workflowRouter: "developer_center",
        allowedDataScopes: [
          "owned_role_packages",
          "owned_role_listings",
          "review_status",
          "receivables_summary",
        ],
        meteringPolicy: {
          metered: true,
          modelAllowed: true,
        },
      },
    });
    expect(JSON.stringify(res.body)).toContain("生成岗位包");
    expect(bridgeCalls).toBe(1);
  });

  it("streams developer center dialog status before the final model-backed response", async () => {
    const res = streamResponse();
    let bridgeCalls = 0;

    await POST_STREAM(
      request(
        {
          surface: "developer_center",
          message: "我这个岗位能力标准怎么拆？",
        },
        { actor_id: "acct_user" },
        {
          completeDijieDialogMessage: async (input: { latencyClass?: string }) => {
            bridgeCalls += 1;
            expect(input.latencyClass).toBe("fast_interaction");
            return {
              reply: "可以拆成日常管理标准和岗位能力标准两层。",
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 800,
                completionTokens: 120,
                totalTokens: 920,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 2,
                  platformReceivableCents: 2,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    const stream = res.chunks.join("");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/event-stream");
    expect(stream).toContain("event: status");
    expect(stream).toContain("event: final");
    expect(stream).toContain("可以拆成日常管理标准和岗位能力标准两层");
    expect(stream).toContain("\"modelCalled\":true");
    expect(res.ended).toBe(true);
    expect(bridgeCalls).toBe(1);
  });

  it("streams developer center model deltas before the final response", async () => {
    const res = streamResponse();
    let streamCalls = 0;
    let completeCalls = 0;

    await POST_STREAM(
      request(
        {
          surface: "developer_center",
          message: "普通问题要真流式回答",
        },
        { actor_id: "acct_user" },
        {
          completeDijieDialogMessage: async () => {
            completeCalls += 1;
            return {
              reply: "不应该走完整回复。",
              usage: null,
            };
          },
          streamDijieDialogMessage: async (
            input: { latencyClass?: string },
            handlers?: { onDelta?: (text: string) => void },
          ) => {
            streamCalls += 1;
            expect(input.latencyClass).toBe("fast_interaction");
            handlers?.onDelta?.("第一段");
            handlers?.onDelta?.("第二段");
            return {
              reply: "第一段第二段",
              usage: {
                provider: "openai",
                model: "gpt-fast",
                promptTokens: 100,
                completionTokens: 20,
                totalTokens: 120,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 1,
                  platformReceivableCents: 1,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    const stream = res.chunks.join("");
    expect(res.statusCode).toBe(200);
    expect(stream.indexOf("event: status")).toBeLessThan(stream.indexOf("event: delta"));
    expect(stream).toContain("event: delta");
    expect(stream).toContain("\"text\":\"第一段\"");
    expect(stream).toContain("\"text\":\"第二段\"");
    expect(stream).toContain("event: final");
    expect(stream.indexOf("event: delta")).toBeLessThan(stream.indexOf("event: final"));
    expect(stream).toContain("第一段第二段");
    expect(streamCalls).toBe(1);
    expect(completeCalls).toBe(0);
  });

  for (const surface of ["buyer_storefront", "user_center", "admin_review"] as const) {
    it(`streams ${surface} ordinary dialog through the unified SSE protocol`, async () => {
      const res = streamResponse();
      let streamCalls = 0;

      await POST_STREAM(
        request(
          {
            surface,
            message: "你好，帮我解释一下现在这里能做什么",
          },
          { actor_id: "acct_user", actor_type: surface === "admin_review" ? "user" : "customer" },
          {
            streamDijieDialogMessage: async (
              input: { latencyClass?: string; context: { surface: string } },
              handlers?: { onDelta?: (text: string) => void },
            ) => {
              streamCalls += 1;
              expect(input.context.surface).toBe(surface);
              expect(input.latencyClass).toBe("fast_interaction");
              handlers?.onDelta?.(`${surface} 第一段`);
              return {
                reply: `${surface} 第一段`,
                usage: {
                  provider: "openai",
                  model: "gpt-fast",
                  promptTokens: 100,
                  completionTokens: 20,
                  totalTokens: 120,
                  pricing: {
                    pricingKnown: true,
                    pricingSource: "platform_review_config",
                    grossAmountCents: 1,
                    platformReceivableCents: 1,
                    developerReceivableCents: 0,
                  },
                },
              };
            },
            completeDijieDialogMessage: async () => {
              throw new Error("stream-capable bridge should be used");
            },
          },
        ) as never,
        res as never,
      );

      const stream = res.chunks.join("");
      expect(res.statusCode).toBe(200);
      expect(stream).toContain("event: status");
      expect(stream).toContain("event: delta");
      expect(stream).toContain("event: metrics");
      expect(stream).toContain("event: final");
      expect(stream.indexOf("event: status")).toBeLessThan(stream.indexOf("event: delta"));
      expect(stream.indexOf("event: metrics")).toBeLessThan(stream.indexOf("event: final"));
      expect(stream).toContain(`"${surface} 第一段"`);
      expect(stream).toContain("\"streamPath\":\"true_stream\"");
      expect(streamCalls).toBe(1);
    });
  }

  it("falls back to complete response when developer dialog streaming fails", async () => {
    const res = streamResponse();
    let streamCalls = 0;
    let completeCalls = 0;

    await POST_STREAM(
      request(
        {
          surface: "developer_center",
          message: "流式失败时要降级",
        },
        { actor_id: "acct_user" },
        {
          completeDijieDialogMessage: async () => {
            completeCalls += 1;
            return {
              reply: "完整回复兜底成功。",
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 100,
                completionTokens: 20,
                totalTokens: 120,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 1,
                  platformReceivableCents: 1,
                  developerReceivableCents: 0,
                },
              },
            };
          },
          streamDijieDialogMessage: async () => {
            streamCalls += 1;
            throw new Error("stream failed");
          },
        },
      ) as never,
      res as never,
    );

    const stream = res.chunks.join("");
    expect(res.statusCode).toBe(200);
    expect(stream).toContain("event: fallback");
    expect(stream).toContain("stream_fallback");
    expect(stream).toContain("event: final");
    expect(stream).toContain("完整回复兜底成功");
    expect(streamCalls).toBe(1);
    expect(completeCalls).toBe(1);
  });

  it("returns developer navigation actions while still using the model for natural language", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "developer_center",
          message: "我要去上传岗位包",
        },
        { actor_id: "acct_dev" },
        {
          completeDijieDialogMessage: async (input: { latencyClass?: string }) => {
            bridgeCalls += 1;
            expect(input.latencyClass).toBe("fast_interaction");
            return {
              reply: "我已识别为上传岗位包导航请求，会保持最终提交前人工确认。",
              usage: {
                provider: "openai",
                model: "gpt-fast",
                promptTokens: 80,
                completionTokens: 18,
                totalTokens: 98,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 1,
                  platformReceivableCents: 1,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(bridgeCalls).toBe(1);
    expect(res.body).toMatchObject({
      modelCalled: true,
      message: {
        content: "我已识别为上传岗位包导航请求，会保持最终提交前人工确认。",
      },
      actions: [
        {
          kind: "navigate",
          action: "navigate_upload",
          path: "/products/create",
          requiresConfirmation: false,
        },
      ],
    });
  });

  it("answers developer delist navigation with model wording and safe action metadata", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "developer_center",
          message: "下架岗位在哪",
        },
        { actor_id: "acct_dev" },
        {
          completeDijieDialogMessage: async (input: { latencyClass?: string }) => {
            bridgeCalls += 1;
            expect(input.latencyClass).toBe("fast_interaction");
            return {
              reply: "下架入口在岗位商品列表，但真正下架前仍需要你手动确认。",
              usage: {
                provider: "openai",
                model: "gpt-fast",
                promptTokens: 80,
                completionTokens: 18,
                totalTokens: 98,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 1,
                  platformReceivableCents: 1,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(bridgeCalls).toBe(1);
    expect(res.body).toMatchObject({
      modelCalled: true,
      message: {
        content: "下架入口在岗位商品列表，但真正下架前仍需要你手动确认。",
      },
      actions: [
        {
          kind: "navigate",
          action: "navigate_listing",
          path: "/products",
          requiresConfirmation: false,
        },
      ],
    });
  });

  it("generates and stores one role package draft stage for developer generation intent", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "developer_center",
          message: "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
        },
        { actor_id: "acct_dev" },
        {
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
      ) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      modelCalled: true,
      rolePackageDraft: {
        draftId: "djdraft_1",
        status: "partial",
        packageId: null,
        packageVersion: null,
        fileCount: 1,
      },
      actions: [
        {
          kind: "generate_role_package",
          action: "generate_role_package",
          requiresConfirmation: false,
        },
      ],
      persisted: {
        ledgerEntry: {
          usageKind: "model_tokens",
        },
      },
    });
    const artifacts = (res.body as {
      artifacts?: Array<{ kind?: string; status?: string; label?: string }>;
    }).artifacts ?? [];
    expect(artifacts.filter((artifact) => artifact.kind === "role_build_session")).toHaveLength(1);
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "role_package_draft",
          status: "partial",
        }),
      ]),
    );
    expect(JSON.stringify(res.body)).toContain("已保存 partial 岗位包草稿");
    const visibleDraftActions = res.body as {
      actions?: Array<{ action?: string }>;
      allowedActions?: string[];
      proposedActions?: Array<{ action?: string }>;
      requiredConfirmations?: Array<{ action?: string }>;
      orchestration?: {
        profile?: { allowedActions?: string[] };
        allowedActions?: string[];
        proposedActions?: Array<{ action?: string }>;
        requiredConfirmations?: Array<{ action?: string }>;
      };
    };
    expect(visibleDraftActions.actions?.map((item) => item.action)).not.toContain(
      "navigate_upload",
    );
    expect(visibleDraftActions.allowedActions).not.toContain("navigate_upload");
    expect(visibleDraftActions.proposedActions?.map((item) => item.action)).not.toContain(
      "navigate_upload",
    );
    expect(visibleDraftActions.requiredConfirmations?.map((item) => item.action)).not.toContain(
      "submit_role_package_draft",
    );
    expect(visibleDraftActions.orchestration?.profile?.allowedActions).not.toContain(
      "navigate_upload",
    );
    expect(visibleDraftActions.orchestration?.allowedActions).not.toContain("navigate_upload");
    expect(
      visibleDraftActions.orchestration?.proposedActions?.map((item) => item.action),
    ).not.toContain("submit_role_package_draft");
    expect(
      visibleDraftActions.orchestration?.requiredConfirmations?.map((item) => item.action),
    ).not.toContain("submit_role_package_draft");
    expect(JSON.stringify(res.body)).not.toContain("API key");
  });

  it("calls the configured OpenClaw model bridge for storefront model-allowed dialogs", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "buyer_storefront",
          message: "有没有美工岗位？",
        },
        { actor_id: "acct_user" },
        {
          completeDijieDialogMessage: async (input: { fallbackReply: string }) => {
            bridgeCalls += 1;
            expect(input.fallbackReply).toContain("商品图检查岗位");
            return {
              reply: "模型根据真实岗位库补充：商品图检查岗位适合美工初审。",
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 1200,
                completionTokens: 300,
                totalTokens: 1500,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 3,
                  platformReceivableCents: 3,
                  developerReceivableCents: 0,
                  providerCostCents: 2,
                  providerCostCurrency: "CNY",
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      modelCalled: true,
      modelUsage: {
        provider: "openai",
        model: "gpt-5.4",
        promptTokens: 1200,
        completionTokens: 300,
        totalTokens: 1500,
        pricing: {
          pricingKnown: true,
          pricingSource: "platform_review_config",
        },
      },
      persisted: {
        ledgerEntry: {
          usageKind: "model_tokens",
          modelProvider: "openai",
          modelId: "gpt-5.4",
          modelPricingKnown: true,
          platformReceivableCents: 3,
          developerReceivableCents: 0,
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("provider_auth");
  });

  it("uses backend billing account attribution from auth metadata", async () => {
    const res = response();

    await POST(
      request(
        {
          surface: "buyer_storefront",
          message: "有没有商品图检查岗位？",
        },
        {
          actor_id: "employee_001",
          actor_type: "member",
          metadata: {
            billingAccountId: "company_owner_001",
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      context: {
        accountId: "employee_001",
        billingAccountId: "company_owner_001",
      },
      persisted: {
        session: {
          billingAccountId: "company_owner_001",
        },
        ledgerEntry: {
          accountId: "employee_001",
          billingAccountId: "company_owner_001",
        },
      },
    });
  });

  it("rejects OpenClaw local dialog for non-management accounts", async () => {
    const res = response();

    await POST(
      request({
        surface: "openclaw_local",
        message: "查看本地调度记录",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有本地主系统数据权限。",
    });
  });

  it("allows local management accounts to use OpenClaw local dialog", async () => {
    const res = response();

    await POST(
      request(
        {
          surface: "openclaw_local",
          message: "查看本地调度记录",
        },
        {
          actor_id: "local_operator",
          actor_type: "member",
          metadata: {
            accountLevel: "operator",
            localSystemAccess: true,
            dataScopes: ["role:djrole_image_review"],
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      context: {
        accountId: "local_operator",
        surface: "openclaw_local",
      },
      capabilityPolicy: {
        workflowRouter: "main_workflow",
        requiresLocalSystemAccess: true,
      },
      modelCalled: false,
    });
    expect((res.body as { capabilityPolicy?: { forbiddenActions?: string[] } }).capabilityPolicy?.forbiddenActions)
      .toEqual(expect.arrayContaining([
        "bypass_goal_governance",
        "create_task_without_dispatch",
        "execute_without_entitlement",
      ]));
  });

  it("meters OpenClaw local dialog model usage for local management accounts", async () => {
    const res = response();

    await POST(
      request(
        {
          surface: "openclaw_local",
          message: "帮我看当前主流程状态",
        },
        {
          actor_id: "local_operator",
          actor_type: "member",
          metadata: {
            accountLevel: "operator",
            localSystemAccess: true,
            billingAccountId: "company_owner_001",
          },
        },
        {
          completeDijieDialogMessage: async () => ({
            reply: "主流程状态需要从 OpenClaw 观察层和调度层读取。",
            usage: {
              provider: "deepseek",
              model: "deepseek-chat",
              input: 1200,
              output: 300,
              totalTokens: 1500,
              pricing: {
                pricingKnown: false,
                pricingSource: "missing",
              },
            },
          }),
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      context: {
        accountId: "local_operator",
        billingAccountId: "company_owner_001",
      },
      modelCalled: true,
      modelUsage: {
        provider: "deepseek",
        model: "deepseek-chat",
        promptTokens: 1200,
        completionTokens: 300,
        pricing: {
          pricingKnown: false,
          pricingSource: "missing",
        },
      },
    });
  });

  it("routes OpenClaw main dialog through the main workflow surface prompt", async () => {
    const res = response();
    let bridgeCalls = 0;

    await POST(
      request(
        {
          surface: "openclaw_main",
          message: "用商品图检查岗位执行这批主图检查任务",
          subject: { roleListingId: "djrole_image_review" },
        },
        {
          actor_id: "local_operator",
          actor_type: "member",
          metadata: {
            accountLevel: "operator",
            localSystemAccess: true,
            billingAccountId: "company_owner_001",
          },
        },
        {
          completeDijieDialogMessage: async (input: { message: string }) => {
            bridgeCalls += 1;
            expect(input.message).toContain("OpenClaw 主流程层对话框");
            expect(input.message).toContain("surface: openclaw_main");
            expect(input.message).toContain("模型回复必须是 JSON");
            expect(input.message).toContain("check_entitlement");
            return {
              reply: JSON.stringify({
                reply: "我会先确认岗位授权、执行 token、费用归属和人工确认点，再交给本地 executor。",
                intent: "main_execution_plan",
                artifacts: [],
              }),
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 1100,
                completionTokens: 180,
                totalTokens: 1280,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 3,
                  platformReceivableCents: 3,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(bridgeCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      context: {
        surface: "openclaw_main",
        billingAccountId: "company_owner_001",
      },
      message: {
        content: "我会先确认岗位授权、执行 token、费用归属和人工确认点，再交给本地 executor。",
      },
      intent: {
        name: "main_execution_plan",
        surface: "openclaw_main",
      },
      requiredConfirmations: [
        {
          action: "prepare_role_task",
          target: "djrole_image_review",
        },
      ],
      capabilityPolicy: {
        workflowRouter: "main_workflow",
        requiresEntitlement: true,
      },
      modelCalled: true,
    });
  });

  it("rejects audit assistant dialog without review data permission", async () => {
    const res = response();

    await POST(
      request({
        surface: "admin_review",
        message: "帮我看这个岗位审核材料",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有审核助手数据权限。",
    });
  });

  it("allows platform review accounts to use metered admin review assistance", async () => {
    const res = response();
    let bridgePrompt = "";

    await POST(
      request(
        {
          surface: "admin_review",
          message: "帮我看这个岗位的安全合规风险",
        },
        {
          actor_id: "platform_reviewer",
          actor_type: "admin",
          metadata: {
            marketplaceOwnerAccess: true,
          },
        },
        {
          completeDijieDialogMessage: async (input: { message: string; fallbackReply: string }) => {
            bridgePrompt = input.message;
            expect(input.fallbackReply).toContain("商品图检查岗位");
            expect(input.fallbackReply).not.toContain("模型调用费");
            return {
              reply: "审核建议：先核对权限边界、平台执行费用口径和敏感信息。",
              usage: {
                provider: "openai",
                model: "gpt-5.4",
                promptTokens: 900,
                completionTokens: 180,
                totalTokens: 1080,
                pricing: {
                  pricingKnown: true,
                  pricingSource: "platform_review_config",
                  grossAmountCents: 2,
                  platformReceivableCents: 2,
                  developerReceivableCents: 0,
                },
              },
            };
          },
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      modelCalled: true,
      context: {
        subject: {
          roleListingId: "djrole_image_review",
          reviewId: "review_djrole_image_review",
        },
      },
      grounding: {
        review: {
          roleListingId: "djrole_image_review",
          reviewId: "review_djrole_image_review",
          title: "商品图检查岗位",
        },
      },
      billingPolicy: {
        ledgerSource: "admin_review_assist",
      },
      capabilityPolicy: {
        requiresMarketplaceOwnerAccess: true,
      },
      actions: [
        {
          action: "evaluate_safety_compliance",
          requiresConfirmation: true,
        },
      ],
      persisted: {
        ledgerEntry: {
          source: "dialog_usage",
          usageKind: "model_tokens",
          platformReceivableCents: 3,
          developerReceivableCents: 0,
        },
      },
    });
    expect(bridgePrompt).toContain("pageContext:");
    expect(bridgePrompt).toContain("adminReview");
    expect(bridgePrompt).toContain("商品图检查岗位");
    expect(bridgePrompt).not.toContain("模型调用费");
  });

  it("meters user center assistant model usage under the billing account", async () => {
    const res = response();

    await POST(
      request(
        {
          surface: "user_center",
          message: "查一下我的费用记录",
        },
        {
          actor_id: "employee_001",
          actor_type: "member",
          metadata: { billingAccountId: "company_owner_001" },
        },
        {
          completeDijieDialogMessage: async () => ({
            reply: "我会从费用记录里查询当前账号可见的数据。",
            usage: {
              provider: "openai",
              model: "gpt-5.4",
              promptTokens: 1000,
              completionTokens: 200,
              totalTokens: 1200,
              pricing: {
                pricingKnown: true,
                pricingSource: "platform_review_config",
                grossAmountCents: 3,
                platformReceivableCents: 3,
                developerReceivableCents: 0,
              },
            },
          }),
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      context: {
        accountId: "employee_001",
        billingAccountId: "company_owner_001",
      },
      modelCalled: true,
      persisted: {
        ledgerEntry: {
          billingAccountId: "company_owner_001",
          usageKind: "model_tokens",
        },
      },
    });
  });

  it("rejects explicit dialog contexts for another account unless global", async () => {
    const res = response();

    await POST(
      request({
        message: "查看别人的会话",
        context: {
          accountId: "acct_other",
          accountType: "buyer",
          surface: "buyer_storefront",
          mode: "user",
          billingAccountId: "acct_other",
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
  });

  it("rejects empty messages", async () => {
    const res = response();

    await POST(request({ surface: "buyer_storefront", message: " " }) as never, res as never);

    expect(res.statusCode).toBe(400);
  });
});
