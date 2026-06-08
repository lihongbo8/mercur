import { useEffect, useMemo, useRef, useState } from "react";
import { fetchQuery } from "../../lib/client";
import {
  fetchReviewCenter,
  finalizeReview as finalizeReviewRequest,
  saveReviewEvaluations,
  type EvaluationDecision,
  type EvaluationKey,
  type ReviewCheckItem,
  type ReviewPackageSummary,
  type ReviewPricingSummary,
  type ReviewQueueItem as ReviewCenterQueueItem,
  type RoleStatus,
} from "../../lib/dijie/review-center";

type WorkbenchTab = "review" | "records" | "settings";
type FinalReviewStatus = Exclude<RoleStatus, "pending">;
type AssistantAuthor = "审核人员" | "AI助手";

type EvaluationDefinition = {
  key: EvaluationKey;
  title: string;
  description: string;
  rows: Array<{ label: string; note: string }>;
};

type RoleReviewItem = {
  id: string;
  reviewId: string;
  title: string;
  developer: string;
  usageInstructions: string;
  submitted: string;
  status: RoleStatus;
  statusNote: string;
  price: string;
  confirmations: number;
  version: string;
  category: string;
  riskLabel?: string;
  summary: string;
  listingStatus: string;
  packageSummary?: ReviewPackageSummary;
  capabilityChecks: ReviewCheckItem[];
  safetyChecks: ReviewCheckItem[];
  pricingSummary?: ReviewPricingSummary;
  specialtyChecks: ReviewCheckItem[];
  allowedActions: string[];
  statusReason: string;
  evaluations: Record<EvaluationKey, EvaluationDecision>;
  records: string[];
  finalNote: string;
};

type AssistantMessage = {
  id: number;
  author: AssistantAuthor;
  body: string;
};

type DialogMessageResponse = {
  message?: {
    content?: string;
  };
  modelCalled?: boolean;
  actions?: DialogAction[];
};

type DialogAction = {
  id: string;
  label: string;
  description?: string;
  requiresConfirmation?: boolean;
};

const formatSubmittedAt = (value?: string | null) => {
  if (!value) {
    return "未提交";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未提交";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const roleStatusFromQueueItem = (item: ReviewCenterQueueItem): RoleStatus => {
  if (item.reviewState === "approved") {
    return "approved";
  }
  if (item.reviewState === "needs_changes") {
    return "needs_changes";
  }
  if (item.reviewState === "rejected") {
    return "rejected";
  }
  return "pending";
};

const mapReviewQueueItem = (item: ReviewCenterQueueItem): RoleReviewItem => {
  const status = roleStatusFromQueueItem(item);
  const statusLabel = item.reviewStateLabel || statusLabels[status];
  const statusReason = item.statusReason || statusLabel;
  const riskLabel = statusReason !== statusLabel ? statusReason : undefined;
  const capabilities = item.requiredCapabilities ?? [];
  return {
    id: item.id,
    reviewId: item.reviewId || `review_${item.id}`,
    title: item.title,
    developer: item.developerName || "云端开发者",
    usageInstructions: item.usageInstructions || "",
    submitted: formatSubmittedAt(item.submittedAt),
    status,
    statusNote: statusLabel,
    price: item.priceLabel || "云端配置",
    confirmations: item.confirmationPoints ?? 0,
    version: item.packageVersion ? `v${item.packageVersion}` : "-",
    category: item.subtitle || item.packageId || "未分类",
    summary:
      capabilities.length > 0
        ? `需要 ${capabilities.join("、")} 等能力。`
        : "云端岗位商品，等待人工审核。",
    listingStatus: item.listingStatus || "unknown",
    packageSummary: item.packageSummary,
    capabilityChecks: item.capabilityChecks ?? [],
    safetyChecks: item.safetyChecks ?? [],
    pricingSummary: item.pricingSummary,
    specialtyChecks: item.specialtyChecks ?? [],
    allowedActions: item.allowedActions ?? [],
    statusReason,
    riskLabel,
    evaluations: item.evaluations ?? {
      roleStandard: "pending",
      safetyCompliance: "pending",
      pricingReasonability: "pending",
    },
    records:
      item.records && item.records.length > 0
        ? item.records
        : ["云端岗位商品已进入审核队列。"],
    finalNote: item.finalNote || "",
  };
};

const navigationItems: Array<{ id: WorkbenchTab; label: string }> = [
  { id: "review", label: "岗位审核" },
  { id: "records", label: "审核记录" },
  { id: "settings", label: "审核设置" },
];

const evaluationDefinitions: EvaluationDefinition[] = [
  {
    key: "roleStandard",
    title: "岗位标准评估",
    description: "确认岗位是否能作为清晰、可用、可评估的岗位商品上架。",
    rows: [
      { label: "岗位介绍", note: "说明岗位用途、适用场景和交付结果。" },
      { label: "能力边界", note: "说明能做什么、不能做什么。" },
      { label: "使用规范", note: "说明使用者要准备哪些资料、如何发起任务。" },
      { label: "输入输出", note: "输入材料和输出格式清楚。" },
      { label: "生成结果可评估", note: "提供样例或质量判断标准。" },
      { label: "确认点", note: "高风险步骤有人工确认。" },
    ],
  },
  {
    key: "safetyCompliance",
    title: "安全合规评估",
    description: "评估违法违规、权限越界、敏感信息和审计风险。",
    rows: [
      { label: "违法违规风险", note: "不引导违规、欺骗、侵权或绕过平台规则。" },
      { label: "权限边界", note: "只请求岗位运行需要的最小权限。" },
      { label: "敏感数据", note: "避免读取或输出不必要的敏感信息。" },
      {
        label: "本地路径/密钥",
        note: "不暴露本地路径、账号、密钥或内部环境。",
      },
      { label: "审计回读", note: "关键执行结果可脱敏回读。" },
    ],
  },
  {
    key: "pricingReasonability",
    title: "定价合理性评估",
    description: "确认授权费、平台执行费用口径和开发者收益说明合理透明。",
    rows: [
      { label: "授权费", note: "价格与岗位价值、复杂度匹配。" },
      { label: "平台执行费用口径", note: "执行成本口径清楚，避免隐藏费用。" },
      { label: "开发者收益", note: "收益归集和结算说明明确。" },
      { label: "隐藏收费风险", note: "不把额外收费藏在说明之外。" },
      { label: "价格与价值", note: "使用者能判断购买是否值得。" },
    ],
  },
];

const statusLabels: Record<RoleStatus, string> = {
  pending: "待审核",
  needs_changes: "要求补充",
  approved: "已通过",
  rejected: "已驳回",
};

const decisionLabels: Record<EvaluationDecision, string> = {
  pending: "待确认",
  pass: "通过",
  needs_changes: "要求补充",
  reject: "驳回",
};

const statusTextColor: Record<RoleStatus, string> = {
  pending: "text-orange-500",
  needs_changes: "text-orange-600",
  approved: "text-green-600",
  rejected: "text-red-500",
};

const decisionTextColor: Record<EvaluationDecision, string> = {
  pending: "text-ui-fg-muted",
  pass: "text-green-600",
  needs_changes: "text-orange-600",
  reject: "text-red-500",
};

const checkTextColor: Record<ReviewCheckItem["status"], string> = {
  pass: "text-green-600",
  warning: "text-orange-600",
  blocked: "text-red-600",
};

const checkLabels: Record<ReviewCheckItem["status"], string> = {
  pass: "通过",
  warning: "需复核",
  blocked: "阻断",
};

const appendRecord = (role: RoleReviewItem, label: string): RoleReviewItem => ({
  ...role,
  records: [...role.records, label],
});

const createAssistantReply = (action: string, role: RoleReviewItem) => {
  if (action === "总结岗位") {
    return `${role.title} 主要用于${role.summary} 建议重点核对生成结果样例、确认点和定价说明。`;
  }
  if (action === "查缺失") {
    return "建议先确认岗位标准里的生成结果是否可评估；如果缺少样例，最终动作优先选择要求补充。";
  }
  if (action === "评估安全") {
    return "当前安全检查应重点看权限边界、敏感数据处理和审计回读；AI 建议只作为参考，仍需人工确认。";
  }
  if (action === "评估定价") {
    return `当前授权费为 ${role.price}，请确认平台执行费用口径、开发者收益和隐藏收费风险是否说明清楚。`;
  }
  if (action === "起草补充") {
    return "补充建议：请开发者补充生成结果样例、适用边界、失败场景和费用说明后再提交审核。";
  }
  return "驳回草稿：当前岗位缺少必要的评估依据或存在不可接受风险，暂不适合上架。";
};

const createAssistantQuestionReply = (
  question: string,
  role: RoleReviewItem,
) => {
  if (
    question.includes("安全") ||
    question.includes("合规") ||
    question.includes("风险")
  ) {
    return `针对「${role.title}」，建议先看安全合规评估：权限边界、敏感数据、本地路径/密钥和审计回读。AI 只能提示风险点，是否通过仍由审核人员确认。`;
  }
  if (
    question.includes("价格") ||
    question.includes("定价") ||
    question.includes("费用") ||
    question.includes("计费")
  ) {
    return `针对「${role.title}」，当前授权费是 ${role.price}。建议核对授权费、平台执行费用口径、开发者收益和隐藏收费风险；价格不清楚时应选择要求补充。`;
  }
  if (
    question.includes("标准") ||
    question.includes("产出") ||
    question.includes("结果") ||
    question.includes("质量")
  ) {
    return `针对「${role.title}」，岗位标准要看介绍是否清楚、能力边界是否明确、输入输出是否可验证、生成结果是否能被人工评估。`;
  }
  if (question.includes("补充")) {
    return `可以要求开发者补充「${role.title}」的生成结果样例、失败场景、确认点说明和费用口径，再重新进入审核。`;
  }
  if (question.includes("驳回")) {
    return `如果「${role.title}」存在不可接受的安全风险、产出无法评估或定价明显不透明，可以起草驳回；请在最终意见里写清楚具体原因。`;
  }
  return `已收到。当前审核对象是「${role.title}」，建议按岗位标准、安全合规、定价合理性三项逐项判断；AI 回复只做辅助，不会自动改变审核结果。`;
};

const formatAssistantResult = (
  result: DialogMessageResponse | undefined,
  fallback: string,
) => {
  const base = result?.message?.content?.trim() || fallback;
  const actions = result?.actions ?? [];

  if (actions.length === 0) {
    return base;
  }

  const actionText = actions
    .map((action) => {
      const suffix = action.requiresConfirmation ? "，需人工确认" : "";
      return `- ${action.label}${suffix}${action.description ? `：${action.description}` : ""}`;
    })
    .join("\n");

  return `${base}\n\n建议动作：\n${actionText}`;
};

export const ReviewCenterWorkbench = () => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("review");
  const [roles, setRoles] = useState<RoleReviewItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [statusFilter, setStatusFilter] = useState<RoleStatus | "all">("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [reviewCenterLoading, setReviewCenterLoading] = useState(true);
  const [reviewCenterError, setReviewCenterError] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([
    {
      id: 1,
      author: "AI助手",
      body: "我可以帮你总结岗位、查缺失、评估安全和定价，并起草补充或驳回意见。",
    },
  ]);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantRunning, setAssistantRunning] = useState(false);
  const [finalNoteDraft, setFinalNoteDraft] = useState("");

  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  const refreshReviewCenter = async () => {
    setReviewCenterLoading(true);
    setReviewCenterError("");
    try {
      const result = await fetchReviewCenter();
      const mappedRoles = result?.queue?.map(mapReviewQueueItem) ?? [];
      setRoles(mappedRoles);
      setSelectedRoleId((current) => {
        if (mappedRoles.some((role) => role.id === current)) {
          return current;
        }
        return mappedRoles[0]?.id ?? "";
      });
    } catch (error) {
      setReviewCenterError(
        error instanceof Error ? error.message : "云端审核中心暂时无法读取。",
      );
      setRoles([]);
      setSelectedRoleId("");
    } finally {
      setReviewCenterLoading(false);
    }
  };

  useEffect(() => {
    void refreshReviewCenter();
  }, []);

  const filteredRoles = useMemo(() => {
    const normalizedSearch = queueSearch.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesStatus =
        statusFilter === "all" || role.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [
        role.title,
        role.developer,
        role.category,
        role.summary,
        role.price,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [queueSearch, roles, statusFilter]);

  const statusSummary = useMemo(
    () => ({
      pending: roles.filter((role) => role.status === "pending").length,
      needsChanges: roles.filter((role) => role.status === "needs_changes")
        .length,
      approved: roles.filter((role) => role.status === "approved").length,
    }),
    [roles],
  );

  const allEvaluationsPass = selectedRole
    ? evaluationDefinitions.every(
        (definition) => selectedRole.evaluations[definition.key] === "pass",
      ) && selectedRole.allowedActions.includes("finalize_approved")
    : false;
  const hasNeedsChanges = selectedRole
    ? evaluationDefinitions.some(
        (definition) =>
          selectedRole.evaluations[definition.key] === "needs_changes",
      ) && selectedRole.allowedActions.includes("finalize_needs_changes")
    : false;
  const hasReject = selectedRole
    ? evaluationDefinitions.some(
        (definition) => selectedRole.evaluations[definition.key] === "reject",
      ) && selectedRole.allowedActions.includes("finalize_rejected")
    : false;

  const updateSelectedRole = (
    updater: (role: RoleReviewItem) => RoleReviewItem,
  ) => {
    if (!selectedRole) {
      return;
    }
    setRoles((current) =>
      current.map((role) =>
        role.id === selectedRole.id ? updater(role) : role,
      ),
    );
  };

  const selectEvaluation = async (
    key: EvaluationKey,
    decision: EvaluationDecision,
  ) => {
    if (!selectedRole) {
      return;
    }
    const nextEvaluations = {
      ...selectedRole.evaluations,
      [key]: decision,
    };
    try {
      await saveReviewEvaluations(selectedRole.reviewId, {
        roleStandardDecision: nextEvaluations.roleStandard,
        safetyComplianceDecision: nextEvaluations.safetyCompliance,
        pricingReasonabilityDecision: nextEvaluations.pricingReasonability,
        summary: finalNoteDraft.trim() || undefined,
      });
      await refreshReviewCenter();
    } catch (error) {
      updateSelectedRole((role) =>
        appendRecord(
          role,
          error instanceof Error
            ? `云端保存评估失败：${error.message}`
            : "云端保存评估失败。",
        ),
      );
    }
  };

  const appendAssistantMessage = (message: AssistantMessage) => {
    setAssistantMessages((current) => [...current, message]);
  };

  const callReviewAssistant = async (message: string) => {
    if (!selectedRole) {
      return undefined;
    }
    const result = (await fetchQuery("/admin/dijie/dialog/messages", {
      method: "POST",
      body: {
        surface: "admin_review",
        message,
        subject: {
          roleListingId: selectedRole.id,
          reviewId: selectedRole.reviewId,
          title: selectedRole.title,
          developer: selectedRole.developer,
          category: selectedRole.category,
          summary: selectedRole.summary,
          status: selectedRole.status,
          price: selectedRole.price,
          confirmations: selectedRole.confirmations,
          usageInstructions: selectedRole.usageInstructions,
          evaluations: selectedRole.evaluations,
        },
      },
    })) as DialogMessageResponse | undefined;

    return result;
  };

  const runAssistantAction = async (action: string) => {
    if (assistantRunning || !selectedRole) {
      return;
    }
    setAssistantRunning(true);
    const fallback = createAssistantReply(action, selectedRole);
    let body = fallback;
    try {
      body = formatAssistantResult(
        await callReviewAssistant(
          `审核动作：${action}。请基于当前岗位审核对象给出辅助意见，不要自动给最终审核结论。`,
        ),
        fallback,
      );
    } catch {
      body = `${fallback}\n\n（云端模型暂不可用，已使用本地审核规则提示。）`;
    }
    appendAssistantMessage({
      id: Date.now(),
      author: "AI助手",
      body,
    });
    updateSelectedRole((role) =>
      appendRecord(role, `AI审核助手执行：${action}。`),
    );
    setAssistantRunning(false);
  };

  const sendAssistantMessage = async () => {
    const body = assistantDraft.trim();
    if (!body || assistantRunning || !selectedRole) {
      return;
    }
    const baseId = Date.now();
    setAssistantMessages((current) => [
      ...current,
      { id: baseId, author: "审核人员", body },
    ]);
    updateSelectedRole((role) =>
      appendRecord(role, `审核人员向AI提问：${body}`),
    );
    setAssistantDraft("");
    setAssistantRunning(true);

    const fallback = createAssistantQuestionReply(body, selectedRole);
    let assistantBody = fallback;
    try {
      assistantBody = formatAssistantResult(
        await callReviewAssistant(body),
        fallback,
      );
    } catch {
      assistantBody = `${fallback}\n\n（云端模型暂不可用，已使用本地审核规则提示。）`;
    }
    appendAssistantMessage({
      id: baseId + 1,
      author: "AI助手",
      body: assistantBody,
    });
    setAssistantRunning(false);
  };

  const finalizeReview = async (status: FinalReviewStatus) => {
    if (!selectedRole) {
      return;
    }
    const note = finalNoteDraft.trim();
    try {
      await finalizeReviewRequest(selectedRole.reviewId, {
        finalResult: status,
        summary: note || undefined,
      });
      await refreshReviewCenter();
    } catch (error) {
      updateSelectedRole((role) =>
        appendRecord(
          role,
          error instanceof Error
            ? `云端最终审核失败：${error.message}`
            : "云端最终审核失败。",
        ),
      );
    }
  };

  const renderMainPanel = () => {
    if (reviewCenterLoading) {
      return <ReviewCenterState message="正在读取云端审核队列..." />;
    }
    if (reviewCenterError) {
      return <ReviewCenterState tone="error" message={reviewCenterError} />;
    }
    if (!selectedRole) {
      return <ReviewCenterState message="暂无云端岗位审核提交。" />;
    }
    if (activeTab === "records") {
      return <RecordsPanel roles={roles} selectedRole={selectedRole} />;
    }
    if (activeTab === "settings") {
      return <SettingsPanel />;
    }
    return (
      <>
        <ReviewQueue
          roles={filteredRoles}
          searchValue={queueSearch}
          selectedRoleId={selectedRole.id}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          onSearchChange={setQueueSearch}
          onSelectRole={(roleId) => {
            setSelectedRoleId(roleId);
            setFinalNoteDraft("");
          }}
        />
        <section
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base"
          style={{ minHeight: 780 }}
        >
          <RoleHeader role={selectedRole} />
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5">
            <RoleReviewFacts role={selectedRole} />
            {evaluationDefinitions.map((definition) => (
              <EvaluationSection
                key={definition.key}
                definition={definition}
                decision={selectedRole.evaluations[definition.key]}
                onDecision={(decision) =>
                  selectEvaluation(definition.key, decision)
                }
              />
            ))}
          </div>
          <FinalActionBar
            note={finalNoteDraft}
            canApprove={allEvaluationsPass}
            canRequestChanges={hasNeedsChanges}
            canReject={hasReject}
            onNoteChange={setFinalNoteDraft}
            onFinalize={finalizeReview}
          />
        </section>
        <aside className="grid min-w-0 gap-4">
          <AssistantPanel
            messages={assistantMessages}
            draft={assistantDraft}
            running={assistantRunning}
            onDraftChange={setAssistantDraft}
            onSend={sendAssistantMessage}
            onAction={runAssistantAction}
          />
          <StatusPanel role={selectedRole} />
        </aside>
      </>
    );
  };

  return (
    <div className="overflow-hidden bg-ui-bg-subtle" style={{ minHeight: 820 }}>
      <main className="min-w-0 px-6">
        <div className="border-b py-4">
          <div className="flex min-h-10 items-center justify-between gap-4">
            <div className="flex items-center gap-x-3 txt-compact-small-plus">
              <span className="text-ui-fg-muted">迭界AI</span>
              <span className="text-ui-fg-muted">›</span>
              <span className="text-ui-fg-muted">审核中心</span>
              <span className="text-ui-fg-muted">›</span>
              <span className="text-ui-fg-interactive">
                {navigationItems.find((item) => item.id === activeTab)?.label}
              </span>
            </div>
            <div className="flex items-center gap-x-3">
              <StatusPill label={`待审核 ${statusSummary.pending}`} />
              <StatusPill label={`要求补充 ${statusSummary.needsChanges}`} />
              <StatusPill label="人工审核" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                className={`h-9 rounded-md border px-4 txt-compact-small-plus ${
                  activeTab === item.id
                    ? "bg-ui-fg-base text-ui-bg-base"
                    : "bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-subtle"
                }`}
                type="button"
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="grid gap-5 py-5"
          style={{
            gridTemplateColumns:
              activeTab === "review"
                ? "280px minmax(460px, 1fr) minmax(280px, 340px)"
                : "minmax(0, 1fr)",
          }}
        >
          {renderMainPanel()}
        </div>
      </main>
    </div>
  );
};

const ReviewCenterState = ({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) => (
  <section className="col-span-full rounded-lg border bg-ui-bg-base px-6 py-10 text-center shadow-borders-base">
    <h2 className="txt-large-plus text-ui-fg-base">云端审核中心</h2>
    <p
      className={`mt-2 txt-compact-small ${
        tone === "error" ? "text-red-600" : "text-ui-fg-subtle"
      }`}
    >
      {message}
    </p>
  </section>
);

const ReviewQueue = ({
  roles,
  searchValue,
  selectedRoleId,
  statusFilter,
  onFilterChange,
  onSearchChange,
  onSelectRole,
}: {
  roles: RoleReviewItem[];
  searchValue: string;
  selectedRoleId: string;
  statusFilter: RoleStatus | "all";
  onFilterChange: (filter: RoleStatus | "all") => void;
  onSearchChange: (value: string) => void;
  onSelectRole: (roleId: string) => void;
}) => (
  <section className="overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
    <div className="border-b px-4 py-4">
      <h2 className="txt-large-plus text-ui-fg-base">待审核列表</h2>
      <input
        className="mt-4 h-10 w-full rounded-lg border bg-ui-bg-base px-3 txt-compact-small outline-none placeholder:text-ui-fg-muted"
        placeholder="搜索岗位或开发者"
        type="text"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["all", "全部"],
          ["pending", "待审核"],
          ["needs_changes", "要求补充"],
          ["rejected", "已驳回"],
          ["approved", "已通过"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`rounded-md border px-3 py-1.5 txt-compact-small-plus ${
              statusFilter === id
                ? "bg-ui-fg-base text-ui-bg-base"
                : "bg-ui-bg-base text-ui-fg-base"
            }`}
            type="button"
            onClick={() => onFilterChange(id as RoleStatus | "all")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
    <div className="divide-y">
      {roles.map((role) => (
        <button
          key={role.id}
          className={`block w-full px-4 py-4 text-left ${
            role.id === selectedRoleId
              ? "bg-ui-bg-subtle"
              : "bg-ui-bg-base hover:bg-ui-bg-subtle"
          }`}
          type="button"
          onClick={() => onSelectRole(role.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-2">
              <div className="break-words txt-compact-small-plus text-ui-fg-base">
                {role.title}
              </div>
              <div className="mt-1 txt-compact-small text-ui-fg-subtle">
                {role.developer}
              </div>
            </div>
            <span
              className={`min-w-[4.5rem] shrink-0 whitespace-nowrap text-right txt-compact-small-plus ${statusTextColor[role.status]}`}
            >
              {statusLabels[role.status]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 txt-compact-small text-ui-fg-muted">
            <span>{role.submitted}</span>
            <span>确认点 {role.confirmations}</span>
            <span>{role.price}</span>
            {role.riskLabel && (
              <span className="text-orange-600">{role.riskLabel}</span>
            )}
          </div>
        </button>
      ))}
      {roles.length === 0 && (
        <div className="px-4 py-8 txt-compact-small text-ui-fg-muted">
          当前筛选下暂无岗位。
        </div>
      )}
    </div>
  </section>
);

const RoleHeader = ({ role }: { role: RoleReviewItem }) => (
  <div className="border-b px-5 py-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="txt-large-plus text-ui-fg-base">{role.title}</h1>
        <p className="mt-2 txt-compact-small text-ui-fg-subtle">
          审核三项：岗位标准、安全合规、定价合理性；AI 只辅助，最终人工确认。
        </p>
      </div>
      <span
        className={`txt-compact-small-plus ${statusTextColor[role.status]}`}
      >
        {statusLabels[role.status]}
      </span>
    </div>
    <div className="mt-4 grid grid-cols-4 gap-3">
      {[
        ["版本", role.version],
        ["分类", role.category],
        ["授权费", role.price],
        ["上线状态", `${role.statusNote} / ${role.listingStatus}`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border px-3 py-3">
          <div className="txt-compact-small text-ui-fg-muted">{label}</div>
          <div className="mt-1 txt-compact-small-plus text-ui-fg-base">
            {value}
          </div>
        </div>
      ))}
    </div>
    <p className="mt-3 txt-compact-small text-ui-fg-subtle">
      {role.statusReason}
    </p>
  </div>
);

const ReviewCheckList = ({
  title,
  items,
}: {
  title: string;
  items: ReviewCheckItem[];
}) => (
  <section className="rounded-lg border bg-ui-bg-base">
    <div className="border-b px-4 py-4">
      <h2 className="txt-medium-plus text-ui-fg-base">{title}</h2>
    </div>
    <div className="divide-y">
      {items.length > 0 ? (
        items.map((item) => (
          <div
            key={item.id}
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: "150px 72px minmax(0, 1fr)" }}
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              {item.label}
            </span>
            <span
              className={`txt-compact-small-plus ${checkTextColor[item.status]}`}
            >
              {checkLabels[item.status]}
            </span>
            <span className="txt-compact-small text-ui-fg-subtle">
              {item.note}
            </span>
          </div>
        ))
      ) : (
        <div className="px-4 py-3 txt-compact-small text-ui-fg-muted">
          暂无专项检查。
        </div>
      )}
    </div>
  </section>
);

const RoleReviewFacts = ({ role }: { role: RoleReviewItem }) => {
  const pkg = role.packageSummary;
  const pricingItems = role.pricingSummary?.checks ?? [];
  return (
    <>
      <section className="rounded-lg border bg-ui-bg-base">
        <div className="border-b px-4 py-4">
          <h2 className="txt-medium-plus text-ui-fg-base">岗位包摘要</h2>
          <p className="mt-1 txt-compact-small text-ui-fg-subtle">
            读取同一个岗位商品 listing 与岗位包，不展示
            token、本地路径或私有对话。
          </p>
        </div>
        <div className="divide-y">
          {(pkg?.manifest ?? []).map((row) => (
            <div
              key={row.label}
              className="grid gap-4 px-4 py-3"
              style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
            >
              <span className="txt-compact-small-plus text-ui-fg-base">
                {row.label}
              </span>
              <span className="txt-compact-small text-ui-fg-subtle">
                {row.value}
              </span>
            </div>
          ))}
          <div
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              requiredCapabilities
            </span>
            <span className="txt-compact-small text-ui-fg-subtle">
              {(pkg?.requiredCapabilities ?? []).join("、") || "-"}
            </span>
          </div>
          <div
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              skills/templates
            </span>
            <span className="txt-compact-small text-ui-fg-subtle">
              {[...(pkg?.skills ?? []), ...(pkg?.templates ?? [])]
                .slice(0, 6)
                .join("、") || "-"}
            </span>
          </div>
          <div
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              使用规范
            </span>
            <span className="whitespace-pre-line txt-compact-small text-ui-fg-subtle">
              {role.usageInstructions || "未提供使用规范。"}
            </span>
          </div>
          <div
            className="grid gap-4 px-4 py-3"
            style={{ gridTemplateColumns: "150px minmax(0, 1fr)" }}
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              README/listing
            </span>
            <span className="txt-compact-small text-ui-fg-subtle">
              {pkg ? `${pkg.readme} / ${pkg.listing}` : "未读取到岗位包。"}
            </span>
          </div>
        </div>
      </section>
      <ReviewCheckList title="能力声明" items={role.capabilityChecks} />
      <ReviewCheckList title="安全检查" items={role.safetyChecks} />
      <section className="rounded-lg border bg-ui-bg-base">
        <div className="border-b px-4 py-4">
          <h2 className="txt-medium-plus text-ui-fg-base">定价检查</h2>
          <p className="mt-1 txt-compact-small text-ui-fg-subtle">
            授权费、平台执行费用口径、开发者收益和隐藏收费风险共同决定能否上线。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b px-4 py-4">
          {[
            ["授权费", role.pricingSummary?.authorizationFee ?? role.price],
            [
              "输入 Token 使用费",
              role.pricingSummary?.inputTokenFee ?? "未配置",
            ],
            [
              "输出 Token 使用费",
              role.pricingSummary?.outputTokenFee ?? "未配置",
            ],
            ["平台成本价", role.pricingSummary?.platformTokenCost ?? "未配置"],
            [
              "成本倍率",
              `输入 ${role.pricingSummary?.inputTokenMarkup ?? "未配置"} / 输出 ${
                role.pricingSummary?.outputTokenMarkup ?? "未配置"
              }`,
            ],
            ["硬限制", role.pricingSummary?.tokenPricingLimit ?? "未配置"],
            ["开发者收益", role.pricingSummary?.developerRevenue ?? "未配置"],
            ["隐藏收费风险", role.pricingSummary?.hiddenFeeRisk ?? "待确认"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border px-3 py-3">
              <div className="txt-compact-small text-ui-fg-muted">{label}</div>
              <div className="mt-1 txt-compact-small-plus text-ui-fg-base">
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="divide-y">
          {pricingItems.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 px-4 py-3"
              style={{ gridTemplateColumns: "150px 72px minmax(0, 1fr)" }}
            >
              <span className="txt-compact-small-plus text-ui-fg-base">
                {item.label}
              </span>
              <span
                className={`txt-compact-small-plus ${checkTextColor[item.status]}`}
              >
                {checkLabels[item.status]}
              </span>
              <span className="txt-compact-small text-ui-fg-subtle">
                {item.note}
              </span>
            </div>
          ))}
        </div>
      </section>
      <ReviewCheckList title="美工岗位专项检查" items={role.specialtyChecks} />
    </>
  );
};

const EvaluationSection = ({
  definition,
  decision,
  onDecision,
}: {
  definition: EvaluationDefinition;
  decision: EvaluationDecision;
  onDecision: (decision: EvaluationDecision) => void;
}) => (
  <section
    aria-label={definition.title}
    className="rounded-lg border bg-ui-bg-base"
  >
    <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
      <div>
        <h2 className="txt-medium-plus text-ui-fg-base">{definition.title}</h2>
        <p className="mt-1 txt-compact-small text-ui-fg-subtle">
          {definition.description}
        </p>
      </div>
      <span
        className={`shrink-0 txt-compact-small-plus ${decisionTextColor[decision]}`}
      >
        {decisionLabels[decision]}
      </span>
    </div>
    <div className="divide-y">
      {definition.rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-4 px-4 py-3"
          style={{ gridTemplateColumns: "160px minmax(0, 1fr)" }}
        >
          <span className="txt-compact-small-plus text-ui-fg-base">
            {row.label}
          </span>
          <span className="txt-compact-small text-ui-fg-subtle">
            {row.note}
          </span>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-2 border-t px-4 py-3">
      {[
        ["pass", "通过"],
        ["needs_changes", "要求补充"],
        ["reject", "驳回"],
      ].map(([id, label]) => (
        <button
          key={id}
          className={`h-9 rounded-md border px-4 txt-compact-small-plus ${
            decision === id
              ? "bg-ui-fg-base text-ui-bg-base"
              : "bg-ui-bg-base text-ui-fg-base"
          }`}
          type="button"
          onClick={() => onDecision(id as EvaluationDecision)}
        >
          {label}
        </button>
      ))}
    </div>
  </section>
);

const AssistantPanel = ({
  messages,
  draft,
  running,
  onDraftChange,
  onSend,
  onAction,
}: {
  messages: AssistantMessage[];
  draft: string;
  running: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAction: (action: string) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <section className="flex h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
      <div className="shrink-0 border-b px-4 py-4">
        <h2 className="txt-large-plus text-ui-fg-base">AI 审核助手</h2>
        <p className="mt-2 txt-compact-small text-ui-fg-subtle">
          辅助审核人员总结、发现问题、起草意见；不自动给出最终结论。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            "总结岗位",
            "查缺失",
            "评估安全",
            "评估定价",
            "起草补充",
            "起草驳回",
          ].map((action) => (
            <button
              key={action}
              className="h-9 rounded-md border bg-ui-bg-base px-3 txt-compact-small-plus text-ui-fg-base hover:bg-ui-bg-subtle"
              disabled={running}
              type="button"
              onClick={() => onAction(action)}
            >
              {action}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border px-3 py-3 ${
              message.author === "审核人员"
                ? "border-ui-border-interactive bg-ui-bg-interactive/10"
                : "bg-ui-bg-subtle"
            }`}
          >
            <div className="txt-compact-small-plus text-ui-fg-base">
              {message.author}
            </div>
            <p className="mt-1 txt-compact-small text-ui-fg-subtle">
              {message.body}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        className="grid shrink-0 gap-2 border-t px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input
          className="h-10 rounded-lg border bg-ui-bg-base px-3 txt-compact-small outline-none placeholder:text-ui-fg-muted"
          placeholder="让 AI 帮你检查或起草意见..."
          type="text"
          value={draft}
          disabled={running}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <button
          className="h-10 rounded-lg bg-ui-fg-base px-4 txt-compact-small-plus text-ui-bg-base disabled:opacity-40"
          disabled={!draft.trim() || running}
          type="submit"
        >
          {running ? "处理中" : "发送"}
        </button>
      </form>
    </section>
  );
};

const StatusPanel = ({ role }: { role: RoleReviewItem }) => (
  <section className="overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
    <div className="border-b px-4 py-4">
      <h2 className="txt-large-plus text-ui-fg-base">审核状态</h2>
      <p className="mt-2 txt-compact-small text-ui-fg-subtle">
        AI 建议不等于最终审核结论。
      </p>
    </div>
    <div className="divide-y">
      {evaluationDefinitions.map((definition) => {
        const decision = role.evaluations[definition.key];
        return (
          <div
            key={definition.key}
            className="flex items-center justify-between px-4 py-4"
          >
            <span className="txt-compact-small-plus text-ui-fg-base">
              {definition.title}
            </span>
            <span
              className={`txt-compact-small-plus ${decisionTextColor[decision]}`}
            >
              {decisionLabels[decision]}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between px-4 py-4">
        <span className="txt-compact-small-plus text-ui-fg-base">审核结果</span>
        <span
          className={`txt-compact-small-plus ${statusTextColor[role.status]}`}
        >
          {statusLabels[role.status]}
        </span>
      </div>
    </div>
  </section>
);

const FinalActionBar = ({
  note,
  canApprove,
  canRequestChanges,
  canReject,
  onNoteChange,
  onFinalize,
}: {
  note: string;
  canApprove: boolean;
  canRequestChanges: boolean;
  canReject: boolean;
  onNoteChange: (value: string) => void;
  onFinalize: (status: FinalReviewStatus) => void;
}) => (
  <div
    className="grid gap-3 border-t bg-ui-bg-base px-5 py-4"
    style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto auto" }}
  >
    <input
      className="h-10 rounded-lg border bg-ui-bg-base px-3 txt-compact-small outline-none placeholder:text-ui-fg-muted"
      placeholder="审核意见摘要"
      type="text"
      value={note}
      onChange={(event) => onNoteChange(event.target.value)}
    />
    <button
      className="h-10 rounded-md border bg-ui-bg-base px-4 txt-compact-small-plus text-ui-fg-base disabled:opacity-40"
      disabled={!canApprove}
      type="button"
      onClick={() => onFinalize("approved")}
    >
      通过
    </button>
    <button
      className="h-10 rounded-md border bg-ui-bg-base px-4 txt-compact-small-plus text-ui-fg-base disabled:opacity-40"
      disabled={!canRequestChanges}
      type="button"
      onClick={() => onFinalize("needs_changes")}
    >
      要求补充
    </button>
    <button
      className="h-10 rounded-md bg-red-600 px-4 txt-compact-small-plus text-white disabled:opacity-40"
      disabled={!canReject}
      type="button"
      onClick={() => onFinalize("rejected")}
    >
      驳回
    </button>
  </div>
);

const RecordsPanel = ({
  roles,
  selectedRole,
}: {
  roles: RoleReviewItem[];
  selectedRole: RoleReviewItem;
}) => (
  <section className="rounded-lg border bg-ui-bg-base shadow-borders-base">
    <div className="border-b px-6 py-5">
      <h1 className="txt-large-plus text-ui-fg-base">审核记录</h1>
      <p className="mt-2 txt-compact-small text-ui-fg-subtle">
        记录当前审核原型中产生的人工判断和 AI 助手操作。
      </p>
    </div>
    <div className="grid gap-4 px-6 py-6">
      {roles.map((role) => (
        <div key={role.id} className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="txt-compact-small-plus text-ui-fg-base">
              {role.title}
            </span>
            <span
              className={`txt-compact-small-plus ${statusTextColor[role.status]}`}
            >
              {statusLabels[role.status]}
            </span>
          </div>
          <div className="divide-y">
            {(role.id === selectedRole.id
              ? role.records
              : role.records.slice(-2)
            ).map((record) => (
              <div
                key={record}
                className="px-4 py-3 txt-compact-small text-ui-fg-subtle"
              >
                {record}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const SettingsPanel = () => {
  const groups = [
    {
      title: "审核入口",
      rows: [
        ["审核中心", "查看 submitted 队列、三项评估、AI 辅助和最终人工动作。"],
        [
          "岗位商品列表",
          "只展示岗位商品审核状态，不在列表页直接替人做最终审核。",
        ],
        [
          "岗位详情",
          "读取同一个 roleListing/review read model，按钮必须写入后端。",
        ],
        [
          "审核助手",
          "surface 固定 admin_review，必须绑定当前 roleListing/review。",
        ],
      ],
    },
    {
      title: "人工动作",
      rows: [
        ["通过 approved", "三项评估均通过且无阻断检查后，才允许发布到商城。"],
        ["要求补充 needs_changes", "退回开发者修改，商城不可见，不能授权。"],
        ["驳回 rejected", "保留审核记录，商城不可见，不能授权。"],
        ["记录要求", "最终动作必须写 review/listing 状态，不能只 toast。"],
      ],
    },
    {
      title: "AI 助手权限",
      rows: [
        ["允许", "总结岗位、查缺失、评估安全、评估定价、起草补充或驳回意见。"],
        ["禁止", "自动通过、自动驳回、自动发布、修改开发者岗位包。"],
        ["数据边界", "只读取脱敏岗位包摘要、检查项、评估状态和审核记录。"],
        [
          "费用归属",
          "审核助手按 admin_review_assist 记账，不按开发者岗位收益记账。",
        ],
      ],
    },
    {
      title: "费用口径",
      rows: [
        [
          "开发者中心",
          "不展示也不填写平台执行费用明细，只展示授权费、销售和开发者应收。",
        ],
        [
          "审核中心",
          "核对授权费、平台执行费用口径、开发者收益和隐藏收费风险。",
        ],
        [
          "使用者费用",
          "正式执行后从 ledger/readback 读取，不能由商城或开发者页伪造。",
        ],
        [
          "role_usage",
          "岗位执行计费和审计统一按 role_usage，不按普通聊天计费。",
        ],
      ],
    },
    {
      title: "美工岗位强制项",
      rows: [
        ["商品图输入", "没有商品图或主图输入说明，不能通过。"],
        ["图片能力", "必须说明图片理解、图片生成或设计输出能力。"],
        ["输出标准", "必须说明主图/详情页输出标准和人工确认点。"],
        ["artifact 回写", "不能只有调度状态，必须能回读业务产物。"],
      ],
    },
    {
      title: "页面可见性",
      rows: [
        ["submitted", "只进审核队列，不进商城，不进使用者中心。"],
        ["needs_changes / rejected", "保留审核记录，不允许购买授权。"],
        ["approved + published", "商城可见，可购买或授权。"],
        ["authorized", "使用者中心可见，本地端可同步执行入口。"],
      ],
    },
  ];

  return (
    <section className="rounded-lg border bg-ui-bg-base shadow-borders-base">
      <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <h1 className="txt-large-plus text-ui-fg-base">审核设置</h1>
          <p className="mt-2 txt-compact-small text-ui-fg-subtle">
            当前生效的审核规则读模型。需要修改规则时必须接后端配置接口，不能只改页面状态。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <StatusPill label="人工审核" />
          <StatusPill label="admin_review" />
        </div>
      </div>
      <div className="divide-y">
        {groups.map((group) => (
          <section key={group.title} className="px-6 py-5">
            <h2 className="txt-medium-plus text-ui-fg-base">{group.title}</h2>
            <div className="mt-4 divide-y border-t">
              {group.rows.map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-4 px-4 py-3"
                  style={{ gridTemplateColumns: "170px minmax(0, 1fr)" }}
                >
                  <span className="txt-compact-small-plus text-ui-fg-base">
                    {label}
                  </span>
                  <span className="txt-compact-small text-ui-fg-subtle">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

const StatusPill = ({ label }: { label: string }) => (
  <div className="flex h-10 items-center rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
    <span className="txt-compact-small-plus text-ui-fg-base">{label}</span>
  </div>
);
