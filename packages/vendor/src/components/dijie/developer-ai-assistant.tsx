import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChatBubbleLeftRight, XMark } from "@medusajs/icons";
import { Button, Container, Heading, IconButton, StatusBadge, Text, Textarea } from "@medusajs/ui";

import {
  fetchLatestDijieRolePackageDraftQuery,
  generateDijieRolePackageDraftQuery,
  sendDijieDeveloperDialogMessageQuery,
  streamDijieDeveloperDialogMessageQuery,
} from "@lib/client";

type RolePackageDraftSummary = {
  draftId?: string;
  status?: string;
  sourceMessage?: string;
  packageId?: string | null;
  packageVersion?: string | null;
  fileCount?: number;
  qualityReport?: {
    score?: number;
    ok?: boolean;
    blockingIssues?: string[];
  };
  blockingIssues?: string[];
  roleRequirementSpec?: RoleRequirementSpec;
  roleCapabilityPlan?: RoleCapabilityPlan;
  catalogReviewRequests?: CatalogReviewRequest[];
  reviewBlockers?: string[];
};

type DeveloperMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type DialogResponse = {
  message?: {
    content?: string;
  };
  actions?: DialogAction[];
  roleRequirementSpec?: RoleRequirementSpec;
  roleCapabilityPlan?: RoleCapabilityPlan;
  catalogReviewRequests?: CatalogReviewRequest[];
  blockedReasons?: string[];
};

type DialogStreamStatus = {
  message?: unknown;
  text?: unknown;
};

type DialogAction = {
  id: string;
  kind: string;
  label: string;
  description?: string;
  action: string;
  path?: string;
  requiresConfirmation?: boolean;
  risk?: string;
};

type DijieRolePackageGenerationErrorData = {
  error?: string;
  issues?: string[];
  draft?: RolePackageDraftSummary;
  roleRequirementSpec?: RoleRequirementSpec;
  roleCapabilityPlan?: RoleCapabilityPlan;
  catalogReviewRequests?: CatalogReviewRequest[];
  blockedReasons?: string[];
  diagnostics?: {
    stageId?: string;
    stageLabel?: string;
    replyPreview?: string;
    repairReplyPreview?: string;
  };
};

type RoleRequirementSpec = {
  roleName?: string;
  businessScenario?: string;
  serviceStandards?: string[];
  acceptanceStandards?: string[];
  dailyTasks?: string[];
  weeklyTasks?: string[];
  monthlyTasks?: string[];
  risks?: string[];
  missingInformation?: string[];
};

type RoleCapabilityPlan = {
  status?: string;
  requiredSkills?: string[];
  requiredTools?: string[];
  requiredCapabilities?: string[];
  catalogBindings?: Array<{
    need?: string;
    catalogRef?: string;
    kind?: string;
    status?: string;
  }>;
  gaps?: Array<{
    need?: string;
    kind?: string;
    reason?: string;
    nextAction?: string;
  }>;
  reviewBlockers?: string[];
};

type CatalogReviewRequest = {
  reviewId?: string;
  reviewKey?: string;
  id?: string;
  need?: string;
  kind?: string;
  source?: string;
  status?: string;
  review_status?: string;
  rolePackageId?: string | null;
};

type RoleGenerationInsight = {
  roleRequirementSpec?: RoleRequirementSpec;
  roleCapabilityPlan?: RoleCapabilityPlan;
  catalogReviewRequests?: CatalogReviewRequest[];
  blockedReasons?: string[];
};

const ROLE_PACKAGE_REQUIRED_FILE_COUNT = 16;
const ROLE_PACKAGE_STAGES_PER_SUBMIT = ROLE_PACKAGE_REQUIRED_FILE_COUNT;
const ROLE_PACKAGE_EXPECTED_SECONDS_PER_FILE_MIN = 60;
const ROLE_PACKAGE_EXPECTED_SECONDS_PER_FILE_MAX = 95;
const DIALOG_REQUEST_TIMEOUT_MS = 60_000;

const rolePackageOutputPaths = [
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

const requirementFields = [
  {
    key: "role_goal",
    label: "岗位目标和服务对象",
    question: "这个岗位主要服务谁，最终要交付什么结果？",
    pattern: /岗位|角色|role|服务对象|面向|商家|客户|用户|目标|定位|交付|智能门锁|美工|设计师/u,
  },
  {
    key: "business_scenario",
    label: "业务场景",
    question: "它会在哪个业务场景里工作，比如商品上新、图片巡检、详情页优化还是日常维护？",
    pattern: /业务场景|场景|电商|商品|sku|上新|主图|详情页|海报|销售|运营|日常|维护|business|scenario|ecommerce|product|listing|storefront/u,
  },
  {
    key: "sop",
    label: "SOP / 工作流程",
    question: "它从拿到资料到输出结果，中间要按什么步骤走？",
    pattern: /sop|流程|步骤|先|然后|每日|每周|每月|巡检|复盘|维护|处理/u,
  },
  {
    key: "skills_tools",
    label: "skill / 工具能力",
    question: "它需要哪些 skill、工具或外部能力，比如图片理解、浏览器检查、文案审核、人工确认？",
    pattern: /skill|能力|工具|浏览器|browser|图片|图像|文案|审核|生成|检查|adapter|provider|human|confirm/u,
  },
  {
    key: "inputs_outputs",
    label: "输入和输出",
    question: "输入资料是什么，输出文件、清单、报告或模板是什么？",
    pattern: /输入|输出|资料|文件|清单|报告|模板|record|template|brief|copy|input|output|deliverable|文案|结果/u,
  },
  {
    key: "confirmations",
    label: "人工确认点",
    question: "哪些动作发布前必须停下来等人工确认？",
    pattern: /确认|人工|发布前|上架前|审核|复核|确认点|human\.confirm/u,
  },
  {
    key: "validation_failure",
    label: "验收标准和失败标准",
    question: "什么算通过、存疑、不通过，失败时要怎么降级？",
    pattern: /验收|失败|标准|通过|存疑|不通过|风险|质量|安全|降级|模糊|虚假|隐私/u,
  },
] as const;

type NavigationTarget = {
  path: string;
  message: string;
};

const createMessageId = () =>
  `devmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const initialMessages: DeveloperMessage[] = [
  {
    id: "devmsg_intro",
    role: "assistant",
    text: "说一下你要开发的岗位。复杂岗位请包含业务场景、SOP、skill、工具能力、验收标准和失败标准。",
  },
];

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
};

const formatDuration = (seconds: number) => {
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60}分` : `${minutes}分钟`;
};

const formatDurationRange = (minSeconds: number, maxSeconds: number) => {
  if (minSeconds <= 0 && maxSeconds <= 0) {
    return "不到 1 分钟";
  }
  const minText = formatDuration(minSeconds);
  const maxText = formatDuration(maxSeconds);
  return minText === maxText ? minText : `${minText}-${maxText}`;
};

const estimateRemainingGenerationTime = (remainingFiles: number) =>
  formatDurationRange(
    remainingFiles * ROLE_PACKAGE_EXPECTED_SECONDS_PER_FILE_MIN,
    remainingFiles * ROLE_PACKAGE_EXPECTED_SECONDS_PER_FILE_MAX,
  );

const isNegatedGenerationIntent = (text: string) =>
  /(?:不要|不需要|无需|先别|别|勿|禁止).{0,12}(?:生成|创建|开发|输出|写出).{0,12}(?:岗位包|role_package|文件|manifest|skill|sop|template|validation)/u.test(text);

const isGenerationIntent = (text: string) =>
  !isNegatedGenerationIntent(text) &&
  /岗位|role[_ -]?package|manifest|skill|sop|template|validation|验收|智能体|\brole\b/u.test(text) &&
  /生成|创建|开发|做一个|补|继续|输出|写出|manifest|skill|sop|template|validation|\b(create|build|develop|generate|continue|add|update)\b/u.test(text.toLowerCase());

const isRolePackageDevelopmentSpec = (text: string) =>
  isGenerationIntent(text) &&
  (text.length >= 80 ||
    /业务场景|SOP|sop|验收标准|失败标准|skill\s*要求|requiredCapabilities|manifest\.permissions|请开发一个|岗位开发规格|生成可上传/u.test(
      text
    ));

const isRequirementContinuation = (text: string, hasIntake: boolean) =>
  hasIntake &&
  /(业务|场景|sop|流程|步骤|skill|能力|工具|输入|输出|资料|模板|验收|失败|标准|确认|跳过|默认|不用|不需要|没有|补充|增加|新增|修改|继续|开始生成|直接生成)/u.test(
    text
  );

const isRequirementChangeIntent = (text: string) =>
  /(增加|新增|补充|追加|修改|改成|再加|另外|还要|也要|调整).*(需求|能力|流程|标准|skill|工具|确认|输出|模板|岗位|role_package)|^(增加|新增|补充|追加|修改|改成|再加|另外|还要|也要|调整)/u.test(
    text
  );

const shouldProceedWithIncompleteRequirements = (text: string) =>
  /(开始生成|直接生成|继续生成|生成吧|按默认|默认处理|你来补|平台补|跳过|不用补|不补了|没有了|暂时没有|不需要|不用|先这样)/u.test(
    text
  );

const isResumeRolePackageGenerationIntent = (text: string) =>
  /^(继续|继续生成|接着生成|继续跑|接着跑|续跑|重试|再试一次|继续生成岗位包|继续生成 role_package|continue|retry)$/iu.test(
    text.trim()
  );

const extractSkippedRequirementFields = (text: string, missingKeys: string[]) => {
  if (!/(跳过|不用|不需要|没有|默认|你来补|平台补|先这样|不补了)/u.test(text)) {
    return [];
  }

  const skipped: string[] = [];
  for (const field of requirementFields) {
    if (
      missingKeys.includes(field.key) &&
      new RegExp(`${field.label}|${field.key}|${field.question.slice(0, 4)}`, "u").test(text)
    ) {
      skipped.push(field.key);
    }
  }

  return skipped.length > 0 ? skipped : missingKeys;
};

const analyzeRoleRequirement = (text: string, skippedFields: string[]) => {
  const skipped = new Set(skippedFields);
  const missing = requirementFields.filter((field) => !skipped.has(field.key) && !field.pattern.test(text));
  return {
    missing,
    ready: missing.length === 0,
  };
};

const buildRequirementPrompt = (missing: Array<(typeof requirementFields)[number]>) => {
  const visibleMissing = missing.slice(0, 4);
  return [
    "我先不生成岗位包，还需要把需求补清楚一点。",
    `缺口：${visibleMissing.map((field) => field.label).join("、")}。`,
    `你可以继续一句一句补充，例如：${visibleMissing[0]?.question ?? "补充业务场景和验收标准。"}`,
    "如果某项确实不需要，直接说“跳过这些，开始生成”也可以。",
  ].join("\n");
};

const buildGenerationMessage = (notes: string[], skippedFields: string[]) => {
  const skippedLabels = requirementFields
    .filter((field) => skippedFields.includes(field.key))
    .map((field) => field.label);

  return [
    "以下是开发者逐步补充后的岗位开发规格，请按这些要求生成 role_package。",
    ...notes.map((note, index) => `补充 ${index + 1}: ${note}`),
    skippedLabels.length > 0
      ? `开发者明确跳过或接受默认处理的部分：${skippedLabels.join("、")}。不要因为这些字段未细化而阻断生成，但要在岗位包里写清默认假设和人工确认边界。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const getNavigationTarget = (text: string): NavigationTarget | null => {
  if (/(回到|返回|打开|进入|查看|去|跳到|我要到|我要去|带我到|带我去).*(开发对话|对话)|\b(dialog|chat|home)\b/u.test(text)) {
    return {
      path: "/",
      message: "已回到开发对话。",
    };
  }

  if (/(上传|上架|发布).*(岗位|岗位包|role_package|草稿|商品)|岗位包.*(上传|上架|发布)|\b(upload|create|submit|publish)\b.*\b(role|package|product|draft|listing)\b|\brole[_ -]?package\b.*\b(upload|submit|publish)\b/u.test(text)) {
    return {
      path: "/products/create",
      message:
        "已识别：上传岗位。进入上传岗位页后确认最近岗位包草稿，发布前会停在确认点。",
    };
  }

  if (/(岗位商品|商品|岗位).*(审核|状态|上架|下架|下线|撤下|停用|管理|列表|查看|按钮)|(?:审核|下架|下线|撤下|停用).*(岗位|商品|状态)|上架状态|下架岗位|\b(products?|listings?)\b.*\b(status|review|manage|list|open|view|delist|unpublish)?\b|\b(status|review|delist|unpublish)\b.*\b(products?|listings?)\b/u.test(text)) {
    return {
      path: "/products",
      message: /(下架|下线|撤下|停用|delist|unpublish)/u.test(text)
        ? "已进入岗位商品。找到已上架岗位后，可以在该岗位的操作里执行下架。"
        : "已进入岗位商品，查看草稿、审核和上架状态。",
    };
  }

  if (/(销售|订单|购买).*(记录|查看|列表|状态)?|订单|\b(orders?|sales?)\b/u.test(text)) {
    return {
      path: "/orders",
      message: "已进入销售记录。",
    };
  }

  if (/(结算|分账|应收|收款).*(记录|查看|列表|状态)?|\b(payouts?|settlements?|receivables?)\b/u.test(text)) {
    return {
      path: "/payouts",
      message: "已进入结算记录。",
    };
  }

  if (/(开发者资料|账户资料|个人资料|资料|地址|主体信息|公司信息).*(查看|编辑|补全|打开|进入|管理)?|\b(profile|settings|developer profile|account)\b/u.test(text)) {
    return {
      path: "/settings/profile",
      message: "已进入开发者资料。",
    };
  }

  return null;
};

const RolePackageDraftPanel = ({ draft }: { draft: RolePackageDraftSummary }) => (
  <div className="rounded-md border bg-ui-bg-base p-4">
    <div className="flex items-center justify-between gap-x-3">
      <div>
        <Text className="txt-compact-medium-plus text-ui-fg-base">岗位包草稿</Text>
        <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
          {draft.packageId ?? draft.draftId ?? "未命名草稿"} · {draft.fileCount ?? 0} 个文件
        </Text>
      </div>
      <StatusBadge color={draft.status === "ready" ? "green" : "orange"}>
        {draft.status === "ready" ? "可上传" : "待处理"}
      </StatusBadge>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">质量评分</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {draft.qualityReport?.score ?? 0}
        </Text>
      </div>
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">版本</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {draft.packageVersion ?? "-"}
        </Text>
      </div>
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">阻断项</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {(draft.blockingIssues ?? draft.qualityReport?.blockingIssues ?? []).length}
        </Text>
      </div>
    </div>
  </div>
);

const capabilityStatusColor = (status?: string) => {
  if (status === "bindable" || status === "platform_ready" || status === "approved") {
    return "green" as const;
  }
  if (status === "blocked" || status === "rejected" || status === "disabled") {
    return "red" as const;
  }
  if (status === "waiting_review" || status === "pending_review" || status === "waiting_skill_tool_review") {
    return "orange" as const;
  }
  return "grey" as const;
};

const planStatusLabel = (status?: string) => {
  if (status === "platform_ready") {
    return "平台能力就绪";
  }
  if (status === "waiting_skill_tool_review") {
    return "等待能力审核";
  }
  if (status === "waiting_internal_build") {
    return "等待平台自造";
  }
  if (status === "needs_more_input") {
    return "需要补充信息";
  }
  if (status === "blocked") {
    return "存在阻断";
  }
  return "能力计划";
};

const compactList = (items?: string[], fallback = "-") =>
  items && items.length > 0 ? items.slice(0, 4).join("、") : fallback;

const requestStatus = (request: CatalogReviewRequest) =>
  request.status ?? request.review_status ?? "pending_review";

const insightFromDraft = (draft?: RolePackageDraftSummary | null): RoleGenerationInsight | null => {
  if (!draft) {
    return null;
  }
  const blockedReasons = draft.reviewBlockers ?? draft.blockingIssues ?? [];
  if (!draft.roleRequirementSpec && !draft.roleCapabilityPlan && blockedReasons.length === 0) {
    return null;
  }
  return {
    roleRequirementSpec: draft.roleRequirementSpec,
    roleCapabilityPlan: draft.roleCapabilityPlan,
    catalogReviewRequests: draft.catalogReviewRequests,
    blockedReasons,
  };
};

const insightFromResponse = (response?: RoleGenerationInsight | null): RoleGenerationInsight | null => {
  if (
    !response?.roleRequirementSpec &&
    !response?.roleCapabilityPlan &&
    !(response?.catalogReviewRequests?.length) &&
    !(response?.blockedReasons?.length)
  ) {
    return null;
  }
  return response;
};

const RoleGenerationInsightPanel = ({ insight }: { insight: RoleGenerationInsight }) => {
  const spec = insight.roleRequirementSpec;
  const plan = insight.roleCapabilityPlan;
  const bindings = plan?.catalogBindings ?? [];
  const gaps = plan?.gaps ?? [];
  const reviewRequests = insight.catalogReviewRequests ?? [];
  const blockedReasons = insight.blockedReasons ?? plan?.reviewBlockers ?? [];

  return (
    <div className="rounded-md border bg-ui-bg-base p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Text className="txt-compact-medium-plus text-ui-fg-base">岗位生成闭环</Text>
          <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
            {spec?.roleName ?? "未命名岗位"} · {spec?.businessScenario ?? "业务场景待补全"}
          </Text>
        </div>
        <StatusBadge color={capabilityStatusColor(plan?.status)}>
          {planStatusLabel(plan?.status)}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border px-3 py-3">
          <Text className="txt-compact-small-plus text-ui-fg-base">工作标准</Text>
          <Text className="mt-2 txt-compact-small text-ui-fg-subtle">
            每日：{compactList(spec?.dailyTasks)}
          </Text>
          <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
            验收：{compactList(spec?.acceptanceStandards)}
          </Text>
        </div>
        <div className="rounded-md border px-3 py-3">
          <Text className="txt-compact-small-plus text-ui-fg-base">能力需求</Text>
          <Text className="mt-2 txt-compact-small text-ui-fg-subtle">
            Skill：{compactList(plan?.requiredSkills)}
          </Text>
          <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
            Tool：{compactList(plan?.requiredTools)}
          </Text>
        </div>
      </div>

      {bindings.length > 0 ? (
        <div className="mt-4">
          <Text className="txt-compact-small-plus text-ui-fg-base">平台能力匹配</Text>
          <div className="mt-2 grid gap-2">
            {bindings.slice(0, 5).map((binding) => (
              <div
                key={`${binding.catalogRef ?? binding.need}-${binding.kind ?? "catalog"}`}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <Text className="min-w-0 truncate txt-compact-small text-ui-fg-base">
                  {binding.need ?? binding.catalogRef ?? "未命名能力"}
                </Text>
                <StatusBadge color={capabilityStatusColor(binding.status)}>
                  {binding.status ?? "unknown"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {gaps.length > 0 || reviewRequests.length > 0 ? (
        <div className="mt-4 rounded-md border border-ui-border-warning bg-ui-bg-subtle px-3 py-3">
          <Text className="txt-compact-small-plus text-ui-fg-base">待审核能力</Text>
          {[...gaps.map((gap) => gap.need), ...reviewRequests.map((request) => request.need)]
            .filter(Boolean)
            .slice(0, 6)
            .map((need) => (
              <Text key={need} className="mt-1 txt-compact-small text-ui-fg-subtle">
                {need}
              </Text>
            ))}
          {reviewRequests.slice(0, 4).map((request) => (
            <Text
              key={request.reviewId ?? request.reviewKey ?? request.need}
              className="mt-1 txt-compact-small text-ui-fg-muted"
            >
              {request.kind ?? "capability"} · {requestStatus(request)}
              {request.source ? ` · ${request.source}` : ""}
            </Text>
          ))}
        </div>
      ) : null}

      {blockedReasons.length > 0 ? (
        <div className="mt-4 rounded-md border border-ui-border-error bg-ui-bg-subtle px-3 py-3">
          <Text className="txt-compact-small-plus text-red-600">阻断原因</Text>
          {blockedReasons.slice(0, 4).map((reason) => (
            <Text key={reason} className="mt-1 txt-compact-small text-ui-fg-subtle">
              {reason}
            </Text>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const formatGenerationErrorMessage = (error: unknown) => {
  if (isAbortError(error)) {
    return "AI开发助手已停止当前生成请求，已保存的 partial 草稿会保留。";
  }

  const message =
    error instanceof Error && error.message ? error.message : "请确认本地 OpenClaw 模型桥和草稿存储已配置。";
  const data = (error as Error & { data?: DijieRolePackageGenerationErrorData })?.data;
  const details: string[] = [];

  if (data?.issues?.length) {
    details.push(`阻断项：${data.issues.join("；")}`);
  }

  if (data?.diagnostics?.stageLabel || data?.diagnostics?.stageId) {
    details.push(
      `失败阶段：${data.diagnostics.stageLabel ?? data.diagnostics.stageId ?? "未知阶段"}`
    );
  }

  if (data?.diagnostics?.repairReplyPreview || data?.diagnostics?.replyPreview) {
    details.push(
      `模型摘要：${data.diagnostics.repairReplyPreview ?? data.diagnostics.replyPreview}`
    );
  }

  return `AI开发助手暂时无法生成岗位包：${message}${details.length ? `\n${details.join("\n")}` : ""}`;
};

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "AbortError" || /aborted|abort/i.test(error.message));

const textFromDialogStreamStatus = (data: DialogStreamStatus, fallback: string) =>
  typeof data.message === "string" && data.message.trim() ? data.message.trim() : fallback;

const textFromDialogStreamDelta = (data: DialogStreamStatus) =>
  typeof data.text === "string" ? data.text : "";

export const DeveloperAiPanel = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DeveloperMessage[]>(initialMessages);
  const [running, setRunning] = useState(false);
  const [runningMode, setRunningMode] = useState<"dialog" | "generation" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rolePackageDraft, setRolePackageDraft] = useState<RolePackageDraftSummary | null>(null);
  const [roleGenerationInsight, setRoleGenerationInsight] =
    useState<RoleGenerationInsight | null>(null);
  const [requirementNotes, setRequirementNotes] = useState<string[]>([]);
  const [skippedRequirementFields, setSkippedRequirementFields] = useState<string[]>([]);
  const [activeController, setActiveController] = useState<AbortController | null>(null);
  const abortReasonRef = useRef<"manual" | "timeout" | null>(null);

  useEffect(() => {
    let active = true;
    fetchLatestDijieRolePackageDraftQuery()
      .then((result) => {
        const latestDraft = (result as { draft?: RolePackageDraftSummary | null })?.draft ?? null;
        if (active && latestDraft) {
          setRolePackageDraft(latestDraft);
          setRoleGenerationInsight(insightFromDraft(latestDraft));
          setMessages((current) => [
            ...current,
            {
              id: createMessageId(),
              role: "system",
              text: `已读取最近岗位包草稿：${latestDraft.packageId ?? latestDraft.draftId ?? "未命名草稿"}，${latestDraft.fileCount ?? 0} 个文件。`,
            },
          ]);
        }
      })
      .catch(() => {
        // The assistant can still operate without a previous draft.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!running || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  useEffect(() => {
    if (!running || runningMode !== "generation") {
      return;
    }

    const timer = window.setInterval(() => {
      fetchLatestDijieRolePackageDraftQuery()
        .then((result) => {
          const latestDraft = (result as { draft?: RolePackageDraftSummary | null })?.draft ?? null;
          if (!latestDraft) {
            return;
          }
          setRolePackageDraft((current) =>
            (latestDraft.fileCount ?? 0) >= (current?.fileCount ?? 0) ? latestDraft : current,
          );
          setRoleGenerationInsight((current) => insightFromDraft(latestDraft) ?? current);
        })
        .catch(() => {
          // Generation can keep running even if a progress poll misses once.
        });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [running, runningMode]);

  const stageText = useMemo(() => {
    if (!running) {
      return "待命";
    }
    if (runningMode === "dialog") {
      return "正在理解并生成回答；模型慢时会先显示等待状态。";
    }
    const savedFiles = Math.min(rolePackageDraft?.fileCount ?? 0, ROLE_PACKAGE_REQUIRED_FILE_COUNT);
    const remainingFiles = Math.max(ROLE_PACKAGE_REQUIRED_FILE_COUNT - savedFiles, 0);
    const currentPath = rolePackageOutputPaths[savedFiles] ?? "剩余岗位包文件";
    if (remainingFiles === 0 || rolePackageDraft?.status === "ready") {
      return "岗位包文件已生成完成，正在收尾校验 ready 草稿。";
    }
    if (elapsedSeconds >= 600) {
      return `正在等待模型生成第 ${savedFiles + 1}/${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件：${currentPath}。预计剩余 ${estimateRemainingGenerationTime(remainingFiles)}，已完成 ${savedFiles} 个文件会保留。`;
    }
    if (elapsedSeconds >= 60) {
      return `当前文件较复杂，仍在生成第 ${savedFiles + 1}/${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件：${currentPath}。预计剩余 ${estimateRemainingGenerationTime(remainingFiles)}。`;
    }
    return `正在生成第 ${savedFiles + 1}/${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件：${currentPath}。预计剩余 ${estimateRemainingGenerationTime(remainingFiles)}。`;
  }, [elapsedSeconds, rolePackageDraft, running, runningMode]);

  const appendMessage = (message: Omit<DeveloperMessage, "id">) => {
    const id = createMessageId();
    setMessages((current) => [...current, { id, ...message }]);
    return id;
  };

  const updateMessageText = (messageId: string, text: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, text } : message,
      ),
    );
  };

  const handleCancel = () => {
    abortReasonRef.current = "manual";
    activeController?.abort();
  };

  const runLowRiskAction = (path: string, message: string) => {
    appendMessage({ role: "assistant", text: message });
    navigate(path);
  };

  const runDialogAction = (action: DialogAction) => {
    if (action.kind !== "navigate" || !action.path || action.requiresConfirmation) {
      return false;
    }

    appendMessage({
      role: "assistant",
      text: action.description ? `已执行：${action.label}。${action.description}` : `已执行：${action.label}。`,
    });
    navigate(action.path);
    return true;
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || running) {
      return;
    }

    appendMessage({ role: "user", text });

    const generationIntent = isGenerationIntent(text);
    const shouldResumeRolePackage =
      !!rolePackageDraft &&
      rolePackageDraft.status !== "ready" &&
      rolePackageDraft.status !== "submitted" &&
      isResumeRolePackageGenerationIntent(text);
    const shouldGenerateRolePackage =
      shouldResumeRolePackage || isRolePackageDevelopmentSpec(text);
    const navigationTarget = generationIntent ? null : getNavigationTarget(text);
    const requirementContinuation = isRequirementContinuation(text, requirementNotes.length > 0);

    if (
      shouldGenerateRolePackage ||
      requirementContinuation ||
      (generationIntent && !navigationTarget)
    ) {
      const nextNotes = shouldResumeRolePackage
        ? requirementNotes
        : [...requirementNotes, text];
      const currentRequirementText = nextNotes.join("\n");
      const initialAnalysis = analyzeRoleRequirement(
        currentRequirementText,
        skippedRequirementFields
      );
      const proceedDespiteMissing =
        shouldResumeRolePackage || shouldProceedWithIncompleteRequirements(text);
      const nextSkippedFields = [
        ...new Set([
          ...skippedRequirementFields,
          ...(proceedDespiteMissing
            ? extractSkippedRequirementFields(
                text,
                initialAnalysis.missing.map((field) => field.key)
              )
            : []),
        ]),
      ];
      const analysis = analyzeRoleRequirement(currentRequirementText, nextSkippedFields);

      setRequirementNotes(nextNotes);
      setSkippedRequirementFields(nextSkippedFields);

      if (!shouldResumeRolePackage && !analysis.ready && !proceedDespiteMissing) {
        appendMessage({
          role: "assistant",
          text: buildRequirementPrompt(analysis.missing),
        });
        setDraft("");
        return;
      }

      const generationMessage = shouldResumeRolePackage
        ? rolePackageDraft.sourceMessage?.trim() ||
          buildGenerationMessage(
            nextNotes.length > 0
              ? nextNotes
              : [
                  "继续生成已有 partial role_package 草稿。请依据已有草稿摘要和已生成文件，补全下一个缺失文件。",
                ],
            nextSkippedFields
          )
        : buildGenerationMessage(nextNotes, nextSkippedFields);
      const shouldStartNewDraft = rolePackageDraft?.status === "ready" && isRequirementChangeIntent(text);
      const controller = new AbortController();
      setActiveController(controller);
      setRunning(true);
      setRunningMode("generation");
      setStartedAt(Date.now());
      const startingFileCount = shouldStartNewDraft ? 0 : (rolePackageDraft?.fileCount ?? 0);
      const estimatedRemainingFiles = Math.max(ROLE_PACKAGE_REQUIRED_FILE_COUNT - startingFileCount, 1);
      appendMessage({
        role: "assistant",
        text: shouldStartNewDraft
          ? `已收到新增需求，将基于新的完整规格重新生成一个 role_package 草稿。本轮会逐个生成 ${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件，预计 ${estimateRemainingGenerationTime(ROLE_PACKAGE_REQUIRED_FILE_COUNT)}；耗时长是正常的，完成一个文件就保存一次。`
          : shouldResumeRolePackage
            ? `继续生成已有 partial 岗位包草稿，本轮会逐个生成剩余 ${estimatedRemainingFiles} 个文件，预计 ${estimateRemainingGenerationTime(estimatedRemainingFiles)}；耗时长是正常的，完成一个文件就保存一次。`
            : `已收到岗位开发规格，本轮会逐个生成剩余 ${estimatedRemainingFiles} 个文件，预计 ${estimateRemainingGenerationTime(estimatedRemainingFiles)}；耗时长是正常的，完成一个文件就保存一次，全部校验通过后才变成可上传 ready。`,
      });
      try {
        let currentDraft: RolePackageDraftSummary | null =
          rolePackageDraft?.status === "submitted" || shouldStartNewDraft ? null : rolePackageDraft;
        let completedDraft: RolePackageDraftSummary | null = null;
        let startNewConsumed = false;

        for (let step = 0; step < ROLE_PACKAGE_STAGES_PER_SUBMIT; step += 1) {
          if (controller.signal.aborted) {
            break;
          }
          const previousFileCount = currentDraft?.fileCount ?? 0;
          const result = await generateDijieRolePackageDraftQuery(generationMessage, {
            draftId: currentDraft?.draftId,
            maxStages: 1,
            signal: controller.signal,
            startNew: shouldStartNewDraft && !currentDraft?.draftId && !startNewConsumed,
          }) as {
          draft?: RolePackageDraftSummary;
            complete?: boolean;
            roleRequirementSpec?: RoleRequirementSpec;
            roleCapabilityPlan?: RoleCapabilityPlan;
            catalogReviewRequests?: CatalogReviewRequest[];
            blockedReasons?: string[];
          };
          setRoleGenerationInsight(
            (current) => insightFromResponse(result) ?? insightFromDraft(result.draft) ?? current,
          );
          startNewConsumed = true;
          const generatedDraft = result.draft ?? currentDraft;
          if (generatedDraft) {
            currentDraft = generatedDraft;
            setRolePackageDraft(generatedDraft);
            appendMessage({
              role: "system",
              text: `已保存阶段草稿：${generatedDraft.fileCount ?? 0}/${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件，状态 ${generatedDraft.status ?? "partial"}；预计剩余 ${estimateRemainingGenerationTime(Math.max(ROLE_PACKAGE_REQUIRED_FILE_COUNT - (generatedDraft.fileCount ?? 0), 0))}。`,
            });
          }

          if (result.complete || generatedDraft?.status === "ready") {
            completedDraft = generatedDraft ?? null;
            break;
          }

          if ((generatedDraft?.fileCount ?? previousFileCount) <= previousFileCount) {
            appendMessage({
              role: "assistant",
              text: "当前阶段没有新增可保存文件，已暂停自动继续。你可以查看失败提示后发送“继续生成”重试当前文件。",
            });
            break;
          }
        }

        const generatedDraft = completedDraft ?? currentDraft;
        setRolePackageDraft(generatedDraft ?? null);
        setRoleGenerationInsight((current) => current ?? insightFromDraft(generatedDraft));
        appendMessage({
          role: "assistant",
          text:
            generatedDraft?.status === "ready"
              ? `已生成 ready 岗位包草稿，包含 ${generatedDraft.fileCount ?? 0} 个文件，质量评分 ${generatedDraft.qualityReport?.score ?? 0}。可以去上传岗位页承接。`
              : generatedDraft
                ? `已保存 partial 岗位包草稿，包含 ${generatedDraft.fileCount ?? 0} 个文件；发送“继续生成”可以从未完成文件接着生成。`
                : "本次没有形成可保存的岗位包草稿，请补充岗位规格后重试。",
        });
      } catch (error) {
        const partialDraft = (error as Error & { data?: DijieRolePackageGenerationErrorData })?.data?.draft;
        const errorInsight = insightFromResponse(
          (error as Error & { data?: DijieRolePackageGenerationErrorData })?.data,
        );
        if (partialDraft) {
          setRolePackageDraft(partialDraft);
        }
        setRoleGenerationInsight(errorInsight ?? insightFromDraft(partialDraft));
        const abortReason = abortReasonRef.current;
        appendMessage({
          role: "assistant",
          text: isAbortError(error)
            ? abortReason === "manual"
              ? "已停止当前生成请求；已保存的 partial 草稿会保留，可以发送“继续生成”接着跑。"
              : "当前生成请求被浏览器或网络中断；已保存的 partial 草稿会保留，可以发送“继续生成”接着跑。"
            : `${formatGenerationErrorMessage(error)}${
                partialDraft
                  ? `\n已保留 partial 草稿：${partialDraft.fileCount ?? 0}/${ROLE_PACKAGE_REQUIRED_FILE_COUNT} 个文件。你可以继续生成未完成阶段。`
                  : ""
              }`,
        });
      } finally {
        abortReasonRef.current = null;
        setActiveController(null);
        setRunning(false);
        setRunningMode(null);
        setStartedAt(null);
        setDraft("");
      }
      return;
    }

    const controller = new AbortController();
    setActiveController(controller);
    setRunning(true);
    setRunningMode("dialog");
    setStartedAt(Date.now());
    const assistantMessageId = appendMessage({
      role: "assistant",
      text: "我在理解你的意思，会先保持对话不断线。",
    });
    try {
      let result: DialogResponse | undefined;
      let streamedText = "";

      try {
        result = (await streamDijieDeveloperDialogMessageQuery(
          text,
          {
            onStatus: (data) => {
              if (streamedText) {
                return;
              }
              updateMessageText(
                assistantMessageId,
                textFromDialogStreamStatus(data, "我在理解你的意思，会先保持对话不断线。"),
              );
            },
            onFallback: (data) => {
              if (streamedText) {
                return;
              }
              updateMessageText(
                assistantMessageId,
                textFromDialogStreamStatus(
                  data,
                  "这个问题需要稍微分析，我会继续等模型完成，不让对话卡死。",
                ),
              );
            },
            onDelta: (data) => {
              const delta = textFromDialogStreamDelta(data);
              if (!delta) {
                return;
              }
              streamedText += delta;
              updateMessageText(assistantMessageId, streamedText);
            },
          },
          controller.signal,
        )) as DialogResponse | undefined;
      } catch (streamError) {
        if (isAbortError(streamError)) {
          throw streamError;
        }
        updateMessageText(assistantMessageId, "流式通道暂不可用，我切回兼容模式继续回答。");
        const timeoutId = window.setTimeout(() => {
          abortReasonRef.current = "timeout";
          controller.abort();
        }, DIALOG_REQUEST_TIMEOUT_MS);
        try {
          result = (await sendDijieDeveloperDialogMessageQuery(text, controller.signal)) as DialogResponse;
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      updateMessageText(
        assistantMessageId,
        result?.message?.content ??
          "已记录。低风险导航可以直接执行；发布、改价、结算确认会等待你确认。",
      );
      const lowRiskAction = result?.actions?.find(
        (item) => item.kind === "navigate" && item.path && !item.requiresConfirmation,
      );
      if (lowRiskAction) {
        runDialogAction(lowRiskAction);
      } else if (navigationTarget) {
        runLowRiskAction(navigationTarget.path, navigationTarget.message);
      }
      setRoleGenerationInsight(insightFromResponse(result) ?? roleGenerationInsight);
    } catch (error) {
      if (navigationTarget) {
        updateMessageText(assistantMessageId, navigationTarget.message);
        navigate(navigationTarget.path);
      } else {
        updateMessageText(
          assistantMessageId,
          isAbortError(error)
            ? abortReasonRef.current === "timeout"
              ? `开发助手等待模型超过 ${Math.floor(DIALOG_REQUEST_TIMEOUT_MS / 1000)} 秒，已停止本次回答。`
              : "已停止当前开发助手回答。"
            : `开发助手暂时无法调用模型：${
                error instanceof Error && error.message ? error.message : "请稍后重试。"
              }`,
        );
      }
    } finally {
      abortReasonRef.current = null;
      setActiveController(null);
      setRunning(false);
      setRunningMode(null);
      setStartedAt(null);
    }

    setDraft("");
  };

  return (
    <Container
      className={[
        "grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0",
        compact ? "h-[620px]" : "h-full min-h-0",
      ].join(" ")}
    >
      <div className="border-b px-6 py-4">
        <Heading level="h2">开发对话</Heading>
        <Text className="mt-2 text-ui-fg-subtle">讲业务逻辑，发布前停在确认点</Text>
      </div>
      <div className="grid min-h-0 content-start gap-y-4 overflow-y-auto p-6" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "max-w-[640px] rounded-md border px-4 py-3",
              message.role === "user"
                ? "ml-auto border-ui-border-interactive bg-ui-bg-interactive"
                : message.role === "system"
                  ? "bg-ui-bg-base"
                  : "bg-ui-bg-subtle",
            ].join(" ")}
          >
            <Text className="whitespace-pre-wrap text-ui-fg-base">{message.text}</Text>
          </div>
        ))}
        {rolePackageDraft ? <RolePackageDraftPanel draft={rolePackageDraft} /> : null}
        {roleGenerationInsight ? (
          <RoleGenerationInsightPanel insight={roleGenerationInsight} />
        ) : null}
      </div>
      <div className="grid gap-y-3 border-t p-4">
        <div className="flex items-center justify-between rounded-md border bg-ui-bg-subtle px-4 py-3">
          <Text className="txt-compact-small-plus text-ui-fg-base">{stageText}</Text>
          <StatusBadge color={running ? "orange" : "grey"}>
            {running ? formatElapsed(elapsedSeconds) : "待命"}
          </StatusBadge>
        </div>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入：上传刚生成的岗位包 / 去岗位商品看审核状态 / 查看结算 / 回到开发对话；或输入岗位开发规格"
          rows={compact ? 3 : 4}
          disabled={running}
        />
        <div className="flex items-center justify-between gap-x-3">
          <Text className="txt-compact-small text-ui-fg-subtle">
            {running
              ? runningMode === "dialog"
                ? "普通对话会先保持连接，模型完成后补全回答；可停止。"
                : "岗位包生成是长任务，可能需要十几到二十多分钟；完成一个文件就保存一次，可停止后继续。"
              : "长规格会作为岗位包生成输入，不会只做关键词导航。"}
          </Text>
          <Button
            size="small"
            type="button"
            variant={running ? "secondary" : "primary"}
            onClick={running ? handleCancel : handleSubmit}
            disabled={running ? !activeController : !draft.trim()}
          >
            {running ? "停止" : "发送"}
          </Button>
        </div>
      </div>
    </Container>
  );
};

export const DeveloperAiAssistantDock = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/" || location.pathname === "") {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-y-3">
      {open ? (
        <div className="shadow-elevation-flyout w-[520px] max-w-[calc(100vw-40px)] overflow-hidden rounded-lg border bg-ui-bg-base">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <Text className="txt-compact-medium-plus text-ui-fg-base">AI 开发助手</Text>
              <Text className="txt-compact-small text-ui-fg-subtle">当前页面可直接生成岗位包或导航</Text>
            </div>
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              aria-label="关闭 AI 开发助手"
              onClick={() => setOpen(false)}
            >
              <XMark />
            </IconButton>
          </div>
          <DeveloperAiPanel compact />
        </div>
      ) : null}
      <Button
        type="button"
        size="small"
        variant="primary"
        onClick={() => setOpen((value) => !value)}
      >
        <ChatBubbleLeftRight />
        AI 开发助手
      </Button>
    </div>
  );
};
