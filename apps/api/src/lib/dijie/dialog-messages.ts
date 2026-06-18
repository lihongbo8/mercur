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
import type { DijieReviewQueueItem } from "./role-review-center";
import type { DijieRoleListing } from "./role-listings";

export type DijieDialogMessageResponse = {
  reply: string;
  grounding: {
    roles: Array<
      Pick<DijieRoleListing, "id" | "title" | "subtitle" | "handle">
    >;
    source: "role_listings" | "dialog_context";
    review?:
      | {
          roleListingId: string;
          reviewId: string;
          title: string;
          reviewState: string;
          listingStatus: string;
        }
      | undefined;
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
    role.usageInstructions,
    role.developerName,
    role.packageId,
    ...role.capabilities,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function matchingRoles(
  message: string,
  roles: DijieRoleListing[],
): DijieRoleListing[] {
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
  const price =
    fee > 0 ? `${fee.toFixed(2)} ${role.pricing.currency}` : "0 CNY";
  const subtitle = role.subtitle ? `：${role.subtitle}` : "";
  return `${role.title}${subtitle}，授权费 ${price}`;
}

function createBuyerStorefrontReply(
  message: string,
  roles: DijieRoleListing[],
) {
  const matches = matchingRoles(message, roles);
  const text = normalizedText(message);
  const asksExecution =
    /(执行|运行|调用|开始任务|做任务|生成主图|直接做)/u.test(text);
  if (asksExecution) {
    return {
      reply:
        matches.length > 0
          ? `商城页不能执行岗位，也不能读取你的私有执行记录。可以先查看并授权：${matches.map(roleSummary).join("；")}。授权后请进入使用者中心或 OpenClaw 正式执行。`
          : "商城页不能执行岗位，也不能读取你的私有执行记录。请先选择并授权已审核上架岗位，授权后再进入使用者中心或 OpenClaw 正式执行。",
      roles: matches,
    };
  }
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

function reviewIssues(
  review: DijieReviewQueueItem | undefined,
  section: "all" | "safety" | "pricing",
) {
  if (!review) {
    return [];
  }
  const checks =
    section === "safety"
      ? [...review.safetyChecks, ...review.specialtyChecks]
      : section === "pricing"
        ? review.pricingSummary.checks
        : [
            ...review.capabilityChecks,
            ...review.safetyChecks,
            ...review.pricingSummary.checks,
            ...review.specialtyChecks,
          ];

  return checks
    .filter((item) => item.status !== "pass")
    .map((item) => `${item.label}：${item.note}`)
    .slice(0, 5);
}

function adminReviewGrounding(review: DijieReviewQueueItem | undefined) {
  if (!review) {
    return undefined;
  }
  return {
    roleListingId: review.id,
    reviewId: review.reviewId,
    title: review.title,
    reviewState: String(review.reviewState),
    listingStatus: String(review.listingStatus),
  };
}

function createAdminReviewReply(
  message: string,
  review?: DijieReviewQueueItem,
) {
  const text = normalizedText(message);
  const roleLabel = review ? `「${review.title}」` : "当前岗位";
  const price = review?.pricingSummary.authorizationFee ?? "未读取";
  const executionFee =
    review?.pricingSummary.platformExecutionFee ??
    review?.pricingSummary.modelUsageFee ??
    "未读取";

  if (text.includes("安全") || text.includes("违法") || text.includes("合规")) {
    const issues = reviewIssues(review, "safety");
    return issues.length > 0
      ? `${roleLabel} 的安全合规需重点核对：${issues.join("；")}。建议不会自动改变审核结论，需要审核人员手动保存三项评估。`
      : `${roleLabel} 暂未命中阻断级安全问题，仍需人工复核权限边界、敏感数据和审计回读。AI 不会自动通过或驳回。`;
  }
  if (text.includes("价格") || text.includes("定价") || text.includes("计费")) {
    const issues = reviewIssues(review, "pricing");
    const issueText =
      issues.length > 0
        ? `需处理：${issues.join("；")}。`
        : "暂未命中阻断级定价问题。";
    return `${roleLabel} 当前授权费 ${price}，平台执行费用口径 ${executionFee}。${issueText}最终价格是否合理仍由审核人员确认。`;
  }
  const issues = reviewIssues(review, "all");
  const issueText =
    issues.length > 0
      ? `当前缺失/风险点：${issues.join("；")}。`
      : "当前 read model 未发现自动阻断项。";
  return `${roleLabel} 已绑定审核 read model：状态 ${review?.reviewStateLabel ?? "未读取"}，授权费 ${price}。${issueText}AI 只辅助总结、查缺失、评估安全和起草意见；最终通过、要求补充或驳回必须由审核人员手动确认。`;
}

function modelReplyText(
  modelResult: DijieOpenClawDialogModelResult | null | undefined,
): string {
  const raw = modelResult?.reply.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw) as { reply?: unknown };
    return typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : raw;
  } catch {
    return raw;
  }
}

function createDeveloperCenterReply(
  message: string,
  actions: DijieDialogAction[],
): string {
  const text = normalizedText(message);
  if (
    actions.some((action) => action.action === "navigate_listing") &&
    /(下架|下线|撤下|停用|delist|unpublish)/u.test(text)
  ) {
    return "下架岗位请进入岗位商品列表，找到已上架岗位后执行“下架岗位”。我已为你定位到岗位商品页；下架属于状态变更，最终点击前仍需要人工确认。";
  }

  if (actions.some((action) => action.action === "navigate_listing")) {
    return "已定位到岗位商品列表，可以查看草稿、审核状态、上架状态和可用操作。";
  }

  if (actions.some((action) => action.action === "navigate_upload")) {
    return "已定位到上传岗位页，可以承接 ready 岗位包草稿并提交审核。";
  }

  return "开发者中心 AI 开发助手可以根据自然语言生成岗位包、匹配能力、校验安全边界并引导上传；明确说“销售记录、结算、资料”等入口时才走快捷导航。";
}

export function createDijieDialogMessageResponse(input: {
  context: DijieDialogContext;
  message: string;
  roles?: DijieRoleListing[];
  adminReview?: DijieReviewQueueItem | undefined;
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
      reply: createDeveloperCenterReply(input.message, actions),
      grounding: { roles: [], source: "dialog_context" },
    });
  }

  if (input.context.surface === "admin_review") {
    return withModelResult({
      reply: createAdminReviewReply(input.message, input.adminReview),
      grounding: {
        roles: [],
        source: "dialog_context",
        review: adminReviewGrounding(input.adminReview),
      },
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
