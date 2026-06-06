import { useEffect, useMemo, useRef, useState } from "react"
import { fetchQuery } from "../../lib/client"

type WorkbenchTab = "review" | "records" | "settings"
type RoleStatus = "pending" | "needs_changes" | "approved" | "rejected"
type EvaluationKey = "roleStandard" | "safetyCompliance" | "pricingReasonability"
type EvaluationDecision = "pending" | "pass" | "needs_changes" | "reject"
type AssistantAuthor = "审核人员" | "AI助手"

type EvaluationDefinition = {
  key: EvaluationKey
  title: string
  description: string
  rows: Array<{ label: string; note: string }>
}

type RoleReviewItem = {
  id: string
  title: string
  developer: string
  submitted: string
  status: RoleStatus
  statusNote: string
  price: string
  confirmations: number
  version: string
  category: string
  riskLabel?: string
  summary: string
  evaluations: Record<EvaluationKey, EvaluationDecision>
  records: string[]
  finalNote: string
}

type AssistantMessage = {
  id: number
  author: AssistantAuthor
  body: string
}

type DialogMessageResponse = {
  message?: {
    content?: string
  }
  modelCalled?: boolean
}

const navigationItems: Array<{ id: WorkbenchTab; label: string }> = [
  { id: "review", label: "岗位审核" },
  { id: "records", label: "审核记录" },
  { id: "settings", label: "审核设置" },
]

const evaluationDefinitions: EvaluationDefinition[] = [
  {
    key: "roleStandard",
    title: "岗位标准评估",
    description: "确认岗位是否能作为清晰、可用、可评估的岗位商品上架。",
    rows: [
      { label: "岗位介绍", note: "说明岗位用途、适用场景和交付结果。" },
      { label: "能力边界", note: "说明能做什么、不能做什么。" },
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
      { label: "本地路径/密钥", note: "不暴露本地路径、账号、密钥或内部环境。" },
      { label: "审计回读", note: "关键执行结果可脱敏回读。" },
    ],
  },
  {
    key: "pricingReasonability",
    title: "定价合理性评估",
    description: "确认授权费、模型调用费和开发者收益说明合理透明。",
    rows: [
      { label: "授权费", note: "价格与岗位价值、复杂度匹配。" },
      { label: "模型调用费", note: "调用成本口径清楚，避免隐藏费用。" },
      { label: "开发者收益", note: "收益归集和结算说明明确。" },
      { label: "隐藏收费风险", note: "不把额外收费藏在说明之外。" },
      { label: "价格与价值", note: "使用者能判断购买是否值得。" },
    ],
  },
]

const initialRoles: RoleReviewItem[] = [
  {
    id: "image-review-role",
    title: "商品图检查岗位",
    developer: "示例开发者",
    submitted: "10分钟前",
    status: "pending",
    statusNote: "待审核",
    price: "0 CNY",
    confirmations: 2,
    version: "v1.0.0",
    category: "商品运营 / 图片审核",
    summary: "检查商品图片清晰度、主体完整性和基础合规风险。",
    evaluations: {
      roleStandard: "pending",
      safetyCompliance: "pending",
      pricingReasonability: "pending",
    },
    records: ["待审核岗位已进入审核队列。"],
    finalNote: "",
  },
  {
    id: "support-quality-role",
    title: "客服质检岗位",
    developer: "服务运营组",
    submitted: "35分钟前",
    status: "needs_changes",
    statusNote: "要求补充",
    price: "9 CNY",
    confirmations: 1,
    summary: "检查客服对话是否符合服务规范。",
    version: "v0.9.2",
    category: "客服运营 / 质检",
    evaluations: {
      roleStandard: "needs_changes",
      safetyCompliance: "pass",
      pricingReasonability: "pending",
    },
    records: ["已要求补充质检样例和边界说明。"],
    finalNote: "请补充可评估样例。",
  },
  {
    id: "contract-summary-role",
    title: "合同摘要岗位",
    developer: "文档效率组",
    submitted: "1小时前",
    status: "pending",
    statusNote: "待审核",
    price: "29 CNY",
    confirmations: 3,
    riskLabel: "风险提示",
    summary: "提取合同条款摘要和待确认事项。",
    version: "v1.2.0",
    category: "办公文档 / 合同摘要",
    evaluations: {
      roleStandard: "pending",
      safetyCompliance: "pending",
      pricingReasonability: "pending",
    },
    records: ["安全合规需要重点检查敏感信息处理。"],
    finalNote: "",
  },
  {
    id: "inventory-alert-role",
    title: "库存预警岗位",
    developer: "供应链示例",
    submitted: "昨天",
    status: "approved",
    statusNote: "已通过",
    price: "19 CNY",
    confirmations: 1,
    summary: "根据库存和销量生成补货提醒。",
    version: "v1.0.1",
    category: "供应链 / 库存",
    evaluations: {
      roleStandard: "pass",
      safetyCompliance: "pass",
      pricingReasonability: "pass",
    },
    records: ["三项评估通过，岗位审核结果为已通过。"],
    finalNote: "标准清楚，风险可控，定价合理。",
  },
]

const statusLabels: Record<RoleStatus, string> = {
  pending: "待审核",
  needs_changes: "要求补充",
  approved: "已通过",
  rejected: "已驳回",
}

const decisionLabels: Record<EvaluationDecision, string> = {
  pending: "待确认",
  pass: "通过",
  needs_changes: "要求补充",
  reject: "驳回",
}

const statusTextColor: Record<RoleStatus, string> = {
  pending: "text-orange-500",
  needs_changes: "text-orange-600",
  approved: "text-green-600",
  rejected: "text-red-500",
}

const decisionTextColor: Record<EvaluationDecision, string> = {
  pending: "text-ui-fg-muted",
  pass: "text-green-600",
  needs_changes: "text-orange-600",
  reject: "text-red-500",
}

const appendRecord = (role: RoleReviewItem, label: string): RoleReviewItem => ({
  ...role,
  records: [...role.records, label],
})

const createAssistantReply = (action: string, role: RoleReviewItem) => {
  if (action === "总结岗位") {
    return `${role.title} 主要用于${role.summary} 建议重点核对生成结果样例、确认点和定价说明。`
  }
  if (action === "查缺失") {
    return "建议先确认岗位标准里的生成结果是否可评估；如果缺少样例，最终动作优先选择要求补充。"
  }
  if (action === "评估安全") {
    return "当前安全检查应重点看权限边界、敏感数据处理和审计回读；AI 建议只作为参考，仍需人工确认。"
  }
  if (action === "评估定价") {
    return `当前授权费为 ${role.price}，请确认模型调用费、开发者收益和隐藏收费风险是否说明清楚。`
  }
  if (action === "起草补充") {
    return "补充建议：请开发者补充生成结果样例、适用边界、失败场景和费用说明后再提交审核。"
  }
  return "驳回草稿：当前岗位缺少必要的评估依据或存在不可接受风险，暂不适合上架。"
}

const createAssistantQuestionReply = (question: string, role: RoleReviewItem) => {
  if (question.includes("安全") || question.includes("合规") || question.includes("风险")) {
    return `针对「${role.title}」，建议先看安全合规评估：权限边界、敏感数据、本地路径/密钥和审计回读。AI 只能提示风险点，是否通过仍由审核人员确认。`
  }
  if (question.includes("价格") || question.includes("定价") || question.includes("费用") || question.includes("计费")) {
    return `针对「${role.title}」，当前授权费是 ${role.price}。建议核对授权费、模型调用费、开发者收益和隐藏收费风险；价格不清楚时应选择要求补充。`
  }
  if (question.includes("标准") || question.includes("产出") || question.includes("结果") || question.includes("质量")) {
    return `针对「${role.title}」，岗位标准要看介绍是否清楚、能力边界是否明确、输入输出是否可验证、生成结果是否能被人工评估。`
  }
  if (question.includes("补充")) {
    return `可以要求开发者补充「${role.title}」的生成结果样例、失败场景、确认点说明和费用口径，再重新进入审核。`
  }
  if (question.includes("驳回")) {
    return `如果「${role.title}」存在不可接受的安全风险、产出无法评估或定价明显不透明，可以起草驳回；请在最终意见里写清楚具体原因。`
  }
  return `已收到。当前审核对象是「${role.title}」，建议按岗位标准、安全合规、定价合理性三项逐项判断；AI 回复只做辅助，不会自动改变审核结果。`
}

export const ReviewCenterWorkbench = () => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("review")
  const [roles, setRoles] = useState<RoleReviewItem[]>(initialRoles)
  const [selectedRoleId, setSelectedRoleId] = useState(initialRoles[0].id)
  const [statusFilter, setStatusFilter] = useState<RoleStatus | "all">("all")
  const [queueSearch, setQueueSearch] = useState("")
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 1,
      author: "AI助手",
      body: "我可以帮你总结岗位、查缺失、评估安全和定价，并起草补充或驳回意见。",
    },
  ])
  const [assistantDraft, setAssistantDraft] = useState("")
  const [assistantRunning, setAssistantRunning] = useState(false)
  const [finalNoteDraft, setFinalNoteDraft] = useState("")

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]

  const filteredRoles = useMemo(() => {
    const normalizedSearch = queueSearch.trim().toLowerCase()
    return roles.filter((role) => {
      const matchesStatus = statusFilter === "all" || role.status === statusFilter
      if (!matchesStatus) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      return [role.title, role.developer, role.category, role.summary, role.price]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [queueSearch, roles, statusFilter])

  const statusSummary = useMemo(
    () => ({
      pending: roles.filter((role) => role.status === "pending").length,
      needsChanges: roles.filter((role) => role.status === "needs_changes").length,
      approved: roles.filter((role) => role.status === "approved").length,
    }),
    [roles],
  )

  const allEvaluationsPass = evaluationDefinitions.every(
    (definition) => selectedRole.evaluations[definition.key] === "pass",
  )
  const hasNeedsChanges = evaluationDefinitions.some(
    (definition) => selectedRole.evaluations[definition.key] === "needs_changes",
  )
  const hasReject = evaluationDefinitions.some(
    (definition) => selectedRole.evaluations[definition.key] === "reject",
  )

  const updateSelectedRole = (updater: (role: RoleReviewItem) => RoleReviewItem) => {
    setRoles((current) => current.map((role) => (role.id === selectedRole.id ? updater(role) : role)))
  }

  const selectEvaluation = (key: EvaluationKey, decision: EvaluationDecision) => {
    const definition = evaluationDefinitions.find((item) => item.key === key)
    updateSelectedRole((role) =>
      appendRecord(
        {
          ...role,
          evaluations: {
            ...role.evaluations,
            [key]: decision,
          },
        },
        `${definition?.title ?? "评估项"}人工标记为${decisionLabels[decision]}。`,
      ),
    )
  }

  const appendAssistantMessage = (message: AssistantMessage) => {
    setAssistantMessages((current) => [...current, message])
  }

  const callReviewAssistant = async (message: string) => {
    const result = await fetchQuery("/dijie/dialog/messages", {
      method: "POST",
      body: {
        surface: "admin_review",
        message,
        subject: {
          roleListingId: selectedRole.id,
          title: selectedRole.title,
          developer: selectedRole.developer,
          category: selectedRole.category,
          summary: selectedRole.summary,
          status: selectedRole.status,
          price: selectedRole.price,
          confirmations: selectedRole.confirmations,
          evaluations: selectedRole.evaluations,
        },
      },
    }) as DialogMessageResponse | undefined

    return result?.message?.content?.trim()
  }

  const runAssistantAction = async (action: string) => {
    if (assistantRunning) {
      return
    }
    setAssistantRunning(true)
    const fallback = createAssistantReply(action, selectedRole)
    let body = fallback
    try {
      body =
        (await callReviewAssistant(
          `审核动作：${action}。请基于当前岗位审核对象给出辅助意见，不要自动给最终审核结论。`,
        )) || fallback
    } catch {
      body = `${fallback}\n\n（云端模型暂不可用，已使用本地审核规则提示。）`
    }
    appendAssistantMessage({
      id: Date.now(),
      author: "AI助手",
      body,
    })
    updateSelectedRole((role) => appendRecord(role, `AI审核助手执行：${action}。`))
    setAssistantRunning(false)
  }

  const sendAssistantMessage = async () => {
    const body = assistantDraft.trim()
    if (!body || assistantRunning) {
      return
    }
    const baseId = Date.now()
    setAssistantMessages((current) => [...current, { id: baseId, author: "审核人员", body }])
    updateSelectedRole((role) => appendRecord(role, `审核人员向AI提问：${body}`))
    setAssistantDraft("")
    setAssistantRunning(true)

    const fallback = createAssistantQuestionReply(body, selectedRole)
    let assistantBody = fallback
    try {
      assistantBody = (await callReviewAssistant(body)) || fallback
    } catch {
      assistantBody = `${fallback}\n\n（云端模型暂不可用，已使用本地审核规则提示。）`
    }
    appendAssistantMessage({
      id: baseId + 1,
      author: "AI助手",
      body: assistantBody,
    })
    setAssistantRunning(false)
  }

  const finalizeReview = (status: RoleStatus) => {
    const note = finalNoteDraft.trim()
    const finalText =
      status === "approved"
        ? "最终审核通过"
        : status === "needs_changes"
          ? "最终要求补充"
          : "最终驳回"
    updateSelectedRole((role) =>
      appendRecord(
        {
          ...role,
          status,
          statusNote: statusLabels[status],
          finalNote: note || role.finalNote,
        },
        note ? `${finalText}：${note}` : `${finalText}。`,
      ),
    )
  }

  const renderMainPanel = () => {
    if (activeTab === "records") {
      return <RecordsPanel roles={roles} selectedRole={selectedRole} />
    }
    if (activeTab === "settings") {
      return <SettingsPanel />
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
            setSelectedRoleId(roleId)
            setFinalNoteDraft("")
          }}
        />
        <section
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base"
          style={{ minHeight: 780 }}
        >
          <RoleHeader role={selectedRole} />
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5">
            {evaluationDefinitions.map((definition) => (
              <EvaluationSection
                key={definition.key}
                definition={definition}
                decision={selectedRole.evaluations[definition.key]}
                onDecision={(decision) => selectEvaluation(definition.key, decision)}
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
    )
  }

  return (
    <div
      className="grid overflow-hidden bg-ui-bg-subtle"
      style={{ gridTemplateColumns: "200px minmax(0, 1fr)", minHeight: 820 }}
    >
      <aside className="border-r bg-ui-bg-subtle px-5 py-6">
        <div className="mb-8 flex items-center gap-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ui-bg-base txt-large-plus shadow-borders-base">
            审
          </div>
          <div>
            <div className="txt-large-plus">迭界AI</div>
            <div className="txt-medium text-ui-fg-subtle">审核中心</div>
          </div>
        </div>
        <nav className="flex flex-col gap-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`rounded-lg px-4 py-3 text-left txt-medium-plus ${
                activeTab === item.id
                  ? "bg-ui-bg-base text-ui-fg-base shadow-borders-base"
                  : "text-ui-fg-subtle hover:bg-ui-bg-base"
              }`}
              type="button"
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 px-6">
        <div className="flex items-center justify-between border-b" style={{ minHeight: 72 }}>
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
  )
}

const ReviewQueue = ({
  roles,
  searchValue,
  selectedRoleId,
  statusFilter,
  onFilterChange,
  onSearchChange,
  onSelectRole,
}: {
  roles: RoleReviewItem[]
  searchValue: string
  selectedRoleId: string
  statusFilter: RoleStatus | "all"
  onFilterChange: (filter: RoleStatus | "all") => void
  onSearchChange: (value: string) => void
  onSelectRole: (roleId: string) => void
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
              statusFilter === id ? "bg-ui-fg-base text-ui-bg-base" : "bg-ui-bg-base text-ui-fg-base"
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
            role.id === selectedRoleId ? "bg-ui-bg-subtle" : "bg-ui-bg-base hover:bg-ui-bg-subtle"
          }`}
          type="button"
          onClick={() => onSelectRole(role.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="txt-compact-small-plus text-ui-fg-base">{role.title}</div>
              <div className="mt-1 txt-compact-small text-ui-fg-subtle">{role.developer}</div>
            </div>
            <span className={`txt-compact-small-plus ${statusTextColor[role.status]}`}>
              {statusLabels[role.status]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 txt-compact-small text-ui-fg-muted">
            <span>{role.submitted}</span>
            <span>确认点 {role.confirmations}</span>
            <span>{role.price}</span>
            {role.riskLabel && <span className="text-orange-600">{role.riskLabel}</span>}
          </div>
        </button>
      ))}
      {roles.length === 0 && (
        <div className="px-4 py-8 txt-compact-small text-ui-fg-muted">当前筛选下暂无岗位。</div>
      )}
    </div>
  </section>
)

const RoleHeader = ({ role }: { role: RoleReviewItem }) => (
  <div className="border-b px-5 py-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="txt-large-plus text-ui-fg-base">{role.title}</h1>
        <p className="mt-2 txt-compact-small text-ui-fg-subtle">
          审核三项：岗位标准、安全合规、定价合理性；AI 只辅助，最终人工确认。
        </p>
      </div>
      <span className={`txt-compact-small-plus ${statusTextColor[role.status]}`}>
        {statusLabels[role.status]}
      </span>
    </div>
    <div className="mt-4 grid grid-cols-4 gap-3">
      {[
        ["版本", role.version],
        ["分类", role.category],
        ["授权费", role.price],
        ["提交", role.submitted],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border px-3 py-3">
          <div className="txt-compact-small text-ui-fg-muted">{label}</div>
          <div className="mt-1 txt-compact-small-plus text-ui-fg-base">{value}</div>
        </div>
      ))}
    </div>
  </div>
)

const EvaluationSection = ({
  definition,
  decision,
  onDecision,
}: {
  definition: EvaluationDefinition
  decision: EvaluationDecision
  onDecision: (decision: EvaluationDecision) => void
}) => (
  <section aria-label={definition.title} className="rounded-lg border bg-ui-bg-base">
    <div className="flex items-start justify-between gap-4 border-b px-4 py-4">
      <div>
        <h2 className="txt-medium-plus text-ui-fg-base">{definition.title}</h2>
        <p className="mt-1 txt-compact-small text-ui-fg-subtle">{definition.description}</p>
      </div>
      <span className={`shrink-0 txt-compact-small-plus ${decisionTextColor[decision]}`}>
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
          <span className="txt-compact-small-plus text-ui-fg-base">{row.label}</span>
          <span className="txt-compact-small text-ui-fg-subtle">{row.note}</span>
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
            decision === id ? "bg-ui-fg-base text-ui-bg-base" : "bg-ui-bg-base text-ui-fg-base"
          }`}
          type="button"
          onClick={() => onDecision(id as EvaluationDecision)}
        >
          {label}
        </button>
      ))}
    </div>
  </section>
)

const AssistantPanel = ({
  messages,
  draft,
  running,
  onDraftChange,
  onSend,
  onAction,
}: {
  messages: AssistantMessage[]
  draft: string
  running: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
  onAction: (action: string) => void
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  return (
    <section className="flex h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
      <div className="shrink-0 border-b px-4 py-4">
        <h2 className="txt-large-plus text-ui-fg-base">AI 审核助手</h2>
        <p className="mt-2 txt-compact-small text-ui-fg-subtle">
          辅助审核人员总结、发现问题、起草意见；不自动给出最终结论。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {["总结岗位", "查缺失", "评估安全", "评估定价", "起草补充", "起草驳回"].map((action) => (
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
            <div className="txt-compact-small-plus text-ui-fg-base">{message.author}</div>
            <p className="mt-1 txt-compact-small text-ui-fg-subtle">{message.body}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        className="grid shrink-0 gap-2 border-t px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
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
  )
}

const StatusPanel = ({ role }: { role: RoleReviewItem }) => (
  <section className="overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
    <div className="border-b px-4 py-4">
      <h2 className="txt-large-plus text-ui-fg-base">审核状态</h2>
      <p className="mt-2 txt-compact-small text-ui-fg-subtle">AI 建议不等于最终审核结论。</p>
    </div>
    <div className="divide-y">
      {evaluationDefinitions.map((definition) => {
        const decision = role.evaluations[definition.key]
        return (
          <div key={definition.key} className="flex items-center justify-between px-4 py-4">
            <span className="txt-compact-small-plus text-ui-fg-base">{definition.title}</span>
            <span className={`txt-compact-small-plus ${decisionTextColor[decision]}`}>
              {decisionLabels[decision]}
            </span>
          </div>
        )
      })}
      <div className="flex items-center justify-between px-4 py-4">
        <span className="txt-compact-small-plus text-ui-fg-base">审核结果</span>
        <span className={`txt-compact-small-plus ${statusTextColor[role.status]}`}>
          {statusLabels[role.status]}
        </span>
      </div>
    </div>
  </section>
)

const FinalActionBar = ({
  note,
  canApprove,
  canRequestChanges,
  canReject,
  onNoteChange,
  onFinalize,
}: {
  note: string
  canApprove: boolean
  canRequestChanges: boolean
  canReject: boolean
  onNoteChange: (value: string) => void
  onFinalize: (status: RoleStatus) => void
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
)

const RecordsPanel = ({
  roles,
  selectedRole,
}: {
  roles: RoleReviewItem[]
  selectedRole: RoleReviewItem
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
            <span className="txt-compact-small-plus text-ui-fg-base">{role.title}</span>
            <span className={`txt-compact-small-plus ${statusTextColor[role.status]}`}>
              {statusLabels[role.status]}
            </span>
          </div>
          <div className="divide-y">
            {(role.id === selectedRole.id ? role.records : role.records.slice(-2)).map((record) => (
              <div key={record} className="px-4 py-3 txt-compact-small text-ui-fg-subtle">
                {record}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
)

const SettingsPanel = () => (
  <section className="rounded-lg border bg-ui-bg-base shadow-borders-base">
    <div className="border-b px-6 py-5">
      <h1 className="txt-large-plus text-ui-fg-base">审核设置</h1>
      <p className="mt-2 txt-compact-small text-ui-fg-subtle">
        平台方工作区：审核规则和计费参数先只读展示，后端后续接入。
      </p>
    </div>
    <div className="divide-y">
      {[
        ["审核模式", "人工审核"],
        ["AI 权限", "只辅助总结、检查和起草，不自动通过"],
        ["通过规则", "三项评估均通过后允许通过"],
        ["补充规则", "任一评估要求补充时允许要求补充"],
        ["驳回规则", "任一评估驳回时允许驳回"],
        ["平台模型成本", "按 OpenClaw / 主系统模型网关回传的真实模型用量核算"],
        ["平台对外费率", "平台方统一配置 Token 对外价格和倍率，岗位开发者价格另行审核"],
        ["收益差额", "对外计费减去真实模型成本后进入平台与岗位开发者结算口径"],
        ["费率变更", "后续接入模型价格同步和人工生效确认，不在买家或开发者中心单独建页"],
      ].map(([label, value]) => (
        <div
          key={label}
          className="grid gap-4 px-6 py-4"
          style={{ gridTemplateColumns: "180px minmax(0, 1fr)" }}
        >
          <span className="txt-compact-small-plus text-ui-fg-base">{label}</span>
          <span className="txt-compact-small text-ui-fg-subtle">{value}</span>
        </div>
      ))}
    </div>
  </section>
)

const StatusPill = ({ label }: { label: string }) => (
  <div className="flex h-10 items-center rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
    <span className="txt-compact-small-plus text-ui-fg-base">{label}</span>
  </div>
)
