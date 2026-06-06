import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { DIJIE_OPENCLAW_MODEL_BRIDGE } from "../../../../lib/dijie/dialog-model-bridge";
import { DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS } from "../../../../lib/dijie/role-package-generator";
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
                        inputTokenCentsPerMillion: 0,
                        outputTokenCentsPerMillion: 0,
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
              drafts.push({
                id,
                owner_id: input.ownerId as string,
                draft_status: "ready",
                source_message: input.sourceMessage,
                package_id: (input.uploadSummary as { packageId?: string } | undefined)?.packageId ?? null,
                package_version:
                  (input.uploadSummary as { packageVersion?: string } | undefined)?.packageVersion ?? null,
                generated_at: new Date("2026-06-05T01:00:00.000Z"),
                manifest_summary:
                  (input.uploadSummary as { manifestSummary?: unknown } | undefined)?.manifestSummary ?? null,
                file_manifest:
                  (input.uploadSummary as { files?: unknown[] } | undefined)?.files ?? [],
                package_files: input.files,
                capability_report: input.capabilityReport,
                quality_report: input.qualityReport,
                upload_validation_issues: input.uploadValidationIssues,
                blocking_issues: input.blockingIssues,
                model_usage: input.modelUsage,
                submitted_package_id: null,
              });
              return { draftId: id };
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
        "岗位定位：负责智能门锁电商视觉维护。任务型工作包括主图巡检、详情页巡检、产品保真自检、问题记录。日常型工作包括素材库维护和设计标准维护。",
    },
    {
      path: "role_package/listing.md",
      content: "智能门锁电商美工岗位，可进行主图巡检、详情页巡检、产品保真自检和问题记录。",
    },
    {
      path: "role_package/tool_requirements.md",
      content:
        "只声明能力需求，不包含工具源码。需要 browser、image.inspect、image.generate、human.confirm、audit.record 和 AICS 商品图片 adapter。",
    },
    {
      path: "role_package/integrations/openclaw-wrapper.md",
      content: "OpenClaw 集成示例：通过 requiredCapabilities 调用主系统工具，不包含实现代码。",
    },
    {
      path: "role_package/skills/main-image-inspection.md",
      content:
        "主图巡检 skill。输入：商品主图和商品资料。检查项：产品主体是否突出、背景是否杂乱、卖点是否明显、文字是否遮挡产品、产品是否变形。输出：《主图巡检记录》。失败标准：缺少图片理解能力或没有主图时失败。",
    },
    {
      path: "role_package/skills/detail-page-inspection.md",
      content:
        "详情页巡检 skill。输入：详情页图片。检查项：模块顺序是否合理、风格统一、文案是否好读、卖点是否清楚、是否有重复低清空洞模块。输出：《详情页视觉优化清单》。失败标准：没有浏览器或图片理解能力时失败。",
    },
    {
      path: "role_package/skills/product-fidelity-self-check.md",
      content:
        "产品保真自检 skill。输入：标准产品图和生成图。输出：通过/存疑/不通过、风险点、人工复核建议。人工复核为最终发布边界。",
    },
    {
      path: "role_package/skills/visual-issue-record.md",
      content:
        "问题记录 skill。记录商品、图片或页面位置、问题类型、严重程度、修改建议、状态。没有问题台账 adapter 时只能输出清单，不能声称已写入。",
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
          message: "我怎么上传岗位包？",
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

  it("generates and stores a role package draft for developer generation intent", async () => {
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

    expect(bridgeCalls).toBe(DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS.length);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      modelCalled: true,
      rolePackageDraft: {
        draftId: "djdraft_1",
        status: "ready",
        packageId: "visual_smart_lock_designer",
        packageVersion: "1.0.0",
        fileCount: 16,
        qualityReport: {
          ok: true,
          score: 100,
        },
      },
      persisted: {
        ledgerEntry: {
          usageKind: "model_tokens",
        },
      },
    });
    expect(JSON.stringify(res.body)).toContain("已生成岗位包草稿");
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
        forbiddenActions: [
          "bypass_goal_governance",
          "create_task_without_dispatch",
          "execute_without_entitlement",
        ],
      },
      modelCalled: false,
    });
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

    await POST(
      request(
        {
          surface: "admin_review",
          message: "帮我看这个岗位审核材料",
        },
        {
          actor_id: "platform_reviewer",
          actor_type: "admin",
          metadata: {
            marketplaceOwnerAccess: true,
          },
        },
        {
          completeDijieDialogMessage: async () => ({
            reply: "审核建议：先核对权限边界、价格和敏感信息。",
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
          }),
        },
      ) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      modelCalled: true,
      billingPolicy: {
        ledgerSource: "admin_review_assist",
      },
      capabilityPolicy: {
        requiresMarketplaceOwnerAccess: true,
      },
      persisted: {
        ledgerEntry: {
          source: "dialog_usage",
          usageKind: "model_tokens",
          platformReceivableCents: 3,
          developerReceivableCents: 0,
        },
      },
    });
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
