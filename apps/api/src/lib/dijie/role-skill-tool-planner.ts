type UnknownRecord = Record<string, unknown>;

export type DijieCatalogKind =
  | "skill"
  | "tool"
  | "api"
  | "mcp"
  | "provider"
  | "adapter"
  | "capability";

export type DijieCatalogStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "disabled";

export type DijieCapabilityRouteKind =
  | "local_tool"
  | "local_skill"
  | "remote_api"
  | "remote_mcp"
  | "provider_capability"
  | "human_gate"
  | "unsupported";

export type DijieCapabilityPreferredRoute =
  | "local"
  | "remote_api"
  | "remote_mcp"
  | "provider"
  | "human_gate"
  | "unsupported";

export type DijieCatalogItem = {
  id: string;
  kind: DijieCatalogKind;
  name: string;
  version: string;
  description: string;
  tags: string[];
  provides: string[];
  source: "platform_builtin" | "openclaw" | "opencloud" | "internal_build";
  status: DijieCatalogStatus;
  permissions: string[];
  riskLevel: "low" | "medium" | "high";
  auditPolicy: string[];
  keywords: string[];
};

export type DijieRoleRequirementSpec = {
  roleName: string;
  businessScenario: string;
  serviceStandards: string[];
  acceptanceStandards: string[];
  dailyTasks: string[];
  weeklyTasks: string[];
  monthlyTasks: string[];
  workflowSteps: Array<{
    id: string;
    label: string;
    requiredSkills: string[];
    requiredTools: string[];
    requiredCapabilities: string[];
    humanConfirmationRequired: boolean;
  }>;
  risks: string[];
  missingInformation: string[];
};

export type DijieCatalogBinding = {
  need: string;
  catalogRef: string;
  kind: DijieCatalogKind;
  versionRange: string;
  status: "bindable" | "waiting_review" | "blocked";
  riskLevel: DijieCatalogItem["riskLevel"];
  permissions: string[];
  catalogRefs?: string[];
  routeKind?: DijieCapabilityRouteKind;
  preferredRoute?: DijieCapabilityPreferredRoute;
  permissionSummary?: string[];
};

export type DijieCapabilityGap = {
  need: string;
  kind: DijieCatalogKind;
  reason: string;
  nextAction: "search_external" | "request_internal_build" | "ask_developer";
};

export type DijieRoleCapabilityPlan = {
  requiredSkills: string[];
  requiredTools: string[];
  requiredCapabilities: string[];
  catalogBindings: DijieCatalogBinding[];
  gaps: DijieCapabilityGap[];
  status:
    | "platform_ready"
    | "needs_more_input"
    | "waiting_skill_tool_review"
    | "waiting_internal_build"
    | "blocked";
  reviewBlockers: string[];
};

const PLATFORM_DATABASE_PATTERNS = [
  /平台.*数据库/u,
  /平台.*业务库/u,
  /直接.*(查|读|访问).*(订单|用户|钱包|审核|授权).*(表|数据库|库)/u,
  /\b(platform|medusa|mercur)[._-]?(db|database)\b/iu,
  /\b(select|insert|update|delete)\s+.+\b(from|into)\b/iu,
];

export const DIJIE_PLATFORM_SKILL_TOOL_CATALOG: DijieCatalogItem[] = [
  {
    id: "tool.platform.workboard_task",
    kind: "tool",
    name: "岗位任务看板工具",
    version: "1.0.0",
    description: "创建今日、本周、下周岗位任务，并把执行结果回写到本地任务看板。",
    tags: ["workboard", "task", "cadence"],
    provides: ["workboard.task"],
    source: "openclaw",
    status: "approved",
    permissions: ["workboard.task", "audit.record"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["岗位任务", "任务看板", "workboard.task", "今日任务", "本周任务"],
  },
  {
    id: "tool.platform.scheduler_cadence",
    kind: "tool",
    name: "经营节奏调度工具",
    version: "1.0.0",
    description: "按日、周、月、季、年经营节奏生成岗位任务和复盘动作。",
    tags: ["scheduler", "cadence", "business_flow"],
    provides: ["scheduler.cadence"],
    source: "openclaw",
    status: "approved",
    permissions: ["scheduler.cadence", "audit.record"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["经营节奏", "定时", "周任务", "月度复盘", "scheduler.cadence"],
  },
  {
    id: "skill.platform.visual_main_image_inspection",
    kind: "skill",
    name: "主图巡检 skill",
    version: "1.0.0",
    description: "检查商品主图主体、背景、卖点、遮挡、变形和平台合规。",
    tags: ["visual", "image", "inspection"],
    provides: ["visual.main_image.inspect"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["image.inspect", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.on_uncertain_visual_fidelity", "audit.record"],
    keywords: ["主图", "商品图", "首图", "main image", "hero image"],
  },
  {
    id: "skill.platform.visual_detail_page_inspection",
    kind: "skill",
    name: "详情页巡检 skill",
    version: "1.0.0",
    description: "检查详情页模块顺序、风格统一、文案可读性、卖点表达和低清重复模块。",
    tags: ["visual", "detail_page", "inspection"],
    provides: ["visual.detail_page.inspect"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["browser.review", "image.inspect", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.on_publication", "audit.record"],
    keywords: ["详情页", "页面巡检", "detail page", "landing page"],
  },
  {
    id: "skill.platform.product_fidelity_self_check",
    kind: "skill",
    name: "产品保真自检 skill",
    version: "1.0.0",
    description: "对比标准产品图和输出图，给出通过、存疑、不通过和人工复核建议。",
    tags: ["visual", "fidelity", "review"],
    provides: ["visual.product_fidelity.self_check", "aics_product_fidelity.self_check"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["image.inspect", "human.confirm", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.on_uncertain_visual_fidelity", "audit.record"],
    keywords: ["保真", "产品一致", "标准产品图", "fidelity"],
  },
  {
    id: "skill.platform.visual_issue_record",
    kind: "skill",
    name: "视觉问题记录 skill",
    version: "1.0.0",
    description: "记录商品、图片位置、问题类型、严重程度、修改建议、状态和人工确认边界。",
    tags: ["visual", "issue", "audit"],
    provides: ["visual.issue.record", "aics_visual_issue.create_issue"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["audit.record", "template.render"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["问题记录", "问题台账", "记录问题", "issue"],
  },
  {
    id: "skill.platform.design_standard_maintenance",
    kind: "skill",
    name: "设计标准维护 skill",
    version: "1.0.0",
    description: "把反复出现的问题沉淀为设计规则，并要求人工确认后进入标准库。",
    tags: ["visual", "standard", "knowledge"],
    provides: ["visual.design_standard.maintain", "aics_design_standard.add_rule"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["design.standard.write", "human.confirm", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.before_standard_write", "audit.record"],
    keywords: ["设计标准", "标准维护", "沉淀", "规则"],
  },
  {
    id: "tool.platform.image_inspector",
    kind: "tool",
    name: "图片理解工具",
    version: "1.0.0",
    description: "平台统一审核的图片理解能力，用于读取商品图、详情页和参考图。",
    tags: ["image", "vision"],
    provides: ["image.inspect"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["image.inspect"],
    riskLevel: "medium",
    auditPolicy: ["audit.record"],
    keywords: ["图片理解", "看图", "识图", "image.inspect", "图片检查"],
  },
  {
    id: "api.opencloud.image_generation",
    kind: "api",
    name: "图片生成 API 接入",
    version: "1.0.0",
    description: "通过用户授权的外部图片生成 API/provider 按需调用，平台只保存目录引用和审计摘要。",
    tags: ["image", "generation", "remote_api"],
    provides: ["image.generate"],
    source: "opencloud",
    status: "approved",
    permissions: ["image.generate", "human.confirm"],
    riskLevel: "high",
    auditPolicy: ["human.confirm.before_publication", "audit.record"],
    keywords: ["图片生成", "生成图", "image.generate", "出图", "openai images", "replicate"],
  },
  {
    id: "api.opencloud.video_generation",
    kind: "api",
    name: "视频生成 API 接入",
    version: "1.0.0",
    description: "通过用户授权的视频生成 API/provider 按需调用，适合低频、重型、岗位专属生成任务。",
    tags: ["video", "generation", "remote_api"],
    provides: ["video.generate"],
    source: "opencloud",
    status: "approved",
    permissions: ["video.generate", "human.confirm"],
    riskLevel: "high",
    auditPolicy: ["human.confirm.before_publication", "audit.record"],
    keywords: ["视频生成", "生成视频", "video.generate", "runway", "replicate"],
  },
  {
    id: "api.opencloud.actor_run",
    kind: "api",
    name: "远程 Actor/API 任务接入",
    version: "1.0.0",
    description: "通过外部 API/Actor 平台执行爬取、批处理或 SaaS 自动化任务，本地端只做路由、授权和审计。",
    tags: ["api", "actor", "automation"],
    provides: ["actor.run", "web.crawl", "saas.action"],
    source: "opencloud",
    status: "approved",
    permissions: ["network.call", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["tenant.scope.check", "audit.record"],
    keywords: ["apify", "actor", "爬虫", "抓取", "SaaS", "自动化", "composio", "zapier"],
  },
  {
    id: "tool.platform.browser_review",
    kind: "tool",
    name: "浏览器预览工具",
    version: "1.0.0",
    description: "平台统一审核的浏览器页面预览和检查能力。",
    tags: ["browser", "review"],
    provides: ["browser", "browser.use", "browser.review", "web_fetch", "web_search"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["browser.review"],
    riskLevel: "medium",
    auditPolicy: ["audit.record"],
    keywords: ["浏览器", "页面预览", "网页", "browser", "web_search", "web_fetch"],
  },
  {
    id: "tool.platform.audit-record",
    kind: "tool",
    name: "审计记录工具",
    version: "1.0.0",
    description: "记录工具调用、人工确认、失败原因和输出摘要。",
    tags: ["audit"],
    provides: ["audit.record", "audit.write"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["audit.record"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["审计", "记录", "audit.record", "audit.write"],
  },
  {
    id: "tool.platform.human_confirmation",
    kind: "tool",
    name: "人工确认工具",
    version: "1.0.0",
    description: "在高风险、发布、保真存疑或写入标准前请求人类确认。",
    tags: ["human", "confirmation"],
    provides: ["human.confirm"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["human.confirm"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["人工确认", "复核", "human.confirm", "确认点"],
  },
  {
    id: "tool.platform.template_renderer",
    kind: "tool",
    name: "模板渲染工具",
    version: "1.0.0",
    description: "按岗位模板生成记录、清单和验收材料。",
    tags: ["template", "document"],
    provides: ["template.render", "document.write", "copy.review"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["template.render", "document.write"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["模板", "清单", "文档", "template.render", "document.write"],
  },
  {
    id: "capability.platform.workspace-read",
    kind: "capability",
    name: "工作区读取能力",
    version: "1.0.0",
    description: "按用户授权和 workspace 范围读取本地资料摘要。",
    tags: ["workspace", "read"],
    provides: ["workspace.read"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.read"],
    riskLevel: "medium",
    auditPolicy: ["workspace.scope.check", "audit.record"],
    keywords: ["workspace.read", "读取文件", "本地资料"],
  },
  {
    id: "capability.platform.workspace-write",
    kind: "capability",
    name: "工作区写入能力",
    version: "1.0.0",
    description: "按用户授权和人工确认写入 workspace 输出文件。",
    tags: ["workspace", "write"],
    provides: ["workspace.write"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.write", "human.confirm"],
    riskLevel: "high",
    auditPolicy: ["human.confirm.before_write", "audit.record"],
    keywords: ["workspace.write", "写文件", "输出文件"],
  },
  {
    id: "adapter.platform.aics_product_assets",
    kind: "adapter",
    name: "AICS 商品素材读取 adapter",
    version: "1.0.0",
    description: "读取授权范围内的商品参考图、主图和详情图；不是平台业务数据库访问能力。",
    tags: ["aics", "product", "asset"],
    provides: [
      "aics_product_assets.get_reference_images",
      "aics_product_assets.get_main_images",
      "aics_product_assets.get_detail_images",
    ],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.read", "image.inspect"],
    riskLevel: "medium",
    auditPolicy: ["tenant.scope.check", "audit.record"],
    keywords: ["商品图片", "参考图", "主图", "详情图", "素材"],
  },
  {
    id: "adapter.platform.aics_product_query",
    kind: "adapter",
    name: "AICS 商品资料查询 adapter",
    version: "1.0.0",
    description: "查询授权范围内的商品资料投影；禁止直接访问平台业务数据库。",
    tags: ["aics", "product", "data_adapter"],
    provides: ["aics_product_db.query_products"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.read"],
    riskLevel: "medium",
    auditPolicy: ["tenant.scope.check", "audit.record"],
    keywords: ["商品资料", "商品数据", "商品信息", "query_products"],
  },
  {
    id: "adapter.platform.aics_product_detail",
    kind: "adapter",
    name: "AICS 商品详情读取 adapter",
    version: "1.0.0",
    description: "读取授权范围内的商品详情投影；禁止直接访问平台业务数据库。",
    tags: ["aics", "product", "data_adapter"],
    provides: ["aics_product_db.get_product_detail"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.read"],
    riskLevel: "medium",
    auditPolicy: ["tenant.scope.check", "audit.record"],
    keywords: ["商品详情", "产品详情", "get_product_detail"],
  },
  {
    id: "adapter.platform.aics_design_standard",
    kind: "adapter",
    name: "AICS 设计标准 adapter",
    version: "1.0.0",
    description: "读取或在人工确认后写入岗位设计标准。",
    tags: ["aics", "design", "standard"],
    provides: ["aics_design_standard.get_rules", "aics_design_standard.add_rule", "design.standard.write"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["design.standard.write", "human.confirm", "audit.record"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.before_standard_write", "audit.record"],
    keywords: ["设计规则", "设计标准", "get_rules", "add_rule"],
  },
  {
    id: "adapter.platform.aics_visual_issue_status",
    kind: "adapter",
    name: "AICS 视觉问题状态 adapter",
    version: "1.0.0",
    description: "在授权范围内更新视觉问题状态。",
    tags: ["aics", "issue", "audit"],
    provides: ["aics_visual_issue.update_status"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["audit.record", "human.confirm"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm.before_status_update", "audit.record"],
    keywords: ["问题状态", "update_status", "关闭问题"],
  },
  {
    id: "adapter.platform.aics_asset_library",
    kind: "adapter",
    name: "AICS 素材库 adapter",
    version: "1.0.0",
    description: "在授权 workspace 范围内检索或保存岗位素材。",
    tags: ["aics", "asset", "workspace"],
    provides: ["aics_asset_library.save_asset", "aics_asset_library.search_assets"],
    source: "platform_builtin",
    status: "approved",
    permissions: ["workspace.read", "workspace.write", "human.confirm", "audit.record"],
    riskLevel: "high",
    auditPolicy: ["workspace.scope.check", "human.confirm.before_write", "audit.record"],
    keywords: ["素材库", "保存素材", "检索素材", "save_asset", "search_assets"],
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function collectText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(collectText).join("\n");
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  return Object.entries(value as UnknownRecord)
    .map(([key, entry]) => `${key}: ${collectText(entry)}`)
    .join("\n");
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

function roleNameFromInput(input: unknown, text: string): string {
  const manifestName = stringField(readManifest(input), "name");
  if (manifestName) {
    return manifestName;
  }
  const matched = text.match(/(?:做一个|生成|创建|开发)?([^。\n，,]{2,42}?岗位)/u);
  return matched?.[1]?.trim() ?? "未命名岗位";
}

function includesAny(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function defaultStandards(text: string) {
  const serviceStandards: string[] = [];
  const acceptanceStandards: string[] = [];
  if (includesAny(text, ["标准", "规范", "服务", "SOP", "sop"])) {
    serviceStandards.push("按开发者描述的业务标准和服务边界执行，不能越权处理未授权资料。");
  }
  if (includesAny(text, ["验收", "通过", "不通过", "失败", "复核"])) {
    acceptanceStandards.push("输出必须能按通过、存疑、不通过进行验收，并保留人工复核点。");
  }
  if (includesAny(text, ["图片", "主图", "详情页", "设计", "美工", "视觉"])) {
    serviceStandards.push("视觉输出必须保持产品保真，存疑时要求人工确认。");
    acceptanceStandards.push("图片或页面检查结果必须包含问题位置、严重程度、修改建议和验收状态。");
  }
  return {
    serviceStandards: serviceStandards.length > 0 ? serviceStandards : ["服务标准待开发者补充。"],
    acceptanceStandards:
      acceptanceStandards.length > 0 ? acceptanceStandards : ["验收标准待开发者补充。"],
  };
}

function defaultWorkflowSteps(text: string) {
  const steps: DijieRoleRequirementSpec["workflowSteps"] = [];
  if (includesAny(text, ["主图", "商品图", "图片", "视觉", "美工"])) {
    steps.push({
      id: "main_image_inspection",
      label: "主图/商品图巡检",
      requiredSkills: ["visual.main_image.inspect"],
      requiredTools: ["image.inspect"],
      requiredCapabilities: ["image.inspect", "audit.record", "human.confirm"],
      humanConfirmationRequired: true,
    });
  }
  if (includesAny(text, ["详情页", "页面", "浏览器"])) {
    steps.push({
      id: "detail_page_inspection",
      label: "详情页/页面巡检",
      requiredSkills: ["visual.detail_page.inspect"],
      requiredTools: ["browser.review", "image.inspect"],
      requiredCapabilities: ["browser.review", "image.inspect", "audit.record"],
      humanConfirmationRequired: true,
    });
  }
  if (includesAny(text, ["标准", "规则", "沉淀", "维护"])) {
    steps.push({
      id: "standard_maintenance",
      label: "岗位标准维护",
      requiredSkills: ["visual.design_standard.maintain"],
      requiredTools: ["template.render"],
      requiredCapabilities: ["design.standard.write", "human.confirm", "audit.record"],
      humanConfirmationRequired: true,
    });
  }
  if (steps.length > 0) {
    return steps;
  }
  return [
    {
      id: "requirement_triage",
      label: "需求理解和任务分解",
      requiredSkills: [],
      requiredTools: ["template.render"],
      requiredCapabilities: ["template.render", "human.confirm", "audit.record"],
      humanConfirmationRequired: true,
    },
  ];
}

export function createDijieRoleRequirementSpec(input: unknown): DijieRoleRequirementSpec {
  const text = collectText(input);
  const { serviceStandards, acceptanceStandards } = defaultStandards(text);
  const dailyTasks = includesAny(text, ["每日", "每天", "日常"])
    ? ["按岗位日常清单检查输入资料、执行任务、记录问题和确认状态。"]
    : [];
  const weeklyTasks = includesAny(text, ["每周", "周报", "周"])
    ? ["按周汇总反复问题、标准变化和待人工确认事项。"]
    : [];
  const monthlyTasks = includesAny(text, ["每月", "月度", "月"])
    ? ["按月复盘岗位质量、验收样例、失败模式和标准更新。"]
    : [];
  const workflowSteps = defaultWorkflowSteps(text);
  const missingInformation: string[] = [];
  if (serviceStandards.every((item) => item.includes("待开发者补充"))) {
    missingInformation.push("服务标准");
  }
  if (acceptanceStandards.every((item) => item.includes("待开发者补充"))) {
    missingInformation.push("验收标准");
  }

  return {
    roleName: roleNameFromInput(input, text),
    businessScenario: text.trim().slice(0, 600) || "开发者尚未提供业务场景。",
    serviceStandards,
    acceptanceStandards,
    dailyTasks,
    weeklyTasks,
    monthlyTasks,
    workflowSteps,
    risks: [
      "岗位包只能声明能力和 catalog 引用，不能携带工具实现、密钥、MCP server 或平台内部资料。",
      "运行时必须按用户授权、workspace、风险策略和人工确认点执行。",
    ],
    missingInformation,
  };
}

function catalogItemForNeed(
  need: string,
  catalogItems: DijieCatalogItem[] = DIJIE_PLATFORM_SKILL_TOOL_CATALOG,
): DijieCatalogItem | undefined {
  const normalized = need.trim().toLowerCase();
  return catalogItems.find((item) =>
    item.provides.some((provide) => provide.toLowerCase() === normalized) ||
    item.id.toLowerCase() === normalized ||
    item.keywords.some((keyword) => keyword.toLowerCase() === normalized),
  );
}

function firstProvidedCapability(item: DijieCatalogItem, fallback: string): string {
  return item.provides.find((provide) => provide.trim()) ?? fallback;
}

function isHumanGateCapability(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "human.confirm" ||
    normalized === "capability:human.confirm" ||
    normalized.includes(".confirm") ||
    normalized.includes(".approve")
  );
}

function isRemoteGenerationCapability(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes(".generate") ||
    normalized.includes(".video") ||
    normalized.includes(".translate") ||
    normalized.includes(".transcribe") ||
    normalized.includes(".tts") ||
    normalized.includes(".search") ||
    normalized.includes(".crawl") ||
    normalized.includes(".actor")
  );
}

export function routeKindForDijieCatalogItem(item: DijieCatalogItem): DijieCapabilityRouteKind {
  const primaryCapability = firstProvidedCapability(item, item.id);
  if (isHumanGateCapability(primaryCapability)) {
    return "human_gate";
  }
  if (item.kind === "skill") {
    return "local_skill";
  }
  if (item.kind === "tool") {
    return "local_tool";
  }
  if (item.kind === "api" || item.kind === "adapter") {
    return "remote_api";
  }
  if (item.kind === "mcp") {
    return "remote_mcp";
  }
  if (item.kind === "provider") {
    return "provider_capability";
  }
  if (isRemoteGenerationCapability(primaryCapability)) {
    return "remote_api";
  }
  if (item.kind === "capability") {
    return "local_tool";
  }
  return "unsupported";
}

export function preferredRouteForDijieCatalogItem(
  item: DijieCatalogItem,
): DijieCapabilityPreferredRoute {
  const routeKind = routeKindForDijieCatalogItem(item);
  if (routeKind === "local_tool" || routeKind === "local_skill") {
    return "local";
  }
  if (routeKind === "provider_capability") {
    return "provider";
  }
  if (routeKind === "human_gate") {
    return "human_gate";
  }
  if (routeKind === "unsupported") {
    return "unsupported";
  }
  return routeKind;
}

export function catalogRefsForDijieCatalogItem(
  item: DijieCatalogItem,
  fallbackNeed?: string,
): string[] {
  const routeKind = routeKindForDijieCatalogItem(item);
  const primaryCapability = firstProvidedCapability(item, fallbackNeed ?? item.id);
  const versionSuffix = item.version ? `@${item.version}` : "";
  const refs = new Set<string>();

  if (routeKind === "human_gate") {
    refs.add(`capability:${primaryCapability}${versionSuffix}`);
  } else if (routeKind === "local_skill") {
    refs.add(`skill:${primaryCapability}${versionSuffix}`);
  } else if (routeKind === "local_tool") {
    refs.add(`tool:${primaryCapability}${versionSuffix}`);
  } else if (routeKind === "remote_api") {
    refs.add(`api:${primaryCapability}${versionSuffix}`);
  } else if (routeKind === "remote_mcp") {
    refs.add(`mcp:${primaryCapability}${versionSuffix}`);
  } else if (routeKind === "provider_capability") {
    refs.add(`provider:${primaryCapability}${versionSuffix}`);
  } else {
    refs.add(`capability:${primaryCapability}${versionSuffix}`);
  }

  if (item.kind === "capability" || isRemoteGenerationCapability(primaryCapability)) {
    refs.add(`capability:${primaryCapability}${versionSuffix}`);
  }

  return [...refs];
}

function needsFromInput(
  input: unknown,
  spec: DijieRoleRequirementSpec,
  catalogItems: DijieCatalogItem[] = DIJIE_PLATFORM_SKILL_TOOL_CATALOG,
) {
  const manifest = readManifest(input);
  const requiredCapabilities = stringArray(
    manifest.requiredCapabilities ?? manifest.required_capabilities,
  );
  const text = collectText(input);
  const inferredProvides = catalogItems.flatMap((item) =>
    item.kind !== "skill" && includesAny(text, item.keywords) ? item.provides : [],
  );
  return {
    skills: uniqueStrings(spec.workflowSteps.flatMap((step) => step.requiredSkills)),
    tools: uniqueStrings(spec.workflowSteps.flatMap((step) => step.requiredTools)),
    capabilities: uniqueStrings([
      ...requiredCapabilities,
      ...spec.workflowSteps.flatMap((step) => step.requiredCapabilities),
      ...inferredProvides.filter((need) => !need.includes(".inspect") || text.includes("图")),
    ]),
  };
}

function forbiddenPlatformDatabaseAccess(input: unknown): string[] {
  const text = collectText(input);
  if (/平台业务数据库(?:不是|不能作为)岗位/u.test(text)) {
    return [];
  }
  return PLATFORM_DATABASE_PATTERNS.some((pattern) => pattern.test(text))
    ? ["平台业务数据库不能作为岗位可调用工具；如需数据能力，必须使用独立、已审核、可审计的 adapter。"]
    : [];
}

function bindingForItem(need: string, item: DijieCatalogItem): DijieCatalogBinding {
  return {
    need,
    catalogRef: item.id,
    kind: item.kind,
    versionRange: `^${item.version}`,
    status:
      item.status === "approved"
        ? "bindable"
        : item.status === "rejected" || item.status === "disabled"
          ? "blocked"
          : "waiting_review",
    riskLevel: item.riskLevel,
    permissions: item.permissions,
    catalogRefs: catalogRefsForDijieCatalogItem(item, need),
    routeKind: routeKindForDijieCatalogItem(item),
    preferredRoute: preferredRouteForDijieCatalogItem(item),
    permissionSummary: item.permissions,
  };
}

export function createDijieRoleCapabilityPlan(
  input: unknown,
  options: { catalogItems?: DijieCatalogItem[] } = {},
): DijieRoleCapabilityPlan {
  const spec = createDijieRoleRequirementSpec(input);
  const catalogItems = options.catalogItems ?? DIJIE_PLATFORM_SKILL_TOOL_CATALOG;
  const needs = needsFromInput(input, spec, catalogItems);
  const reviewBlockers = forbiddenPlatformDatabaseAccess(input);
  const catalogBindings: DijieCatalogBinding[] = [];
  const gaps: DijieCapabilityGap[] = [];
  for (const need of uniqueStrings([...needs.skills, ...needs.tools, ...needs.capabilities])) {
    const item = catalogItemForNeed(need, catalogItems);
    if (item) {
      catalogBindings.push(bindingForItem(need, item));
      continue;
    }
    gaps.push({
      need,
      kind: need.includes(".") ? "capability" : "tool",
      reason: "平台 catalog 未找到已审核项，不能直接绑定执行。",
      nextAction: "search_external",
    });
  }

  const blockedBindings = catalogBindings.filter((binding) => binding.status !== "bindable");
  const status =
    reviewBlockers.length > 0
      ? "blocked"
      : spec.missingInformation.length > 0 && catalogBindings.length === 0
        ? "needs_more_input"
        : blockedBindings.length > 0
          ? "waiting_skill_tool_review"
          : gaps.length > 0
            ? "waiting_internal_build"
            : "platform_ready";

  return {
    requiredSkills: needs.skills,
    requiredTools: needs.tools,
    requiredCapabilities: needs.capabilities,
    catalogBindings,
    gaps,
    status,
    reviewBlockers: [
      ...reviewBlockers,
      ...blockedBindings.map((binding) => `${binding.need}: catalog item ${binding.catalogRef} 未审核通过。`),
    ],
  };
}

export function renderDijieRoleToolRequirementsMarkdown(input: {
  requirementSpec: DijieRoleRequirementSpec;
  capabilityPlan: DijieRoleCapabilityPlan;
}) {
  const { requirementSpec, capabilityPlan } = input;
  const lines = [
    "# Skill / Tool / API 需求与平台绑定计划",
    "",
    "本文件只声明岗位需要的平台能力和 catalog 引用，不包含 skill/tool/API/MCP/adapter 实现、密钥、连接串或平台内部数据库访问。",
    "",
    "## 岗位需求摘要",
    `- 岗位：${requirementSpec.roleName}`,
    `- 场景：${requirementSpec.businessScenario}`,
    "",
    "## 平台已匹配绑定",
    ...(capabilityPlan.catalogBindings.length > 0
      ? capabilityPlan.catalogBindings.map(
          (binding) =>
            `- ${binding.need} -> ${binding.catalogRef}@${binding.versionRange}；路由：${binding.preferredRoute ?? "unknown"}；状态：${binding.status}；风险：${binding.riskLevel}；权限：${binding.permissions.join(", ") || "none"}`,
        )
      : ["- 暂无可绑定项。"]),
    "",
    "## 缺口",
    ...(capabilityPlan.gaps.length > 0
      ? capabilityPlan.gaps.map(
          (gap) => `- ${gap.need}：${gap.reason}；下一步：${gap.nextAction}`,
        )
      : ["- 暂无缺口。"]),
    "",
    "## 安全边界",
    "- 平台业务数据库不是岗位工具，岗位不能直接访问平台订单、用户、钱包、审核、授权等业务表。",
    "- 独立数据库类 adapter 只有在独立数据源、独立权限、参数化调用和审计齐全时，才能作为平台 tool 进入 catalog。",
    "- 平台统一审核 skill/tool/API/MCP/provider；通用能力可本地安装，岗位专属或重型能力默认远程路由，运行时仍需用户授权、workspace 范围和风险策略校验。",
  ];
  return `${lines.join("\n")}\n`;
}
