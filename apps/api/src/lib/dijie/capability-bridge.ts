type UnknownRecord = Record<string, unknown>;

export type DijieCapabilityNeedType =
  | "skill"
  | "tool"
  | "provider"
  | "data_adapter"
  | "human_confirm"
  | "audit";

export type DijieCapabilitySearchStatus =
  | "available"
  | "candidate_found"
  | "generated_candidate"
  | "adapter_needed"
  | "missing"
  | "blocked";

export type DijieCapabilityNeed = {
  key: string;
  type: DijieCapabilityNeedType;
  source: string;
  requiredFor: string[];
};

export type DijieCapabilitySource = {
  key: string;
  type: DijieCapabilityNeedType;
  title: string;
  matchedFrom:
    | "openclaw_skill"
    | "extension_skill"
    | "plugin_tool"
    | "provider"
    | "aics_adapter"
    | "generated";
  ref: string;
  status: Exclude<DijieCapabilitySearchStatus, "missing" | "blocked">;
  maturity: "mature" | "built_in" | "candidate" | "adapter";
  reason: string;
  humanConfirmRequired?: boolean;
};

export type DijieCapabilitySearchResult = {
  key: string;
  type: DijieCapabilityNeedType;
  status: DijieCapabilitySearchStatus;
  matchedFrom?: DijieCapabilitySource["matchedFrom"];
  ref?: string;
  reason: string;
  requiredFor: string[];
};

export type DijieCapabilityMatchReport = {
  ok: boolean;
  requiredSkills: DijieCapabilityNeed[];
  requiredCapabilities: DijieCapabilityNeed[];
  results: DijieCapabilitySearchResult[];
  matchedSkills: DijieCapabilitySearchResult[];
  matchedTools: DijieCapabilitySearchResult[];
  adapterNeeded: DijieCapabilitySearchResult[];
  missing: DijieCapabilitySearchResult[];
  blockedReasons: string[];
};

export type DijieRoleCapabilityBinding = {
  rolePackageId?: string;
  roleListingId?: string;
  bindings: Array<{
    capabilityKey: string;
    status: DijieCapabilitySearchStatus;
    skillRef?: string;
    toolRef?: string;
    adapterRef?: string;
    validationStatus: "ready" | "needs_adapter" | "blocked";
  }>;
  blockedReasons: string[];
};

const SKILL_NEEDS: Array<{
  key: string;
  requiredFor: string[];
  keywords: string[];
}> = [
  {
    key: "visual.main_image.inspect",
    requiredFor: ["主图巡检"],
    keywords: ["主图", "商品图", "首图", "main image", "hero image"],
  },
  {
    key: "visual.detail_page.inspect",
    requiredFor: ["详情页巡检"],
    keywords: ["详情页", "页面巡检", "detail page", "landing page"],
  },
  {
    key: "visual.product_fidelity.self_check",
    requiredFor: ["产品保真自检"],
    keywords: ["保真", "标准产品图", "产品一致", "fidelity"],
  },
  {
    key: "visual.issue.record",
    requiredFor: ["问题记录"],
    keywords: ["问题记录", "问题台账", "记录问题", "issue"],
  },
  {
    key: "visual.design_standard.maintain",
    requiredFor: ["设计标准维护"],
    keywords: ["设计标准", "标准维护", "沉淀", "规则"],
  },
  {
    key: "visual.asset_library.maintain",
    requiredFor: ["素材库维护"],
    keywords: ["素材库", "素材", "asset"],
  },
  {
    key: "visual.competitor.analyze",
    requiredFor: ["竞品视觉分析"],
    keywords: ["竞品", "竞对", "competitive"],
  },
];

const CAPABILITY_NEEDS: Array<{
  key: string;
  type: DijieCapabilityNeedType;
  requiredFor: string[];
  keywords: string[];
}> = [
  {
    key: "browser",
    type: "tool",
    requiredFor: ["页面巡检", "竞品视觉分析"],
    keywords: ["browser", "浏览器", "页面", "线上页面", "竞品"],
  },
  {
    key: "web_search",
    type: "tool",
    requiredFor: ["竞品视觉分析"],
    keywords: ["web_search", "搜索", "竞品", "tavily", "firecrawl", "brave"],
  },
  {
    key: "web_fetch",
    type: "tool",
    requiredFor: ["页面巡检", "竞品视觉分析"],
    keywords: ["web_fetch", "抓取", "网页", "firecrawl"],
  },
  {
    key: "image.inspect",
    type: "provider",
    requiredFor: ["主图巡检", "详情页巡检", "产品保真自检"],
    keywords: ["image.inspect", "图片理解", "图片检查", "视觉", "保真", "主图"],
  },
  {
    key: "image.generate",
    type: "provider",
    requiredFor: ["海报生成", "图片生成"],
    keywords: ["image.generate", "图片生成", "海报", "生成图"],
  },
  {
    key: "aics_product_db.query_products",
    type: "data_adapter",
    requiredFor: ["商品资料读取"],
    keywords: ["商品资料", "商品库", "产品资料", "重点商品"],
  },
  {
    key: "aics_product_db.get_product_detail",
    type: "data_adapter",
    requiredFor: ["商品详情读取"],
    keywords: ["商品详情", "产品详情", "get_product_detail"],
  },
  {
    key: "aics_product_assets.get_reference_images",
    type: "data_adapter",
    requiredFor: ["产品保真自检"],
    keywords: ["标准产品图", "参考图", "reference image"],
  },
  {
    key: "aics_product_assets.get_main_images",
    type: "data_adapter",
    requiredFor: ["主图巡检"],
    keywords: ["主图", "商品图", "main image"],
  },
  {
    key: "aics_product_assets.get_detail_images",
    type: "data_adapter",
    requiredFor: ["详情页巡检"],
    keywords: ["详情页图", "详情图", "detail image"],
  },
  {
    key: "aics_product_fidelity.self_check",
    type: "data_adapter",
    requiredFor: ["产品保真自检"],
    keywords: ["产品保真自检", "self_check", "保真初检"],
  },
  {
    key: "aics_visual_issue.create_issue",
    type: "data_adapter",
    requiredFor: ["问题记录"],
    keywords: ["问题记录", "问题台账", "create_issue"],
  },
  {
    key: "aics_visual_issue.update_status",
    type: "data_adapter",
    requiredFor: ["问题状态更新"],
    keywords: ["问题状态", "update_status", "关闭问题"],
  },
  {
    key: "aics_design_standard.get_rules",
    type: "data_adapter",
    requiredFor: ["读取设计标准"],
    keywords: ["读取设计标准", "get_rules", "设计规则"],
  },
  {
    key: "aics_design_standard.add_rule",
    type: "data_adapter",
    requiredFor: ["设计标准维护"],
    keywords: ["设计标准", "add_rule", "规则"],
  },
  {
    key: "aics_asset_library.save_asset",
    type: "data_adapter",
    requiredFor: ["素材库维护"],
    keywords: ["保存素材", "save_asset", "素材库"],
  },
  {
    key: "aics_asset_library.search_assets",
    type: "data_adapter",
    requiredFor: ["素材库检索"],
    keywords: ["检索素材", "search_assets", "素材库"],
  },
  {
    key: "human.confirm",
    type: "human_confirm",
    requiredFor: ["人工确认"],
    keywords: ["human.confirm", "人工确认", "人工复核", "最终发布"],
  },
  {
    key: "audit.record",
    type: "audit",
    requiredFor: ["审计记录"],
    keywords: ["audit.record", "审计", "audit"],
  },
  {
    key: "workspace.read",
    type: "tool",
    requiredFor: ["读取本地资料"],
    keywords: ["workspace.read", "读取文件", "本地资料"],
  },
  {
    key: "workspace.write",
    type: "tool",
    requiredFor: ["写入本地工作产物"],
    keywords: ["workspace.write", "写入文件", "输出文件"],
  },
  {
    key: "document.write",
    type: "tool",
    requiredFor: ["生成文档"],
    keywords: ["document.write", "文档", "报告"],
  },
];

const CAPABILITY_ALIASES: Record<string, string> = {
  "browser.use": "browser",
  "web.search": "web_search",
  "web.fetch": "web_fetch",
  "image_inspect": "image.inspect",
  "image_generate": "image.generate",
};

const DEFAULT_SOURCES: DijieCapabilitySource[] = [
  {
    key: "skill.creator",
    type: "skill",
    title: "OpenClaw Skill Creator",
    matchedFrom: "openclaw_skill",
    ref: "openclaw-base/skills/skill-creator/SKILL.md",
    status: "available",
    maturity: "mature",
    reason: "OpenClaw 已有 skill-creator，可用于缺失 skill 的候选生成。",
  },
  {
    key: "visual.main_image.inspect",
    type: "skill",
    title: "主图巡检 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.main_image.inspect",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 基于岗位标准生成候选 skill。",
  },
  {
    key: "visual.detail_page.inspect",
    type: "skill",
    title: "详情页巡检 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.detail_page.inspect",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 基于岗位标准生成候选 skill。",
  },
  {
    key: "visual.product_fidelity.self_check",
    type: "skill",
    title: "产品保真自检 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.product_fidelity.self_check",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 生成候选；执行仍需图片理解和标准产品图。",
  },
  {
    key: "visual.issue.record",
    type: "skill",
    title: "问题记录 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.issue.record",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 生成候选；写入仍需问题台账 adapter。",
  },
  {
    key: "visual.design_standard.maintain",
    type: "skill",
    title: "设计标准维护 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.design_standard.maintain",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 生成候选；入库必须人工确认。",
  },
  {
    key: "visual.asset_library.maintain",
    type: "skill",
    title: "素材库维护 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.asset_library.maintain",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 生成候选；执行仍需素材库 adapter。",
  },
  {
    key: "visual.competitor.analyze",
    type: "skill",
    title: "竞品视觉分析 Skill 候选",
    matchedFrom: "generated",
    ref: "skill.creator:visual.competitor.analyze",
    status: "generated_candidate",
    maturity: "candidate",
    reason: "可由 OpenClaw skill-creator 生成候选；执行仍需浏览器和搜索能力。",
  },
  {
    key: "browser",
    type: "tool",
    title: "OpenClaw Browser Tool",
    matchedFrom: "plugin_tool",
    ref: "openclaw-base/extensions/browser/openclaw.plugin.json#contracts.tools.browser",
    status: "available",
    maturity: "built_in",
    reason: "OpenClaw browser extension 已声明 browser tool。",
  },
  {
    key: "web_search",
    type: "tool",
    title: "OpenClaw Web Search Providers",
    matchedFrom: "provider",
    ref: "openclaw-base/extensions/{brave,minimax,tavily}/openclaw.plugin.json",
    status: "candidate_found",
    maturity: "candidate",
    reason: "OpenClaw 已有多个搜索 provider，实际可用性取决于本地配置。",
  },
  {
    key: "web_fetch",
    type: "tool",
    title: "OpenClaw Web Fetch / Firecrawl",
    matchedFrom: "provider",
    ref: "openclaw-base/extensions/firecrawl/openclaw.plugin.json",
    status: "candidate_found",
    maturity: "candidate",
    reason: "OpenClaw 已有 firecrawl/web 读取类 extension，实际可用性取决于配置。",
  },
  {
    key: "image.inspect",
    type: "provider",
    title: "OpenClaw Media Understanding Provider",
    matchedFrom: "provider",
    ref: "openclaw-base/extensions/minimax/openclaw.plugin.json#mediaUnderstandingProviderMetadata",
    status: "candidate_found",
    maturity: "candidate",
    reason: "OpenClaw provider manifest 已声明图片理解能力，需确认本地 provider 配置。",
  },
  {
    key: "image.generate",
    type: "provider",
    title: "OpenClaw Image Generation Providers",
    matchedFrom: "provider",
    ref: "openclaw-base/extensions/{minimax,xai,fal,comfy}/openclaw.plugin.json",
    status: "candidate_found",
    maturity: "candidate",
    reason: "OpenClaw 已有图片生成 provider 候选，需确认本地 provider 配置。",
  },
  {
    key: "human.confirm",
    type: "human_confirm",
    title: "OpenClaw Human Confirmation",
    matchedFrom: "plugin_tool",
    ref: "openclaw-human-confirm",
    status: "available",
    maturity: "built_in",
    reason: "高风险动作按现有人工确认边界处理。",
    humanConfirmRequired: true,
  },
  {
    key: "audit.record",
    type: "audit",
    title: "Dijie Audit Record",
    matchedFrom: "aics_adapter",
    ref: "POST /dijie/audit",
    status: "available",
    maturity: "built_in",
    reason: "AICS-293 已有执行审计写入和安全回读。",
  },
  {
    key: "aics_product_db.query_products",
    type: "data_adapter",
    title: "AICS 商品资料读取 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_db.query_products",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接商品资料读取。",
  },
  {
    key: "aics_product_db.get_product_detail",
    type: "data_adapter",
    title: "AICS 商品详情读取 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_db.get_product_detail",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接商品详情读取。",
  },
  {
    key: "aics_product_assets.get_reference_images",
    type: "data_adapter",
    title: "AICS 标准产品图 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_assets.get_reference_images",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接标准产品图读取。",
  },
  {
    key: "aics_product_assets.get_main_images",
    type: "data_adapter",
    title: "AICS 主图 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_assets.get_main_images",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接商品主图读取。",
  },
  {
    key: "aics_product_assets.get_detail_images",
    type: "data_adapter",
    title: "AICS 详情页图 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_assets.get_detail_images",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接详情页图片读取。",
  },
  {
    key: "aics_product_fidelity.self_check",
    type: "data_adapter",
    title: "AICS 产品保真初检 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_product_fidelity.self_check",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 调用多模态模型，对比标准产品图和生成图并输出人工复核建议。",
    humanConfirmRequired: true,
  },
  {
    key: "aics_visual_issue.create_issue",
    type: "data_adapter",
    title: "AICS 视觉问题台账 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_visual_issue.create_issue",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 或飞书多维表承接问题记录。",
  },
  {
    key: "aics_visual_issue.update_status",
    type: "data_adapter",
    title: "AICS 视觉问题状态 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_visual_issue.update_status",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接问题状态更新。",
  },
  {
    key: "aics_design_standard.get_rules",
    type: "data_adapter",
    title: "AICS 设计标准读取 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_design_standard.get_rules",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接设计标准读取。",
  },
  {
    key: "aics_design_standard.add_rule",
    type: "data_adapter",
    title: "AICS 设计标准库 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_design_standard.add_rule",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接设计标准维护，写入必须人工确认。",
    humanConfirmRequired: true,
  },
  {
    key: "aics_asset_library.save_asset",
    type: "data_adapter",
    title: "AICS 素材库保存 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_asset_library.save_asset",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接素材保存。",
  },
  {
    key: "aics_asset_library.search_assets",
    type: "data_adapter",
    title: "AICS 素材库检索 Adapter",
    matchedFrom: "aics_adapter",
    ref: "aics_asset_library.search_assets",
    status: "adapter_needed",
    maturity: "adapter",
    reason: "需要 AICS 业务 adapter 承接素材检索。",
  },
  {
    key: "workspace.read",
    type: "tool",
    title: "OpenClaw Workspace Read",
    matchedFrom: "plugin_tool",
    ref: "openclaw-workspace:read",
    status: "available",
    maturity: "built_in",
    reason: "本地端已有工作区读取边界，可用于读取授权范围内资料。",
  },
  {
    key: "workspace.write",
    type: "tool",
    title: "OpenClaw Workspace Write",
    matchedFrom: "plugin_tool",
    ref: "openclaw-workspace:write",
    status: "candidate_found",
    maturity: "candidate",
    reason: "本地端可写入工作产物，但需要按任务权限和人工确认边界启用。",
    humanConfirmRequired: true,
  },
  {
    key: "document.write",
    type: "tool",
    title: "Document Writer",
    matchedFrom: "plugin_tool",
    ref: "aics-document-write",
    status: "candidate_found",
    maturity: "candidate",
    reason: "可通过本地文档输出能力生成报告，实际写入位置需受权限约束。",
  },
];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCapabilityKey(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ".").replace(/-/g, "_").toLowerCase();
  return CAPABILITY_ALIASES[normalized] ?? normalized;
}

function uniqueNeeds(needs: DijieCapabilityNeed[]): DijieCapabilityNeed[] {
  const byKey = new Map<string, DijieCapabilityNeed>();
  for (const need of needs) {
    const existing = byKey.get(need.key);
    if (!existing) {
      byKey.set(need.key, {
        ...need,
        requiredFor: [...new Set(need.requiredFor)],
      });
      continue;
    }
    byKey.set(need.key, {
      ...existing,
      requiredFor: [...new Set([...existing.requiredFor, ...need.requiredFor])],
      source: existing.source.includes(need.source)
        ? existing.source
        : `${existing.source}, ${need.source}`,
    });
  }
  return [...byKey.values()];
}

function textIncludesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function collectText(input: unknown): string {
  const record = asRecord(input);
  const direct = [
    stringField(record, "roleIdea"),
    stringField(record, "role_idea"),
    stringField(record, "description"),
    stringField(record, "prompt"),
    stringField(record, "message"),
  ];
  const manifest = asRecord(record.manifest ?? asRecord(record.rolePackage).manifest);
  direct.push(
    stringField(manifest, "name"),
    stringField(manifest, "description"),
    stringField(manifest, "summary"),
  );
  const files = record.files ?? asRecord(record.rolePackage).files;
  if (Array.isArray(files)) {
    for (const file of files) {
      const fileRecord = asRecord(file);
      direct.push(stringField(fileRecord, "path"));
      direct.push(stringField(fileRecord, "content"));
    }
  }
  return direct.filter(Boolean).join("\n");
}

function readManifest(input: unknown): UnknownRecord {
  const record = asRecord(input);
  const directManifest = asRecord(record.manifest ?? asRecord(record.rolePackage).manifest);
  if (Object.keys(directManifest).length > 0) {
    return directManifest;
  }

  const files = record.files ?? asRecord(record.rolePackage).files;
  if (!Array.isArray(files)) {
    return {};
  }
  for (const file of files) {
    const fileRecord = asRecord(file);
    const path = stringField(fileRecord, "path") ?? stringField(fileRecord, "relativePath");
    if (path?.replace(/\\/g, "/") !== "role_package/manifest.json") {
      continue;
    }
    const content = stringField(fileRecord, "content");
    if (!content) {
      continue;
    }
    try {
      return asRecord(JSON.parse(content));
    } catch {
      return {};
    }
  }
  return {};
}

export function extractDijieCapabilityNeeds(input: unknown): {
  requiredSkills: DijieCapabilityNeed[];
  requiredCapabilities: DijieCapabilityNeed[];
} {
  const text = collectText(input);
  const manifest = readManifest(input);
  const requiredSkills: DijieCapabilityNeed[] = [];
  const requiredCapabilities: DijieCapabilityNeed[] = [];

  for (const skill of SKILL_NEEDS) {
    if (
      textIncludesAny(text, skill.keywords) ||
      textIncludesAny(text, skill.requiredFor) ||
      text.toLowerCase().includes(skill.key.toLowerCase())
    ) {
      requiredSkills.push({
        key: skill.key,
        type: "skill",
        source: "role_idea_or_package_text",
        requiredFor: skill.requiredFor,
      });
    }
  }

  const manifestCapabilities = stringArray(
    manifest.requiredCapabilities ?? manifest.required_capabilities,
  );
  for (const capability of manifestCapabilities) {
    requiredCapabilities.push({
      key: normalizeCapabilityKey(capability),
      type: capabilityTypeForKey(capability),
      source: "manifest.requiredCapabilities",
      requiredFor: ["岗位包声明能力"],
    });
  }

  for (const capability of CAPABILITY_NEEDS) {
    if (
      manifestCapabilities.some((entry) => normalizeCapabilityKey(entry) === capability.key) ||
      textIncludesAny(text, [capability.key, ...capability.keywords])
    ) {
      requiredCapabilities.push({
        key: capability.key,
        type: capability.type,
        source: "role_idea_or_package_text",
        requiredFor: capability.requiredFor,
      });
    }
  }

  return {
    requiredSkills: uniqueNeeds(requiredSkills),
    requiredCapabilities: uniqueNeeds(requiredCapabilities),
  };
}

function capabilityTypeForKey(key: string): DijieCapabilityNeedType {
  const normalized = normalizeCapabilityKey(key);
  if (normalized.includes("confirm")) {
    return "human_confirm";
  }
  if (normalized.includes("audit")) {
    return "audit";
  }
  if (normalized.startsWith("aics_")) {
    return "data_adapter";
  }
  if (normalized.startsWith("image.")) {
    return "provider";
  }
  return "tool";
}

function resultFromNeed(need: DijieCapabilityNeed): DijieCapabilitySearchResult {
  const source = DEFAULT_SOURCES.find(
    (candidate) => candidate.key === need.key && candidate.type === need.type,
  );
  if (!source && need.type === "skill") {
    const skillCreator = DEFAULT_SOURCES.find((candidate) => candidate.key === "skill.creator");
    return {
      key: need.key,
      type: need.type,
      status: "generated_candidate",
      matchedFrom: "generated",
      ref: `skill.creator:${need.key}`,
      reason: skillCreator
        ? "OpenClaw 已有 skill-creator，可生成该 skill 候选后再验收。"
        : "未找到成熟 skill；需要生成候选并验收。",
      requiredFor: need.requiredFor,
    };
  }
  if (!source) {
    return {
      key: need.key,
      type: need.type,
      status: "missing",
      reason: "未在现有 OpenClaw catalog、extension manifest、provider 或 AICS adapter 中找到候选。",
      requiredFor: need.requiredFor,
    };
  }
  return {
    key: need.key,
    type: need.type,
    status: source.status,
    matchedFrom: source.matchedFrom,
    ref: source.ref,
    reason: source.reason,
    requiredFor: need.requiredFor,
  };
}

export function createDijieCapabilityMatchReport(input: unknown): DijieCapabilityMatchReport {
  const { requiredSkills, requiredCapabilities } = extractDijieCapabilityNeeds(input);
  const results = [...requiredSkills, ...requiredCapabilities].map(resultFromNeed);
  const blockedReasons = results
    .filter((result) => result.status === "missing" || result.status === "blocked")
    .map((result) => `${result.key}: ${result.reason}`);

  return {
    ok: blockedReasons.length === 0,
    requiredSkills,
    requiredCapabilities,
    results,
    matchedSkills: results.filter((result) => result.type === "skill"),
    matchedTools: results.filter((result) =>
      ["tool", "provider", "human_confirm", "audit"].includes(result.type),
    ),
    adapterNeeded: results.filter((result) => result.status === "adapter_needed"),
    missing: results.filter(
      (result) => result.status === "missing" || result.status === "blocked",
    ),
    blockedReasons,
  };
}

export function createDijieRoleCapabilityBinding(input: {
  rolePackageId?: string;
  roleListingId?: string;
  report: DijieCapabilityMatchReport;
}): DijieRoleCapabilityBinding {
  return {
    rolePackageId: input.rolePackageId,
    roleListingId: input.roleListingId,
    bindings: input.report.results.map((result) => ({
      capabilityKey: result.key,
      status: result.status,
      ...(result.type === "skill" ? { skillRef: result.ref } : {}),
      ...(result.type !== "skill" && result.status !== "adapter_needed"
        ? { toolRef: result.ref }
        : {}),
      ...(result.status === "adapter_needed" ? { adapterRef: result.ref } : {}),
      validationStatus:
        result.status === "available" || result.status === "candidate_found"
          ? "ready"
          : result.status === "adapter_needed" || result.status === "generated_candidate"
            ? "needs_adapter"
            : "blocked",
    })),
    blockedReasons: input.report.blockedReasons,
  };
}
