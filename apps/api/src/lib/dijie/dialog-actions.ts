import type { DijieDialogContext } from "./dialog-context";
import { isDijieRolePackageGenerationIntent } from "./role-package-generator";
import type { DijieRoleListing } from "./role-listings";

export type DijieDialogActionKind =
  | "navigate"
  | "generate_role_package"
  | "submit_role_package_draft"
  | "navigate_authorization"
  | "navigate_user_record"
  | "prepare_role_execution"
  | "draft_review_note"
  | "mark_review_evaluation";

export type DijieDialogActionRisk = "low" | "confirmation_required" | "blocked";

export type DijieDialogAction = {
  id: string;
  kind: DijieDialogActionKind;
  label: string;
  description: string;
  action: string;
  target: string;
  executionChannel?: "cloud_user_center" | "local_openclaw" | "openclaw_main";
  path?: string;
  method?: "GET" | "POST";
  requiresConfirmation: boolean;
  risk: DijieDialogActionRisk;
};

function normalizedText(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function action(input: DijieDialogAction): DijieDialogAction {
  return input;
}

function rolePath(role: Pick<DijieRoleListing, "handle" | "id">): string {
  return `/us/roles/${encodeURIComponent(role.id)}`;
}

function developerNavigationActions(message: string): DijieDialogAction[] {
  const text = normalizedText(message);
  const actions: DijieDialogAction[] = [];

  if (includesAny(text, ["开发对话", "回到对话", "返回对话", "dialog", "chat", "home"])) {
    actions.push(
      action({
        id: "developer.navigate.home",
        kind: "navigate",
        label: "回到开发对话",
        description: "回到开发者中心首页对话框。",
        action: "navigate_dialog_home",
        target: "developer_center.dialog",
        path: "/",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (
    /(上传|上架|发布).*(岗位|岗位包|role_package|草稿|商品)|岗位包.*(上传|上架|发布)|\b(upload|create|submit|publish)\b.*\b(role|package|product|draft|listing)\b|\brole[_ -]?package\b.*\b(upload|submit|publish)\b/u.test(
      text,
    )
  ) {
    actions.push(
      action({
        id: "developer.navigate.upload",
        kind: "navigate",
        label: "进入上传岗位",
        description: "打开上传岗位页，确认岗位包草稿并进入提交确认。",
        action: "navigate_upload",
        target: "developer_center.role_package_upload",
        path: "/products/create",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (/(岗位商品|商品|岗位).*(审核|状态|上架|下架|下线|撤下|停用|管理|列表|查看|按钮)|(?:审核|下架|下线|撤下|停用).*(岗位|商品|状态)|上架状态|下架岗位|\b(products?|listings?)\b.*\b(status|review|manage|list|open|view|delist|unpublish)?\b|\b(status|review|delist|unpublish)\b.*\b(products?|listings?)\b/u.test(text)) {
    actions.push(
      action({
        id: "developer.navigate.listings",
        kind: "navigate",
        label: "查看岗位商品",
        description: "打开岗位商品列表，查看草稿、审核和上架状态。",
        action: "navigate_listing",
        target: "developer_center.role_listings",
        path: "/products",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (/(销售|订单|购买).*(记录|查看|列表|状态)?|订单|\b(orders?|sales?)\b/u.test(text)) {
    actions.push(
      action({
        id: "developer.navigate.orders",
        kind: "navigate",
        label: "查看销售记录",
        description: "打开销售记录页。",
        action: "navigate_sales",
        target: "developer_center.orders",
        path: "/orders",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (/(结算|分账|应收|收款).*(记录|查看|列表|状态)?|\b(payouts?|settlements?|receivables?)\b/u.test(text)) {
    actions.push(
      action({
        id: "developer.navigate.payouts",
        kind: "navigate",
        label: "查看结算记录",
        description: "打开结算记录页。",
        action: "navigate_payouts",
        target: "developer_center.payouts",
        path: "/payouts",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (/(开发者资料|账户资料|个人资料|资料|地址|主体信息|公司信息).*(查看|编辑|补全|打开|进入|管理)?|\b(profile|settings|developer profile|account)\b/u.test(text)) {
    actions.push(
      action({
        id: "developer.navigate.profile",
        kind: "navigate",
        label: "查看开发者资料",
        description: "打开开发者资料页。",
        action: "navigate_profile",
        target: "developer_center.profile",
        path: "/settings/profile",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  return actions;
}

function developerActions(message: string): DijieDialogAction[] {
  if (isDijieRolePackageGenerationIntent(message)) {
    return [
      action({
        id: "developer.generate.role_package",
        kind: "generate_role_package",
        label: "生成岗位包草稿",
        description: "调用模型分阶段生成 role_package，并写入草稿、质量报告和能力匹配报告。",
        action: "generate_role_package",
        target: "developer_center.role_package_draft",
        method: "POST",
        requiresConfirmation: false,
        risk: "confirmation_required",
      }),
    ];
  }

  return developerNavigationActions(message);
}

function buyerStorefrontActions(roles: DijieRoleListing[]): DijieDialogAction[] {
  return roles.slice(0, 3).map((role) =>
    action({
      id: `buyer.authorize.${role.id}`,
      kind: "navigate_authorization",
      label: `查看 ${role.title}`,
      description: "打开岗位详情和授权入口。购买或授权仍需要用户确认。",
      action: "navigate_authorization",
      target: role.id,
      path: rolePath(role),
      requiresConfirmation: false,
      risk: "low",
    }),
  );
}

function userCenterActions(message: string, context: DijieDialogContext): DijieDialogAction[] {
  const text = normalizedText(message);
  const actions: DijieDialogAction[] = [];
  const asksForExecution =
    /(执行|运行|调用|使用).{0,12}(岗位|任务|这个)|用.{0,20}岗位/u.test(text) &&
    !/(执行记录|历史|结果|失败原因|上次)/u.test(text);

  if (includesAny(text, ["我的岗位", "授权", "已购买", "已安装"])) {
    actions.push(
      action({
        id: "user.navigate.roles",
        kind: "navigate_user_record",
        label: "查看我的岗位",
        description: "打开使用者中心的已授权岗位记录。",
        action: "navigate_role",
        target: "user_center.roles",
        path: "/account/roles",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (asksForExecution) {
    actions.push(
      action({
        id: "user.prepare.role_execution",
        kind: "prepare_role_execution",
        label: "准备岗位执行",
        description:
          "生成执行意图和确认点；独立个人默认走使用者中心云端执行，公司客户按账号策略转本地 OpenClaw。",
        action: "prepare_role_execution",
        target: context.subject.roleListingId ?? "user_center.selected_role",
        executionChannel: "cloud_user_center",
        method: "POST",
        requiresConfirmation: true,
        risk: "confirmation_required",
      }),
    );
  } else if (includesAny(text, ["执行", "记录", "审计", "结果"])) {
    actions.push(
      action({
        id: "user.navigate.executions",
        kind: "navigate_user_record",
        label: "查看执行记录",
        description: "打开当前账号可见的岗位执行记录。",
        action: "navigate_execution",
        target: context.subject.executionId ?? "user_center.executions",
        path: context.subject.executionId
          ? `/account/executions/${encodeURIComponent(context.subject.executionId)}`
          : "/account/executions",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  if (includesAny(text, ["费用", "账单", "用量", "ledger", "计费"])) {
    actions.push(
      action({
        id: "user.navigate.ledger",
        kind: "navigate_user_record",
        label: "查看费用记录",
        description: "打开当前账号费用和模型用量记录。",
        action: "navigate_ledger",
        target: "user_center.ledger",
        path: "/account/ledger",
        requiresConfirmation: false,
        risk: "low",
      }),
    );
  }

  return actions;
}

function adminReviewActions(message: string, context: DijieDialogContext): DijieDialogAction[] {
  const text = normalizedText(message);
  const actions: DijieDialogAction[] = [];

  if (includesAny(text, ["安全", "合规", "风险", "权限", "敏感"])) {
    actions.push(
      action({
        id: "review.evaluate.safety",
        kind: "mark_review_evaluation",
        label: "进入安全合规评估",
        description: "定位到安全合规评估项。是否通过仍由审核人员确认。",
        action: "evaluate_safety_compliance",
        target: context.subject.reviewId ?? context.subject.roleListingId ?? "review.current",
        requiresConfirmation: true,
        risk: "confirmation_required",
      }),
    );
  }

  if (includesAny(text, ["价格", "定价", "费用", "计费", "收益"])) {
    actions.push(
      action({
        id: "review.evaluate.pricing",
        kind: "mark_review_evaluation",
        label: "进入定价评估",
        description: "定位到定价合理性评估项。是否通过仍由审核人员确认。",
        action: "evaluate_pricing_risk",
        target: context.subject.reviewId ?? context.subject.roleListingId ?? "review.current",
        requiresConfirmation: true,
        risk: "confirmation_required",
      }),
    );
  }

  if (includesAny(text, ["补充", "驳回", "意见", "说明", "起草"])) {
    actions.push(
      action({
        id: "review.draft.note",
        kind: "draft_review_note",
        label: "起草审核意见",
        description: "生成审核意见草稿。最终保存和审核结论必须人工确认。",
        action: "draft_review_note",
        target: context.subject.reviewId ?? context.subject.roleListingId ?? "review.current",
        requiresConfirmation: true,
        risk: "confirmation_required",
      }),
    );
  }

  return actions;
}

function openClawActions(message: string, context: DijieDialogContext): DijieDialogAction[] {
  const text = normalizedText(message);

  if (context.mode === "developer") {
    return developerNavigationActions(message);
  }

  if (includesAny(text, ["执行", "运行", "调用岗位", "开始任务", "做任务"])) {
    return [
      action({
        id: "openclaw.prepare.role_execution",
        kind: "prepare_role_execution",
        label: "准备岗位执行",
        description: "主对话只收业务任务和岗位选择；gateway 内部校验授权、执行 token 并调用本地 executor。",
        action: "prepare_role_task",
        target: context.subject.roleListingId ?? "openclaw.selected_role",
        executionChannel: "local_openclaw",
        method: "POST",
        requiresConfirmation: true,
        risk: "confirmation_required",
      }),
    ];
  }

  return [
    action({
      id: "openclaw.navigate.main_workflow",
      kind: "navigate",
      label: "查看主流程状态",
      description: "进入主流程观察层，不直接创建或执行任务。",
      action: "navigate_goal",
      target: "openclaw.main_workflow",
      requiresConfirmation: false,
      risk: "low",
    }),
  ];
}

export function createDijieDialogActions(input: {
  context: DijieDialogContext;
  message: string;
  roles?: DijieRoleListing[];
}): DijieDialogAction[] {
  const roles = input.roles ?? [];
  if (input.context.surface === "buyer_storefront") {
    return buyerStorefrontActions(roles);
  }
  if (input.context.surface === "developer_center") {
    return developerActions(input.message);
  }
  if (input.context.surface === "user_center") {
    return userCenterActions(input.message, input.context);
  }
  if (input.context.surface === "admin_review") {
    return adminReviewActions(input.message, input.context);
  }
  return openClawActions(input.message, input.context);
}

export function shouldSkipDijieModelForActions(input: {
  context: DijieDialogContext;
  actions: DijieDialogAction[];
}): boolean {
  return (
    input.context.surface === "developer_center" &&
    input.actions.length > 0 &&
    input.actions.every((item) => item.kind === "navigate" && item.risk === "low")
  );
}
