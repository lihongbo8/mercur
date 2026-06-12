import crypto from "node:crypto";
import { createDijieCapabilityMatchReport } from "./capability-bridge";
import type { DijieDialogBillingPolicy, DijieDialogContext } from "./dialog-context";
import {
  normalizeDijieDialogModelUsage,
  type DijieDialogModelUsage,
  type DijieOpenClawDialogModelBridge,
  type DijieOpenClawDialogModelInput,
  type DijieOpenClawDialogModelResult,
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
import {
  createDijieRoleCapabilityPlan,
  type DijieCatalogItem,
  type DijieRoleCapabilityPlan,
} from "./role-skill-tool-planner";
import type { DijieRoleCategory } from "./role-category-registry";

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

export type DijieRolePackageGenerationCategoryContext = {
  category: DijieRoleCategory;
  inheritedCatalogRefs: string[];
  inheritedCapabilityRefs: string[];
};

class DijieRolePackageStageTimeoutError extends Error {
  constructor(
    readonly stage: RolePackageGenerationStage,
    readonly timeoutMs: number,
  ) {
    super(`role_package generation stage timed out after ${timeoutMs}ms`);
    this.name = "DijieRolePackageStageTimeoutError";
  }
}

class DijieRolePackageStageAbortError extends Error {
  constructor(readonly stage: RolePackageGenerationStage) {
    super("role_package generation stage aborted");
    this.name = "DijieRolePackageStageAbortError";
  }
}

export type DijieRolePackageGenerationResult =
  | { ok: true; complete: boolean; value: DijieGeneratedRolePackageDraft }
  | {
      ok: false;
      status: number;
      error: string;
      issues: string[];
      modelUsage?: DijieDialogModelUsage | null;
      capabilityReport?: ReturnType<typeof createDijieCapabilityMatchReport>;
      diagnostics?: DijieRolePackageGenerationDiagnostics;
    };

export const DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS = [
  "role_package/manifest.json",
  "role_package/README.md",
  "role_package/listing.md",
  "role_package/standards.md",
  "role_package/cadence.md",
  "role_package/validation.md",
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
      "manifest.json 的 permissions 必须是字符串数组。manifest 只保存岗位身份、平台品类绑定、抽象能力引用和文件清单，不写 requiredSkills、requiredTools、specialCapabilityRequests、工具源码、OpenClaw wrapper 或任何鉴权字段名。",
  },
  {
    id: "readme",
    label: "岗位 README",
    outputPath: "role_package/README.md",
    guidance:
      "README 必须写清岗位名称、岗位目标、服务对象、服务边界、输入输出概览、人工确认点和失败降级原则。",
  },
  {
    id: "listing",
    label: "商城展示说明",
    outputPath: "role_package/listing.md",
    guidance: "listing 必须面向开发者商城展示，说明适用商家、岗位能解决的业务问题、输入输出、服务标准摘要和上架边界。",
  },
  {
    id: "standards",
    label: "服务标准",
    outputPath: "role_package/standards.md",
    guidance:
      "standards.md 只描述岗位服务标准、质量标准、输入资料要求、输出物标准、人工复核标准和不能承诺的边界；不得写 Skill/Tool 实现。",
  },
  {
    id: "cadence",
    label: "服务节奏",
    outputPath: "role_package/cadence.md",
    guidance:
      "cadence.md 必须描述任务触发条件、日常节奏、每日/每周/每月工作安排、例外处理和停等人工确认的节奏。",
  },
  {
    id: "validation",
    label: "验收和失败标准",
    outputPath: "role_package/validation.md",
    guidance:
      "validation.md 必须描述通过、存疑、不通过、失败标准、降级动作、验收样例和人工复核建议；不要写英文 token、bearer、secret 或 backend id 字段名。",
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
const MIN_STAGE_TIMEOUT_MS = 50;
const MAX_STAGE_TIMEOUT_MS = 15 * 60_000;

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

function normalizeStageTimeoutMs(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/u.test(value)
        ? Number.parseInt(value, 10)
        : undefined;
  if (!parsed || !Number.isFinite(parsed)) {
    return null;
  }
  return Math.min(Math.max(parsed, MIN_STAGE_TIMEOUT_MS), MAX_STAGE_TIMEOUT_MS);
}

async function completeDijieRolePackageStage(input: {
  bridge: DijieOpenClawDialogModelBridge;
  modelInput: DijieOpenClawDialogModelInput;
  stage: RolePackageGenerationStage;
  timeoutMs: number | null;
}): Promise<DijieOpenClawDialogModelResult> {
  if (input.modelInput.signal?.aborted) {
    throw new DijieRolePackageStageAbortError(input.stage);
  }

  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      controller.abort(input.modelInput.signal?.reason);
      finish(() => reject(new DijieRolePackageStageAbortError(input.stage)));
    };
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      input.modelInput.signal?.removeEventListener("abort", abort);
      callback();
    };
    if (input.timeoutMs !== null) {
      timeout = setTimeout(() => {
        controller.abort();
        finish(() => reject(new DijieRolePackageStageTimeoutError(input.stage, input.timeoutMs ?? 0)));
      }, input.timeoutMs);
    }

    input.modelInput.signal?.addEventListener("abort", abort, { once: true });
    input.bridge
      .completeDijieDialogMessage({
        ...input.modelInput,
        signal: controller.signal,
      })
      .then((result) => finish(() => resolve(result)))
      .catch((error) => finish(() => reject(error)));
  });
}

function decodeEscapedJsonObjectText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{\\"')) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(`"${trimmed.replace(/\r/gu, "\\r").replace(/\n/gu, "\\n")}"`);
    return typeof decoded === "string" && decoded.trim().startsWith("{")
      ? decoded.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function extractDijieRolePackageJsonText(text: string): string {
  const trimmed = text.trim();
  const decodedEscapedJson = decodeEscapedJsonObjectText(trimmed);
  if (decodedEscapedJson) {
    return extractDijieRolePackageJsonText(decodedEscapedJson);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const start = trimmed.indexOf("{");
  const fencedIndex = fenced?.index;
  if (fenced?.[1] && fencedIndex !== undefined && (start === -1 || fencedIndex < start)) {
    return extractDijieRolePackageJsonText(fenced[1].trim());
  }

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
  categoryContext?: DijieRolePackageGenerationCategoryContext;
}): string {
  const previous = input.previousDraftSummary
    ? `\n已有草稿摘要：\n${input.previousDraftSummary}\n`
    : "";
  const requiredPaths = input.stage?.outputPaths ?? DIJIE_ROLE_PACKAGE_REQUIRED_OUTPUT_PATHS;
  const category = input.categoryContext;
  const categoryLines = category
    ? [
        `已选平台品类：${category.category.name} / ${category.category.categoryRef}。`,
        `继承品类包：${category.category.packBinding?.categoryPackRef ?? "未绑定"}；Skill 包：${category.category.packBinding?.skillPackRef ?? "未绑定"}；Tool 包：${category.category.packBinding?.toolPackRef ?? "未绑定"}。`,
        `继承能力引用：${category.inheritedCapabilityRefs.join("、") || "无"}。`,
        "岗位包只能写岗位说明、服务标准、日常管理、验收标准和业务知识；不得自造 Skill/Tool/MCP/API/provider 实现，不得把外部工具源码写入岗位包。",
        "如果开发者要求超出当前品类包的能力，只描述业务诉求，不要写 specialCapabilityRequests；开发者必须通过独立申请入口申请，由平台审核/建设品类包后再绑定。",
      ].join("\n")
    : "未提供平台品类上下文时不得猜测品类包或能力包。";
  return [
    "你是迭界AI开发者中心的岗位包开发助手。必须生成可上传的最小 role_package 文件内容。",
    "只返回 JSON，不要返回 Markdown 解释。JSON 结构必须是 { \"files\": [{ \"path\": string, \"content\": string }] }。",
    "岗位包不能包含 API key、数据库连接、MCP server、工具源码、店铺后台账号、用户私有数据、本地绝对路径或 raw metadata。",
    "生成的文件内容里不要出现这些英文敏感词或字段名：api_key、secret、provider_auth、access_token、refresh_token、bearer、raw_token、execution_token、actorId、deviceId、entitlementId、executionId、orderId、roleListingId、walletId、workspaceRef。需要表达时只用中文泛称“平台临时凭证”或“平台内部编号”。",
    "岗位包只描述岗位本身：岗位目标、服务对象、品类绑定、输入输出、服务标准、节奏、验收和失败标准。Skill、Tool、MCP、API、provider 和特殊能力申请都不属于岗位包。",
    "manifest 里的 requiredCapabilities 只能是平台品类包继承或能力规划得到的抽象能力引用，不得出现 requiredSkills、requiredTools、toolDefinitions、specialCapabilityRequests。",
    categoryLines,
    input.stage
      ? `本阶段只生成“${input.stage.label}”，必须且只需包含这些文件：${requiredPaths.join(", ")}。`
      : `必须包含这些文件：${requiredPaths.join(", ")}。`,
    "manifest.json 必须包含 manifestVersion:1、rolePackageId、version、name、entrypoint、permissions、requiredCapabilities、files。",
    "岗位包必须覆盖这些业务块：岗位名称、岗位目标、服务对象、平台品类、输入输出、服务标准、服务节奏、验收标准、失败标准。",
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

const DEFAULT_REQUIRED_CAPABILITIES = [
  "image.inspect",
  "copy.review",
  "browser.review",
  "audit.record",
  "human.confirm",
  "template.render",
  "design.standard.write",
];

const STABLE_CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function createRolePackageUploadFile(path: string, content: string): DijieRolePackageUploadFile {
  return {
    path,
    content,
    sha256: sha256(content),
    sizeBytes: Buffer.byteLength(content),
  };
}

function sanitizeGeneratedRolePackageText(content: string): string {
  return content
    .replace(/api[_-]?key/giu, "接口密钥字段")
    .replace(/provider[_-]?(?:auth|key)/giu, "供应商鉴权字段")
    .replace(/access[_-]?token/giu, "访问凭证字段")
    .replace(/refresh[_-]?token/giu, "刷新凭证字段")
    .replace(/raw[_-]?(?:execution[_-]?)?token/giu, "原始执行凭证字段")
    .replace(/execution[_-]?token/giu, "执行凭证字段")
    .replace(/\bbearer\b/giu, "鉴权凭证格式")
    .replace(/\bsecret(s)?\b/giu, "密钥字段")
    .replace(/\bbackend ids?\b/giu, "平台内部编号")
    .replace(
      /\b(?:exec|cus|ent|ord|ordgrp|wallet|device|workspace|gateway|audit|settlement)_[A-Za-z0-9][A-Za-z0-9_-]*\b/giu,
      "平台内部编号",
    )
    .replace(/\bactorId\b/gu, "参与方内部编号")
    .replace(/\bdeviceId\b/gu, "设备内部编号")
    .replace(/\bentitlementId\b/gu, "授权内部编号")
    .replace(/\bexecutionId\b/gu, "执行内部编号")
    .replace(/\borderId\b/gu, "订单内部编号")
    .replace(/\broleListingId\b/gu, "岗位商品内部编号")
    .replace(/\bwalletId\b/gu, "钱包内部编号")
    .replace(/\bworkspaceRef\b/gu, "工作区内部引用");
}

function stableCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => STABLE_CAPABILITY_PATTERN.test(item))
    .filter(
      (item) =>
        !/(api[_-]?key|secret|provider[_-]?auth|access[_-]?token|refresh[_-]?token|bearer|raw[_-]?token|execution[_-]?token)/iu.test(
          item,
        ),
    );
}

function repairGeneratedManifest(
  manifestFile: DijieRolePackageUploadFile | undefined,
  files: DijieRolePackageUploadFile[],
  plan?: DijieRoleCapabilityPlan,
  categoryContext?: DijieRolePackageGenerationCategoryContext,
): DijieRolePackageUploadFile | undefined {
  if (!manifestFile?.content) {
    return manifestFile;
  }

  let manifest: UnknownRecord;
  try {
    manifest = asRecord(JSON.parse(manifestFile.content));
  } catch {
    return manifestFile;
  }

  const packagePaths = files.map((file) => file.path);
  const capabilities = [
    ...stableCapabilities(manifest.requiredCapabilities ?? manifest.required_capabilities),
    ...stableCapabilities(categoryContext?.inheritedCapabilityRefs),
    ...stableCapabilities(plan?.requiredCapabilities),
    ...DEFAULT_REQUIRED_CAPABILITIES,
  ];
  const entrypoint = stringField(manifest, "entrypoint");
  const categoryBinding = categoryContext?.category.packBinding ?? null;
  const inheritedCatalogRefs = categoryContext?.inheritedCatalogRefs ?? [];
  const inheritedCapabilityRefs = categoryContext?.inheritedCapabilityRefs ?? [];
  const safeManifest = { ...manifest };
  delete safeManifest.specialCapabilityRequests;
  delete safeManifest.special_capability_requests;
  delete safeManifest.specialCapabilities;
  delete safeManifest.special_capabilities;
  delete safeManifest.requiredSkills;
  delete safeManifest.required_skills;
  delete safeManifest.requiredTools;
  delete safeManifest.required_tools;
  delete safeManifest.toolDefinitions;
  delete safeManifest.tool_definitions;
  delete safeManifest.capabilityPlanStatus;
  delete safeManifest.capability_plan_status;
  const repaired = {
    ...safeManifest,
    manifestVersion: 1,
    ...(categoryContext
      ? {
          categoryRef: categoryContext.category.categoryRef,
          categoryName: categoryContext.category.name,
          categoryPackRef: categoryBinding?.categoryPackRef ?? null,
          skillPackRef: categoryBinding?.skillPackRef ?? null,
          toolPackRef: categoryBinding?.toolPackRef ?? null,
          inheritedCatalogRefs,
          inheritedCapabilityRefs,
        }
      : {}),
    rolePackageId:
      stringField(manifest, "rolePackageId") ??
      stringField(manifest, "packageId") ??
      "generated_role_package",
    version: stringField(manifest, "version") ?? "1.0.0",
    name: stringField(manifest, "name") ?? `${categoryContext?.category.name ?? "平台品类"}岗位`,
    entrypoint: entrypoint?.startsWith("role_package/") ? entrypoint : "role_package/README.md",
    permissions: Array.isArray(manifest.permissions)
      ? manifest.permissions.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : ["role.execute", "audit.record", "human.confirm"],
    requiredCapabilities: [...new Set(capabilities)],
    files: packagePaths,
  };

  return createRolePackageUploadFile(manifestFile.path, `${JSON.stringify(repaired, null, 2)}\n`);
}

function repairGeneratedFilesForUpload(
  files: DijieRolePackageUploadFile[],
  plan?: DijieRoleCapabilityPlan,
  categoryContext?: DijieRolePackageGenerationCategoryContext,
): DijieRolePackageUploadFile[] {
  const sanitizedFiles = files.map((file) => {
    if (!file.content || file.path.endsWith(".json")) {
      return file;
    }
    const content = sanitizeGeneratedRolePackageText(file.content);
    return content === file.content ? file : createRolePackageUploadFile(file.path, content);
  });
  const manifestFile = repairGeneratedManifest(
    sanitizedFiles.find((file) => file.path === "role_package/manifest.json"),
    sanitizedFiles,
    plan,
    categoryContext,
  );
  if (!manifestFile) {
    return sanitizedFiles;
  }
  return sanitizedFiles.map((file) =>
    file.path === "role_package/manifest.json" ? manifestFile : file,
  );
}

function applyCapabilityPlanToGeneratedFiles(input: {
  files: DijieRolePackageUploadFile[];
  message: string;
  catalogItems?: DijieCatalogItem[];
  categoryContext?: DijieRolePackageGenerationCategoryContext;
}) {
  const capabilityPlan = createDijieRoleCapabilityPlan(
    {
      files: input.files,
      message: input.message,
    },
    {
      catalogItems: input.catalogItems,
    },
  );

  return repairGeneratedFilesForUpload(input.files, capabilityPlan, input.categoryContext);
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

function createPlainTextStageFiles(
  stage: RolePackageGenerationStage,
  reply: string,
): DijieRolePackageUploadFile[] {
  if (stage.outputPaths.length !== 1) {
    return [];
  }

  const path = stage.outputPaths[0];
  if (path.endsWith(".json")) {
    return [];
  }

  const trimmed = reply.trim();
  if (!trimmed || trimmed.length < 20 || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return [];
  }

  const fenced = trimmed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/u);
  const content = (fenced?.[1] ?? trimmed).trim();
  if (!content || content.length < 20) {
    return [];
  }

  return [
    {
      path,
      content,
      sha256: sha256(content),
      sizeBytes: Buffer.byteLength(content),
    },
  ];
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
  catalogItems?: DijieCatalogItem[];
  categoryContext?: DijieRolePackageGenerationCategoryContext;
  initialFiles?: DijieRolePackageUploadFile[];
  maxStages?: number;
  stageTimeoutMs?: number;
  signal?: AbortSignal;
  previousDraftSummary?: string;
  onStageFiles?: (input: {
    stage: RolePackageGenerationStage;
    files: DijieRolePackageUploadFile[];
    allFiles: DijieRolePackageUploadFile[];
    modelUsage: DijieDialogModelUsage | null;
  }) => Promise<void>;
}): Promise<DijieRolePackageGenerationResult> {
  const generatedFiles: DijieRolePackageUploadFile[] = mergeGeneratedFiles(input.initialFiles ?? []);
  const modelUsages: Array<DijieDialogModelUsage | null> = [];
  const maxStages =
    Number.isInteger(input.maxStages) && input.maxStages && input.maxStages > 0
      ? input.maxStages
      : 1;
  let processedStages = 0;
  let stoppedAfterMaxStages = false;
  const stageTimeoutMs = normalizeStageTimeoutMs(
    input.stageTimeoutMs ?? process.env.DIJIE_ROLE_PACKAGE_STAGE_TIMEOUT_MS,
  );

  for (const stage of GENERATION_STAGES) {
    const existingPaths = new Set(generatedFiles.map((file) => file.path));
    if (stage.outputPaths.every((path) => existingPaths.has(path))) {
      continue;
    }
    if (maxStages !== undefined && processedStages >= maxStages) {
      stoppedAfterMaxStages = true;
      break;
    }

    const instruction = createDijieRolePackageGenerationInstruction({
      message: input.message,
      previousDraftSummary: input.previousDraftSummary,
      stage,
      categoryContext: input.categoryContext,
    });
    let modelResult;
    try {
      // oxlint-disable-next-line no-await-in-loop -- Each generation stage depends on the previous staged draft.
      modelResult = await completeDijieRolePackageStage({
        bridge: input.bridge,
        stage,
        timeoutMs: stageTimeoutMs,
        modelInput: {
          context: input.context,
          billingPolicy: input.billingPolicy,
          message: instruction,
          fallbackReply: `请生成${stage.label} role_package JSON。`,
          roles: [],
          signal: input.signal,
        },
      });
    } catch (error) {
      if (error instanceof DijieRolePackageStageAbortError) {
        return {
          ok: false,
          status: 499,
          error: `AI开发助手生成 ${stage.label} 已取消。`,
          issues: [`${stage.id}: model_bridge_aborted`],
          modelUsage: combineDijieDialogModelUsages(modelUsages),
          diagnostics: {
            stageId: stage.id,
            stageLabel: stage.label,
          },
        };
      }
      if (error instanceof DijieRolePackageStageTimeoutError) {
        return {
          ok: false,
          status: 504,
          error: `AI开发助手生成 ${stage.label} 超过 ${Math.ceil(error.timeoutMs / 1000)} 秒，已停止本阶段。`,
          issues: [`${stage.id}: model_bridge_timeout`],
          modelUsage: combineDijieDialogModelUsages(modelUsages),
          diagnostics: {
            stageId: stage.id,
            stageLabel: stage.label,
          },
        };
      }
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
        // oxlint-disable-next-line no-await-in-loop -- JSON repair is scoped to the current staged model reply.
        repairResult = await completeDijieRolePackageStage({
          bridge: input.bridge,
          stage,
          timeoutMs: stageTimeoutMs,
          modelInput: {
            context: input.context,
            billingPolicy: input.billingPolicy,
            message: createDijieRolePackageJsonRepairInstruction({
              stage,
              reply: modelResult.reply,
            }),
            fallbackReply: `请把${stage.label}转换为 role_package JSON。`,
            roles: [],
            signal: input.signal,
          },
        });
      } catch (error) {
        if (error instanceof DijieRolePackageStageAbortError) {
          return {
            ok: false,
            status: 499,
            error: `AI开发助手修复 ${stage.label} JSON 已取消。`,
            issues: [`${stage.id}: model_bridge_aborted`],
            modelUsage: combineDijieDialogModelUsages(modelUsages),
            diagnostics: {
              stageId: stage.id,
              stageLabel: stage.label,
              replyPreview: createReplyPreview(modelResult.reply),
            },
          };
        }
        if (error instanceof DijieRolePackageStageTimeoutError) {
          return {
            ok: false,
            status: 504,
            error: `AI开发助手修复 ${stage.label} JSON 超过 ${Math.ceil(error.timeoutMs / 1000)} 秒，已停止本阶段。`,
            issues: [`${stage.id}: model_bridge_timeout`],
            modelUsage: combineDijieDialogModelUsages(modelUsages),
            diagnostics: {
              stageId: stage.id,
              stageLabel: stage.label,
              replyPreview: createReplyPreview(modelResult.reply),
            },
          };
        }
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
        const plainFiles = [
          ...createPlainTextStageFiles(stage, modelResult.reply),
          ...createPlainTextStageFiles(stage, repairResult.reply),
        ];
        if (plainFiles.length > 0) {
          parsed = { files: plainFiles };
        } else {
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
    }

    const stageFiles = filterFilesForStage(normalizeGeneratedFiles(parsed), stage);
    generatedFiles.push(...stageFiles);
    processedStages += 1;
    if (input.onStageFiles) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- Draft persistence must follow staged generation order.
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
  const mergedFiles = mergeGeneratedFiles(generatedFiles);
  const missingPaths = missingGeneratedPaths(mergedFiles);
  if (mergedFiles.length === 0) {
    return {
      ok: false,
      status: 502,
      error: "AI开发助手没有生成岗位包文件。",
      issues: ["missing_files"],
      modelUsage,
    };
  }

  const files =
    missingPaths.length === 0
      ? applyCapabilityPlanToGeneratedFiles({
          files: mergedFiles,
          message: input.message,
          catalogItems: input.catalogItems,
          categoryContext: input.categoryContext,
        })
      : mergedFiles;
  const uploadBody = { files };
  if (missingPaths.length > 0 && stoppedAfterMaxStages) {
    return {
      ok: true,
      complete: false,
      value: {
        files,
        uploadValidationIssues: [],
        qualityReport: evaluateDijieRolePackageQuality(files),
        capabilityReport: createDijieCapabilityMatchReport(
          {
            files: readDijieRolePackageUploadFilesForStorage(uploadBody),
            message: input.message,
          },
          {
            catalogItems: input.catalogItems,
          },
        ),
        modelUsage,
      },
    };
  }

  const uploadValidation = validateDijieRolePackageUpload(uploadBody);
  const uploadValidationIssues = uploadValidation.ok ? [] : uploadValidation.issues;
  const qualityReport = evaluateDijieRolePackageQuality(files);
  const capabilityReport = createDijieCapabilityMatchReport(
    {
      files: readDijieRolePackageUploadFilesForStorage(uploadBody),
      message: input.message,
    },
    {
      catalogItems: input.catalogItems,
    },
  );
  const issues = [
    ...missingPaths.map((path) => `missing ${path}`),
    ...uploadValidationIssues,
    ...qualityReport.blockingIssues,
    ...(capabilityReport.reviewBlockers ?? []),
  ];

  if (issues.length > 0 || !uploadValidation.ok || !qualityReport.ok) {
    return {
      ok: false,
      status: 422,
      error: "AI开发助手生成的岗位包未通过质量验收。",
      issues: [...new Set(issues)],
      modelUsage,
      capabilityReport,
    };
  }

  return {
    ok: true,
    complete: true,
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
