import crypto from "node:crypto";
import { createDijieCapabilityMatchReport } from "./capability-bridge";
import type { DijieDialogBillingPolicy, DijieDialogContext } from "./dialog-context";
import {
  normalizeDijieDialogModelUsage,
  type DijieDialogModelUsage,
  type DijieOpenClawDialogModelBridge,
} from "./dialog-model-bridge";
import {
  readDijieRolePackageUploadFilesForStorage,
  validateDijieRolePackageUpload,
  type DijieRolePackageUploadFile,
  type DijieRolePackageUploadSummary,
} from "./role-package-upload";
import {
  evaluateDijieRolePackageQuality,
  type DijieRolePackageQualityReport,
} from "./role-package-quality";

type UnknownRecord = Record<string, unknown>;

export type DijieGeneratedRolePackageDraft = {
  files: DijieRolePackageUploadFile[];
  uploadSummary?: DijieRolePackageUploadSummary;
  uploadValidationIssues: string[];
  qualityReport: DijieRolePackageQualityReport;
  capabilityReport: ReturnType<typeof createDijieCapabilityMatchReport>;
  modelUsage: DijieDialogModelUsage | null;
};

type DijieRolePackageGenerationDiagnostics = {
  stageId?: string;
  stageLabel?: string;
  replyPreview?: string;
  repairReplyPreview?: string;
};

export type DijieRolePackageGenerationResult =
  | { ok: true; value: DijieGeneratedRolePackageDraft }
  | {
      ok: false;
      status: number;
      error: string;
      issues: string[];
      modelUsage?: DijieDialogModelUsage | null;
      diagnostics?: DijieRolePackageGenerationDiagnostics;
    };

export const DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS = [
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

export type RolePackageGenerationStage = {
  id: string;
  label: string;
  outputPaths: string[];
  guidance: string;
  final?: boolean;
};

const GENERATION_FILE_STAGES: Array<Omit<RolePackageGenerationStage, "outputPaths"> & {
  outputPath: string;
}> = [
  {
    id: "manifest",
    label: "manifest.json",
    outputPath: "role_package/manifest.json",
    guidance:
      "manifest.json 的 permissions 必须是字符串数组，例如 [\"image.inspect\", \"browser.review\", \"audit.record\", \"human.confirm\", \"template.render\"]。OpenClaw wrapper 只描述平台注入能力，不写任何鉴权字段名或内部编号字段名。",
  },
  {
    id: "readme",
    label: "岗位 README",
    outputPath: "role_package/README.md",
    guidance:
      "README 必须写清岗位定位、任务型工作、日常型工作、每日/每周/每月 SOP、人工确认点和失败降级策略。",
  },
  {
    id: "listing",
    label: "商城展示说明",
    outputPath: "role_package/listing.md",
    guidance: "listing 必须面向开发者商城展示，说明适用商家、核心能力、输入输出和上架边界。",
  },
  {
    id: "tool_requirements",
    label: "能力要求说明",
    outputPath: "role_package/tool_requirements.md",
    guidance:
      "只声明 requiredCapabilities 和 adapter 需求，不写工具源码、MCP server、鉴权字段或内部编号字段名。",
  },
  {
    id: "openclaw_wrapper",
    label: "OpenClaw wrapper 说明",
    outputPath: "role_package/integrations/openclaw-wrapper.md",
    guidance:
      "只描述平台如何注入能力和人工确认边界，不写任何鉴权字段名、token、backend id 或本地路径。",
  },
  {
    id: "sop",
    label: "知识库 SOP",
    outputPath: "role_package/knowledge/sop.md",
    guidance: "必须包含每日、每周、每月 SOP，以及资料不足、合规风险、平台限制时的处理流程。",
  },
  {
    id: "design_rules",
    label: "设计规则知识库",
    outputPath: "role_package/knowledge/design-rules.md",
    guidance:
      "必须覆盖智能门锁主图、详情页、海报的视觉规范、合规词规则、产品保真和人工复核规则。",
  },
  {
    id: "main_image_skill",
    label: "主图巡检 skill",
    outputPath: "role_package/skills/main-image-inspection.md",
    guidance:
      "必须写清输入、步骤、输出、失败处理和人工确认点。重点检查产品主体、背景、卖点、遮挡、变形和平台合规。",
  },
  {
    id: "detail_page_skill",
    label: "详情页巡检 skill",
    outputPath: "role_package/skills/detail-page-inspection.md",
    guidance:
      "必须写清输入、步骤、输出、失败处理和人工确认点。重点检查模块顺序、风格统一、文案可读性、卖点表达和低清重复模块。",
  },
  {
    id: "product_fidelity_skill",
    label: "产品保真自检 skill",
    outputPath: "role_package/skills/product-fidelity-self-check.md",
    guidance:
      "每个 skill 必须写清输入、步骤、输出、失败处理和人工确认点。product-fidelity-self-check 必须明确输出“通过 / 存疑 / 不通过”，并要求存疑时人工复核。",
  },
  {
    id: "visual_issue_skill",
    label: "问题记录 skill",
    outputPath: "role_package/skills/visual-issue-record.md",
    guidance:
      "必须写清如何记录商品、图片位置、问题类型、严重程度、修改建议、状态和人工确认边界。",
  },
  {
    id: "design_standard_skill",
    label: "设计标准维护 skill",
    outputPath: "role_package/skills/design-standard-maintenance.md",
    guidance:
      "必须写清如何把反复出现的问题沉淀为设计规则，以及写入标准库前的人工确认点。",
  },
  {
    id: "main_image_template",
    label: "主图巡检记录模板",
    outputPath: "role_package/templates/main-image-inspection-record.md",
    guidance: "模板必须包含商品、图片位置、问题、严重程度、修改建议、状态和人工确认字段。",
  },
  {
    id: "detail_page_template",
    label: "详情页视觉优化清单模板",
    outputPath: "role_package/templates/detail-page-optimization-checklist.md",
    guidance: "模板必须包含模块顺序、风格统一、文案、卖点、低清重复模块和验收结果字段。",
  },
  {
    id: "smoke_test",
    label: "smoke test",
    outputPath: "role_package/validation/smoke-test.md",
    guidance:
      "validation 必须包含主图巡检、详情页巡检、产品保真自检、问题记录的 smoke test 和失败标准。",
  },
  {
    id: "acceptance_samples",
    label: "验收样例",
    outputPath: "role_package/validation/acceptance-samples.md",
    guidance:
      "必须包含至少两个验收样例，并明确通过、存疑、不通过三类结果和人工复核建议。不要写英文 token、bearer、secret 或 backend id 字段名。",
  },
];

const GENERATION_STAGES: RolePackageGenerationStage[] = GENERATION_FILE_STAGES.map(
  (stage, index) => ({
    id: stage.id,
    label: stage.label,
    outputPaths: [stage.outputPath],
    guidance: stage.guidance,
    final: index === GENERATION_FILE_STAGES.length - 1,
  }),
);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function createReplyPreview(text: string): string {
  return text
    .replace(/(api_key|secret|provider_auth|access_token|refresh_token|bearer|raw_token)\s*[:=]\s*["']?[^"'\s,}]+/giu, "$1=[redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 800);
}

export function extractDijieRolePackageJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  if (start === -1) {
    return trimmed;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  return trimmed;
}

function normalizeGeneratedFiles(value: unknown): DijieRolePackageUploadFile[] {
  const record = asRecord(value);
  const files = record.files ?? asRecord(record.rolePackage).files;
  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file): DijieRolePackageUploadFile[] => {
    const input = asRecord(file);
    const path = stringField(input, "path") ?? stringField(input, "relativePath");
    const content = stringField(input, "content");
    if (!path || !content) {
      return [];
    }
    return [
      {
        path: path.trim().replace(/\\/g, "/").replace(/^\.?\//u, ""),
        content,
        sha256: sha256(content),
        sizeBytes: Buffer.byteLength(content),
      },
    ];
  });
}

export function missingGeneratedPaths(files: DijieRolePackageUploadFile[]): string[] {
  const paths = new Set(files.map((file) => file.path));
  return DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS.filter((path) => !paths.has(path));
}

export function isDijieRolePackageGenerationIntent(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (
    /(?:不要|不需要|无需|先别|别|勿|禁止).{0,12}(?:生成|创建|开发|输出|写出).{0,12}(?:岗位包|role_package|文件|manifest|skill|sop|template|validation)/u.test(
      text,
    )
  ) {
    return false;
  }
  return (
    /岗位|role_package|manifest|skill|sop|templates?|validation|验收|智能体/u.test(text) &&
    /生成|创建|开发|做一个|补|继续|输出|写出|manifest|skill|sop|templates?|validation/u.test(text)
  );
}

export function createDijieRolePackageGenerationInstruction(input: {
  message: string;
  previousDraftSummary?: string;
  stage?: RolePackageGenerationStage;
}): string {
  const previous = input.previousDraftSummary
    ? `\n已有草稿摘要：\n${input.previousDraftSummary}\n`
    : "";
  const requiredPaths = input.stage?.outputPaths ?? DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS;
  return [
    "你是迭界AI开发者中心的岗位包开发助手。必须生成可上传的 role_package 文件内容。",
    "只返回 JSON，不要返回 Markdown 解释。JSON 结构必须是 { \"files\": [{ \"path\": string, \"content\": string }] }。",
    "岗位包不能包含 API key、数据库连接、MCP server、工具源码、店铺后台账号、用户私有数据、本地绝对路径或 raw metadata。",
    "生成的文件内容里不要出现这些英文敏感词或字段名：api_key、secret、provider_auth、access_token、refresh_token、bearer、raw_token、execution_token、actorId、deviceId、entitlementId、executionId、orderId、roleListingId、walletId、workspaceRef。需要表达时只用中文泛称“平台临时凭证”或“平台内部编号”。",
    "岗位包只声明 requiredCapabilities，真实工具由 AICS / OpenClaw 主系统提供。",
    input.stage
      ? `本阶段只生成“${input.stage.label}”，必须且只需包含这些文件：${requiredPaths.join(", ")}。`
      : `必须包含这些文件：${requiredPaths.join(", ")}。`,
    "manifest.json 必须包含 manifestVersion:1、rolePackageId、version、name、entrypoint、permissions、requiredCapabilities、files。",
    "智能门锁电商美工岗位必须覆盖：岗位定位、任务型工作、日常型工作、每日/每周/每月 SOP、主图巡检、详情页巡检、产品保真自检、问题记录、设计标准维护、输出模板、验收样例、失败标准。",
    input.stage?.guidance ?? "",
    previous,
    `开发者需求：\n${input.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function filterFilesForStage(
  files: DijieRolePackageUploadFile[],
  stage: RolePackageGenerationStage,
): DijieRolePackageUploadFile[] {
  const allowed = new Set(stage.outputPaths);
  return files.filter((file) => allowed.has(file.path));
}

function mergeGeneratedFiles(files: DijieRolePackageUploadFile[]): DijieRolePackageUploadFile[] {
  const byPath = new Map<string, DijieRolePackageUploadFile>();
  for (const file of files) {
    byPath.set(file.path, file);
  }
  return DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS.flatMap((path) => {
    const file = byPath.get(path);
    return file ? [file] : [];
  });
}

function createDijieRolePackageJsonRepairInstruction(input: {
  stage: RolePackageGenerationStage;
  reply: string;
}): string {
  return [
    "上一轮输出不是可解析 JSON。不要补充解释，不要使用 Markdown。",
    "只把上一轮内容转换为 JSON：{ \"files\": [{ \"path\": string, \"content\": string }] }。",
    `只能包含这些 path：${input.stage.outputPaths.join(", ")}。`,
    "如果上一轮内容缺失某个文件，请根据阶段要求补齐该文件内容。",
    "content 必须是字符串；不要出现 api_key、secret、provider_auth、access_token、refresh_token、bearer、raw_token、execution_token、actorId、deviceId、entitlementId、executionId、orderId、roleListingId、walletId、workspaceRef。",
    `上一轮输出：\n${input.reply.trim().slice(0, 24_000)}`,
  ].join("\n");
}

function combineDijieDialogModelUsages(
  usages: Array<DijieDialogModelUsage | null>,
): DijieDialogModelUsage | null {
  const normalized = usages.filter((usage): usage is DijieDialogModelUsage => Boolean(usage));
  if (normalized.length === 0) {
    return null;
  }

  const first = normalized[0];
  const pricingKnown = normalized.every((usage) => usage.pricing.pricingKnown);
  return {
    provider: first.provider,
    model: first.model,
    requestCount: normalized.reduce((sum, usage) => sum + usage.requestCount, 0),
    promptTokens: normalized.reduce((sum, usage) => sum + usage.promptTokens, 0),
    completionTokens: normalized.reduce((sum, usage) => sum + usage.completionTokens, 0),
    cacheReadTokens: normalized.reduce((sum, usage) => sum + usage.cacheReadTokens, 0),
    cacheWriteTokens: normalized.reduce((sum, usage) => sum + usage.cacheWriteTokens, 0),
    totalTokens: normalized.reduce((sum, usage) => sum + usage.totalTokens, 0),
    pricing: {
      pricingKnown,
      pricingSource: pricingKnown ? first.pricing.pricingSource : "missing",
      ...(pricingKnown
        ? {
            grossAmountCents: normalized.reduce(
              (sum, usage) => sum + (usage.pricing.grossAmountCents ?? 0),
              0,
            ),
            platformReceivableCents: normalized.reduce(
              (sum, usage) => sum + (usage.pricing.platformReceivableCents ?? 0),
              0,
            ),
            developerReceivableCents: normalized.reduce(
              (sum, usage) => sum + (usage.pricing.developerReceivableCents ?? 0),
              0,
            ),
          }
        : {}),
    },
  };
}

export async function generateDijieRolePackageDraftWithModel(input: {
  bridge: DijieOpenClawDialogModelBridge;
  context: DijieDialogContext;
  billingPolicy: DijieDialogBillingPolicy;
  message: string;
  previousDraftSummary?: string;
  onStageFiles?: (input: {
    stage: RolePackageGenerationStage;
    files: DijieRolePackageUploadFile[];
    allFiles: DijieRolePackageUploadFile[];
    modelUsage: DijieDialogModelUsage | null;
  }) => Promise<void>;
}): Promise<DijieRolePackageGenerationResult> {
  const generatedFiles: DijieRolePackageUploadFile[] = [];
  const modelUsages: Array<DijieDialogModelUsage | null> = [];

  for (const stage of GENERATION_STAGES) {
    const instruction = createDijieRolePackageGenerationInstruction({
      message: input.message,
      previousDraftSummary: input.previousDraftSummary,
      stage,
    });
    let modelResult;
    try {
      modelResult = await input.bridge.completeDijieDialogMessage({
        context: input.context,
        billingPolicy: input.billingPolicy,
        message: instruction,
        fallbackReply: `请生成${stage.label} role_package JSON。`,
        roles: [],
      });
    } catch (error) {
      return {
        ok: false,
        status: 503,
        error:
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "OpenClaw 模型桥调用失败。",
        issues: [`${stage.id}: model_bridge_call_failed`],
        modelUsage: combineDijieDialogModelUsages(modelUsages),
      };
    }

    const modelUsage = normalizeDijieDialogModelUsage(modelResult.usage);
    modelUsages.push(modelUsage);

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractDijieRolePackageJsonText(modelResult.reply));
    } catch {
      let repairResult;
      try {
        repairResult = await input.bridge.completeDijieDialogMessage({
          context: input.context,
          billingPolicy: input.billingPolicy,
          message: createDijieRolePackageJsonRepairInstruction({
            stage,
            reply: modelResult.reply,
          }),
          fallbackReply: `请把${stage.label}转换为 role_package JSON。`,
          roles: [],
        });
      } catch (error) {
        return {
          ok: false,
          status: 503,
          error:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "OpenClaw 模型桥调用失败。",
          issues: [`${stage.id}: model_bridge_call_failed`],
          modelUsage: combineDijieDialogModelUsages(modelUsages),
        };
      }

      modelUsages.push(normalizeDijieDialogModelUsage(repairResult.usage));
      try {
        parsed = JSON.parse(extractDijieRolePackageJsonText(repairResult.reply));
      } catch {
        return {
          ok: false,
          status: 502,
          error: "AI开发助手没有返回可解析的岗位包 JSON。",
          issues: [`${stage.id}: model_reply_not_json`],
          modelUsage: combineDijieDialogModelUsages(modelUsages),
          diagnostics: {
            stageId: stage.id,
            stageLabel: stage.label,
            replyPreview: createReplyPreview(modelResult.reply),
            repairReplyPreview: createReplyPreview(repairResult.reply),
          },
        };
      }
    }

    const stageFiles = filterFilesForStage(normalizeGeneratedFiles(parsed), stage);
    generatedFiles.push(...stageFiles);
    if (input.onStageFiles) {
      try {
        await input.onStageFiles({
          stage,
          files: stageFiles,
          allFiles: mergeGeneratedFiles(generatedFiles),
          modelUsage: combineDijieDialogModelUsages(modelUsages),
        });
      } catch (error) {
        return {
          ok: false,
          status: 503,
          error:
            error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "岗位包草稿阶段保存失败。",
          issues: [`${stage.id}: draft_store_update_failed`],
          modelUsage: combineDijieDialogModelUsages(modelUsages),
        };
      }
    }
  }

  const modelUsage = combineDijieDialogModelUsages(modelUsages);
  const files = mergeGeneratedFiles(generatedFiles);
  if (files.length === 0) {
    return {
      ok: false,
      status: 502,
      error: "AI开发助手没有生成岗位包文件。",
      issues: ["missing_files"],
      modelUsage,
    };
  }

  const missingPaths = missingGeneratedPaths(files);
  const uploadBody = { files };
  const uploadValidation = validateDijieRolePackageUpload(uploadBody);
  const uploadValidationIssues = uploadValidation.ok ? [] : uploadValidation.issues;
  const qualityReport = evaluateDijieRolePackageQuality(files);
  const capabilityReport = createDijieCapabilityMatchReport({
    files: readDijieRolePackageUploadFilesForStorage(uploadBody),
    message: input.message,
  });
  const issues = [...missingPaths.map((path) => `missing ${path}`), ...uploadValidationIssues, ...qualityReport.blockingIssues];

  if (issues.length > 0 || !uploadValidation.ok || !qualityReport.ok) {
    return {
      ok: false,
      status: 422,
      error: "AI开发助手生成的岗位包未通过质量验收。",
      issues: [...new Set(issues)],
      modelUsage,
    };
  }

  return {
    ok: true,
    value: {
      files,
      uploadSummary: uploadValidation.value,
      uploadValidationIssues,
      qualityReport,
      capabilityReport,
      modelUsage,
    },
  };
}
