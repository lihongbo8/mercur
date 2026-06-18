import type { DijieDialogAction } from "./dialog-actions";
import type {
  DijieDialogContext,
  DijieDialogSurface,
} from "./dialog-context";
import type { DijieDialogCapabilityPolicy } from "./dialog-capability-policy";

export type DijieDialogIntentName =
  | "role_intake"
  | "role_blueprint"
  | "capability_plan"
  | "package_build"
  | "package_preflight"
  | "upload_ready"
  | "developer_navigation"
  | "role_discovery"
  | "role_explanation"
  | "user_records"
  | "execution_intent"
  | "review_summary"
  | "review_safety"
  | "review_pricing"
  | "review_note"
  | "main_goal_understanding"
  | "main_execution_plan";

export type DijieDialogIntent = {
  name: DijieDialogIntentName;
  surface: DijieDialogSurface;
  confidence: "low" | "medium" | "high";
  requiresModel: boolean;
  summary: string;
};

export type DijieDialogProfile = {
  surface: DijieDialogSurface;
  identity: string;
  businessStage: string;
  dataBoundary: string;
  allowedActions: string[];
  forbiddenActions: string[];
  outputContract: string;
};

export type DijieDialogRequiredConfirmation = {
  actionId: string;
  action: string;
  label: string;
  target: string;
  reason: string;
};

export type DijieDialogArtifactStatus =
  | "proposed"
  | "partial"
  | "ready"
  | "blocked"
  | "submitted";

export type DijieDialogArtifact = {
  kind:
    | "navigation"
    | "role_build_session"
    | "role_package_draft"
    | "role_listing"
    | "execution_plan"
    | "review_note";
  id?: string;
  label: string;
  status: DijieDialogArtifactStatus;
  target?: string;
  metadata?: Record<string, unknown>;
};

export type DijieDialogOrchestration = {
  profile: DijieDialogProfile;
  intent: DijieDialogIntent;
  allowedActions: string[];
  proposedActions: DijieDialogAction[];
  requiredConfirmations: DijieDialogRequiredConfirmation[];
  artifacts: DijieDialogArtifact[];
};

const PROFILE_COPY: Record<
  DijieDialogSurface,
  Omit<DijieDialogProfile, "surface" | "allowedActions" | "forbiddenActions">
> = {
  developer_center: {
    identity: "开发者中心 AI 开发助手",
    businessStage: "岗位开发、蓝图生成、能力匹配、岗位包生成、上传前预检",
    dataBoundary: "只能读取当前开发者自己的岗位包、岗位商品、审核状态和结算摘要。",
    outputContract:
      "必须输出结构化意图和建议动作；不能自动上架、不能读取买家私有数据、不能绕过上传预检。",
  },
  buyer_storefront: {
    identity: "商城购买前咨询助手",
    businessStage: "岗位发现、解释、比较和购买前引导",
    dataBoundary: "只能读取公开上架岗位和当前账号的授权摘要，不能读取私有执行记录。",
    outputContract:
      "只能推荐和解释公开岗位；不能执行岗位，购买或授权必须由用户确认。",
  },
  user_center: {
    identity: "使用者中心助手",
    businessStage: "已购岗位、授权、费用、执行记录、个人云端执行和公司本地执行入口",
    dataBoundary: "只能读取当前使用者自己的授权、执行记录和费用记录。",
    outputContract:
      "可以生成执行意图和确认点；独立个人可走使用者中心云端执行，公司客户按账号策略转本地 OpenClaw；任何执行都必须经后端 action router 校验授权、确认点、费用和审计。",
  },
  admin_review: {
    identity: "审核助手",
    businessStage: "岗位审核、安全合规、定价风险和审核意见草稿",
    dataBoundary: "只能读取审核队列内的岗位包摘要、公开展示资料和定价风险摘要。",
    outputContract:
      "只能起草总结和评估建议；不能自动通过、自动驳回或替审核人员保存结论。",
  },
  openclaw_main: {
    identity: "OpenClaw 主流程层对话框",
    businessStage: "目标理解、计划、授权检查、岗位调度、执行回读",
    dataBoundary:
      "只拿业务任务和岗位选择；cloudBaseUrl、已安装岗位、entitlement、执行 token 由 gateway 内部解析。",
    outputContract:
      "必须校验授权、权限、确认点和费用归属；执行后写入 execution、ledger、audit record。",
  },
  openclaw_local: {
    identity: "OpenClaw 本地兼容对话框",
    businessStage: "本地开发调试或旧版主流程入口",
    dataBoundary: "本地访问仍必须通过主流程边界和权限检查。",
    outputContract:
      "保留兼容，不新增绕过主流程的能力；新主流程入口应使用 openclaw_main。",
  },
};

function normalizedText(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function buildDialogContext(input: {
  context: DijieDialogContext;
  pageContext?: Record<string, unknown> | undefined;
}) {
  return {
    actor: {
      accountId: input.context.accountId,
      accountType: input.context.accountType,
      billingAccountId: input.context.billingAccountId,
    },
    surface: input.context.surface,
    mode: input.context.mode,
    subject: input.context.subject,
    pageContext: input.pageContext ?? {},
  };
}

export function buildDijieDialogProfile(input: {
  context: DijieDialogContext;
  capabilityPolicy: DijieDialogCapabilityPolicy;
}): DijieDialogProfile {
  const copy = PROFILE_COPY[input.context.surface];
  return {
    surface: input.context.surface,
    identity: copy.identity,
    businessStage: copy.businessStage,
    dataBoundary: copy.dataBoundary,
    allowedActions: input.capabilityPolicy.allowedActions,
    forbiddenActions: input.capabilityPolicy.forbiddenActions,
    outputContract: copy.outputContract,
  };
}

export function classifyIntent(input: {
  context: DijieDialogContext;
  message: string;
  actions: DijieDialogAction[];
}): DijieDialogIntent {
  const text = normalizedText(input.message);
  const actionNames = new Set(input.actions.map((item) => item.action));
  const hasAction = (name: string) => actionNames.has(name);

  if (input.context.surface === "developer_center") {
    if (hasAction("generate_role_package")) {
      return {
        name: "package_build",
        surface: input.context.surface,
        confidence: "high",
        requiresModel: true,
        summary: "开发者要求生成岗位包，进入分阶段 role_package build session。",
      };
    }
    if (hasAction("navigate_upload")) {
      return {
        name: "upload_ready",
        surface: input.context.surface,
        confidence: "high",
        requiresModel: false,
        summary: "开发者要求进入上传岗位页承接 ready 草稿。",
      };
    }
    if (input.actions.some((item) => item.kind === "navigate")) {
      return {
        name: "developer_navigation",
        surface: input.context.surface,
        confidence: "high",
        requiresModel: false,
        summary: "开发者要求在开发者中心内跳转。",
      };
    }
    if (includesAny(text, ["能力", "工具", "skill", "adapter"])) {
      return {
        name: "capability_plan",
        surface: input.context.surface,
        confidence: "medium",
        requiresModel: true,
        summary: "开发者在讨论岗位能力匹配或 adapter 规划。",
      };
    }
    if (includesAny(text, ["蓝图", "sop", "流程", "确认点", "失败标准"])) {
      return {
        name: "role_blueprint",
        surface: input.context.surface,
        confidence: "medium",
        requiresModel: true,
        summary: "开发者在规划岗位蓝图、SOP、确认点或失败标准。",
      };
    }
    return {
      name: "role_intake",
      surface: input.context.surface,
      confidence: "medium",
      requiresModel: true,
      summary: "开发者输入岗位需求，先做需求理解和边界澄清。",
    };
  }

  if (input.context.surface === "buyer_storefront") {
    return {
      name: includesAny(text, ["区别", "比较", "哪个好", "差异"]) ? "role_explanation" : "role_discovery",
      surface: input.context.surface,
      confidence: input.actions.length > 0 ? "high" : "medium",
      requiresModel: true,
      summary: "商城购买前只做岗位发现、解释、比较和授权入口引导。",
    };
  }

  if (input.context.surface === "user_center") {
    return {
      name: includesAny(text, ["执行", "运行", "调用岗位"]) ? "execution_intent" : "user_records",
      surface: input.context.surface,
      confidence: input.actions.length > 0 ? "high" : "medium",
      requiresModel: true,
      summary:
        "使用者中心读取自己的授权、费用和执行记录；执行请求先生成确认意图，独立个人走云端执行，公司客户转本地 OpenClaw。",
    };
  }

  if (input.context.surface === "admin_review") {
    const name = hasAction("evaluate_safety_compliance")
      ? "review_safety"
      : hasAction("evaluate_pricing_risk")
        ? "review_pricing"
        : hasAction("draft_review_note")
          ? "review_note"
          : "review_summary";
    return {
      name,
      surface: input.context.surface,
      confidence: input.actions.length > 0 ? "high" : "medium",
      requiresModel: true,
      summary: "审核助手只输出审核建议和草稿，审核状态必须人工改变。",
    };
  }

  return {
    name: hasAction("prepare_role_task") ? "main_execution_plan" : "main_goal_understanding",
    surface: input.context.surface,
    confidence: input.actions.length > 0 ? "high" : "medium",
    requiresModel: true,
    summary:
      input.context.surface === "openclaw_main"
        ? "OpenClaw 主流程层理解业务目标并准备授权检查、岗位调度和执行回读。"
        : "OpenClaw 本地兼容入口保留主流程边界，不绕过授权和调度。",
  };
}

export function resolveAllowedActions(input: {
  capabilityPolicy: DijieDialogCapabilityPolicy;
}): string[] {
  return input.capabilityPolicy.allowedActions;
}

function confirmationReason(action: DijieDialogAction): string {
  if (action.kind === "submit_role_package_draft") {
    return "岗位包提交会创建正式资料包，必须在上传岗位页人工确认。";
  }
  if (action.kind === "prepare_role_execution") {
    if (action.executionChannel === "cloud_user_center") {
      return "使用者中心云端执行会进入授权、费用和审计链路，必须确认岗位、业务任务和费用归属。";
    }
    return "岗位执行会进入授权、费用和审计链路，必须确认岗位和业务任务。";
  }
  if (action.kind === "mark_review_evaluation" || action.kind === "draft_review_note") {
    return "审核建议不能自动改变审核结论，必须审核人员人工确认。";
  }
  return "该动作需要人工确认后才允许进入业务 action router。";
}

function artifactFromAction(action: DijieDialogAction): DijieDialogArtifact {
  const metadata = {
    action: action.action,
    ...(action.executionChannel ? { executionChannel: action.executionChannel } : {}),
  };

  if (action.kind === "generate_role_package") {
    return {
      kind: "role_build_session",
      label: "岗位包构建会话",
      status: "proposed",
      target: action.target,
      metadata,
    };
  }
  if (action.kind === "submit_role_package_draft") {
    return {
      kind: "role_package_draft",
      id: action.target,
      label: "岗位包 ready 草稿",
      status: "ready",
      target: action.target,
      metadata,
    };
  }
  if (action.kind === "navigate_authorization") {
    return {
      kind: "role_listing",
      id: action.target,
      label: action.label,
      status: "proposed",
      target: action.path ?? action.target,
    };
  }
  if (action.kind === "prepare_role_execution") {
    return {
      kind: "execution_plan",
      label: "岗位执行计划",
      status: "proposed",
      target: action.target,
      metadata,
    };
  }
  if (action.kind === "draft_review_note" || action.kind === "mark_review_evaluation") {
    return {
      kind: "review_note",
      label: action.label,
      status: "proposed",
      target: action.target,
      metadata,
    };
  }
  return {
    kind: "navigation",
    label: action.label,
    status: "proposed",
    target: action.path ?? action.target,
    metadata,
  };
}

export function createDijieDialogOrchestration(input: {
  context: DijieDialogContext;
  capabilityPolicy: DijieDialogCapabilityPolicy;
  message: string;
  actions: DijieDialogAction[];
  artifacts?: DijieDialogArtifact[];
}): DijieDialogOrchestration {
  const profile = buildDijieDialogProfile({
    context: input.context,
    capabilityPolicy: input.capabilityPolicy,
  });
  return {
    profile,
    intent: classifyIntent({
      context: input.context,
      message: input.message,
      actions: input.actions,
    }),
    allowedActions: resolveAllowedActions({ capabilityPolicy: input.capabilityPolicy }),
    proposedActions: input.actions,
    requiredConfirmations: input.actions
      .filter((action) => action.requiresConfirmation)
      .map((action) => ({
        actionId: action.id,
        action: action.action,
        label: action.label,
        target: action.target,
        reason: confirmationReason(action),
      })),
    artifacts: input.artifacts ?? input.actions.map(artifactFromAction),
  };
}

export function buildSurfacePrompt(input: {
  context: DijieDialogContext;
  capabilityPolicy: DijieDialogCapabilityPolicy;
  message: string;
  fallbackReply: string;
  actions: DijieDialogAction[];
  pageContext?: Record<string, unknown>;
}): string {
  const dialogContext = buildDialogContext({
    context: input.context,
    pageContext: input.pageContext,
  });
  const orchestration = createDijieDialogOrchestration({
    context: input.context,
    capabilityPolicy: input.capabilityPolicy,
    message: input.message,
    actions: input.actions,
  });
  const subject = JSON.stringify(dialogContext.subject);

  return [
    `你是${orchestration.profile.identity}。`,
    `surface: ${input.context.surface}`,
    `mode: ${input.context.mode}`,
    `businessStage: ${orchestration.profile.businessStage}`,
    `intent: ${orchestration.intent.name}`,
    `dataBoundary: ${orchestration.profile.dataBoundary}`,
    `allowedDataScopes: ${input.capabilityPolicy.allowedDataScopes.join(", ") || "none"}`,
    `allowedActions: ${orchestration.allowedActions.join(", ") || "none"}`,
    `forbiddenActions: ${orchestration.profile.forbiddenActions.join(", ") || "none"}`,
    `subject: ${subject}`,
    `pageContext: ${JSON.stringify(dialogContext.pageContext)}`,
    `outputContract: ${orchestration.profile.outputContract}`,
    "真实业务动作只能由后端 action router 执行；模型不能声称已经上传、已购买、已审核通过、已执行岗位或已写入费用。",
    "模型回复必须是 JSON：{\"reply\": string, \"intent\": string, \"artifacts\": []}。reply 用中文，简洁说明下一步和必要边界。",
    `backendFallbackReply: ${input.fallbackReply}`,
    `proposedActions: ${JSON.stringify(
      input.actions.map((action) => ({
        id: action.id,
        action: action.action,
        target: action.target,
        requiresConfirmation: action.requiresConfirmation,
      })),
    )}`,
    `用户消息：\n${input.message}`,
  ].join("\n");
}

export function executeDialogAction(action: DijieDialogAction) {
  return {
    executed: false,
    actionId: action.id,
    action: action.action,
    reason: "真实业务动作必须由具体 surface 的 action router 在权限校验和人工确认后执行。",
  };
}

export function recordDialogTurn(input: {
  context: DijieDialogContext;
  orchestration: DijieDialogOrchestration;
}) {
  return {
    context: input.context,
    intent: input.orchestration.intent,
    proposedActions: input.orchestration.proposedActions,
    requiredConfirmations: input.orchestration.requiredConfirmations,
    artifacts: input.orchestration.artifacts,
  };
}
