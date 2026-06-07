import {
  createDijieDialogActions,
  type DijieDialogAction,
} from "./dialog-actions";
import { getDijieDialogCapabilityPolicy } from "./dialog-capability-policy";
import {
  getDijieDialogBillingPolicy,
  type DijieDialogBillingPolicy,
  type DijieDialogContext,
} from "./dialog-context";
import {
  createDijieDialogOrchestration,
  type DijieDialogArtifact,
  type DijieDialogIntent,
  type DijieDialogOrchestration,
  type DijieDialogRequiredConfirmation,
} from "./dialog-orchestrator";
import {
  normalizeDijieDialogModelUsage,
  type DijieOpenClawDialogModelResult,
  type DijieDialogModelUsage,
} from "./dialog-model-bridge";
import type { DijieRoleListing } from "./role-listings";

export type DijieDialogMessageResponse = {
  reply: string;
  grounding: {
    roles: Array<Pick<DijieRoleListing, "id" | "title" | "subtitle" | "handle">>;
    source: "role_listings" | "dialog_context";
  };
  billingPolicy: DijieDialogBillingPolicy;
  modelUsage: DijieDialogModelUsage | null;
  modelCalled: boolean;
  actions: DijieDialogAction[];
  intent: DijieDialogIntent;
  allowedActions: string[];
  proposedActions: DijieDialogAction[];
  requiredConfirmations: DijieDialogRequiredConfirmation[];
  artifacts: DijieDialogArtifact[];
  orchestration: DijieDialogOrchestration;
};

function normalizedText(value: string): string {
  return value.trim().toLowerCase();
}

function roleSearchTerms(message: string): string[] {
  const text = normalizedText(message);
  const terms = [
    "美工",
    "设计",
    "视觉",
    "图片",
    "图像",
    "商品图",
    "客服",
    "质检",
    "合同",
    "摘要",
    "库存",
  ].filter((term) => text.includes(term));

  if (text.includes("美工")) {
    terms.push("设计", "视觉", "图片", "商品图");
  }
  return [...new Set(terms)];
}

function roleText(role: DijieRoleListing): string {
  return [
    role.title,
    role.subtitle,
    role.description,
    role.developerName,
    role.packageId,
    ...role.capabilities,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function matchingRoles(message: string, roles: DijieRoleListing[]): DijieRoleListing[] {
  const terms = roleSearchTerms(message);
  if (terms.length === 0) {
    return roles.slice(0, 5);
  }
  return roles
    .filter((role) => {
      const haystack = roleText(role);
      return terms.some((term) => haystack.includes(term.toLowerCase()));
    })
    .slice(0, 5);
}

function roleSummary(role: DijieRoleListing): string {
  const fee = role.pricing.authorizationFeeCents / 100;
  const price = fee > 0 ? `${fee.toFixed(2)} ${role.pricing.currency}` : "0 CNY";
  const subtitle = role.subtitle ? `：${role.subtitle}` : "";
  return `${role.title}${subtitle}，授权费 ${price}`;
}

function createBuyerStorefrontReply(message: string, roles: DijieRoleListing[]) {
  const matches = matchingRoles(message, roles);
  if (matches.length === 0) {
    const terms = roleSearchTerms(message);
    const queryHint = terms.length > 0 ? `“${terms[0]}”` : "这个需求";
    return {
      reply: `根据当前已发布岗位库，暂时没有找到明确匹配${queryHint}的岗位。你可以换成更具体的任务描述，我会继续按真实岗位库查询。`,
      roles: matches,
    };
  }

  const prefix =
    matches.length === 1
      ? "根据当前已发布岗位库，找到 1 个可能相关岗位："
      : `根据当前已发布岗位库，找到 ${matches.length} 个可能相关岗位：`;
  return {
    reply: `${prefix}${matches.map(roleSummary).join("；")}。`,
    roles: matches,
  };
}

function createAdminReviewReply(message: string) {
  const text = normalizedText(message);
  if (text.includes("安全") || text.includes("违法") || text.includes("合规")) {
    return "审核助手建议先看违法违规风险、权限边界、敏感数据、本地路径或密钥暴露、审计回读是否脱敏。建议不会自动改变审核结论，需要审核人员手动保存三项评估。";
  }
  if (text.includes("价格") || text.includes("定价") || text.includes("计费")) {
    return "审核助手建议核对授权费、模型调用费、开发者收益、平台费用和隐藏收费风险；最终价格是否合理仍由审核人员确认。";
  }
  return "审核助手可以辅助总结岗位、查缺失、评估安全合规、评估定价并起草意见；最终通过、要求补充或驳回必须由审核人员手动确认。";
}

function modelReplyText(modelResult: DijieOpenClawDialogModelResult | null | undefined): string {
  const raw = modelResult?.reply.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as { reply?: unknown };
    return typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : raw;
  } catch {
    return raw;
  }
}

export function createDijieDialogMessageResponse(input: {
  context: DijieDialogContext;
  message: string;
  roles?: DijieRoleListing[];
  modelResult?: DijieOpenClawDialogModelResult | null;
}): DijieDialogMessageResponse {
  const billingPolicy = getDijieDialogBillingPolicy(input.context);
  const capabilityPolicy = getDijieDialogCapabilityPolicy(input.context);
  const roles = input.roles ?? [];
  let actions = createDijieDialogActions({
    context: input.context,
    message: input.message,
    roles,
  });
  const modelUsage =
    billingPolicy.modelAllowed && input.modelResult
      ? normalizeDijieDialogModelUsage(input.modelResult.usage)
      : null;

  function withModelResult(
    response: Omit<
      DijieDialogMessageResponse,
      | "billingPolicy"
      | "modelCalled"
      | "modelUsage"
      | "actions"
      | "intent"
      | "allowedActions"
      | "proposedActions"
      | "requiredConfirmations"
      | "artifacts"
      | "orchestration"
    >,
  ): DijieDialogMessageResponse {
    const orchestration = createDijieDialogOrchestration({
      context: input.context,
      capabilityPolicy,
      message: input.message,
      actions,
    });
    const parsedModelReply = modelReplyText(input.modelResult);
    return {
      ...response,
      reply: modelUsage ? parsedModelReply || response.reply : response.reply,
      billingPolicy,
      modelUsage,
      modelCalled: Boolean(modelUsage),
      actions,
      intent: orchestration.intent,
      allowedActions: orchestration.allowedActions,
      proposedActions: orchestration.proposedActions,
      requiredConfirmations: orchestration.requiredConfirmations,
      artifacts: orchestration.artifacts,
      orchestration,
    };
  }

  if (input.context.surface === "buyer_storefront") {
    const reply = createBuyerStorefrontReply(input.message, roles);
    actions = createDijieDialogActions({
      context: input.context,
      message: input.message,
      roles: reply.roles,
    });
    return withModelResult({
      reply: reply.reply,
      grounding: {
        roles: reply.roles.map((role) => ({
          id: role.id,
          title: role.title,
          subtitle: role.subtitle,
          handle: role.handle,
        })),
        source: "role_listings",
      },
    });
  }

  if (input.context.surface === "developer_center") {
    return withModelResult({
      reply:
        "开发者中心 AI 开发助手可以根据自然语言生成岗位包、匹配能力、校验安全边界并引导上传；明确说“销售记录、结算、资料”等入口时才走快捷导航。",
      grounding: { roles: [], source: "dialog_context" },
    });
  }

  if (input.context.surface === "admin_review") {
    return withModelResult({
      reply: createAdminReviewReply(input.message),
      grounding: { roles: [], source: "dialog_context" },
    });
  }

  if (input.context.surface === "user_center") {
    return withModelResult({
      reply:
        "使用者中心助手可以帮你查我的岗位、授权记录、费用记录和执行记录；独立个人后续可在使用者中心发起云端岗位执行，公司客户按账号策略转本地 OpenClaw 执行，所有执行都要过授权、确认点、费用和审计。",
      grounding: { roles: [], source: "dialog_context" },
    });
  }

  return withModelResult({
    reply:
      input.context.mode === "developer"
        ? "本地端开发者模式助手用于岗位包生成、校验和上传前预检。"
        : "本地端使用者模式会进入正式岗位执行链路，必须先校验授权，再写入调度、费用和审计记录。",
    grounding: { roles: [], source: "dialog_context" },
  });
}
