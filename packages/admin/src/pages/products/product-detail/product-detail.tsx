import { CheckCircle, ExclamationCircle, InformationCircle } from "@medusajs/icons"
import { Button, Container, Heading, StatusBadge, Text, Textarea, Tooltip } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"

import {
  fetchReviewCenter,
  finalizeReview,
  saveReviewEvaluations,
  type EvaluationDecision,
  type EvaluationKey,
  type ReviewCheckItem,
  type ReviewQueueItem,
} from "../../../lib/dijie/review-center"

const evaluationLabels: Record<EvaluationKey, string> = {
  roleStandard: "岗位标准评估",
  safetyCompliance: "安全合规评估",
  pricingReasonability: "定价合理性评估",
}

const decisionLabels: Record<EvaluationDecision, string> = {
  pending: "待确认",
  pass: "通过",
  needs_changes: "要求补充",
  reject: "驳回",
}

const statusColor = (value?: string) => {
  switch (value) {
    case "approved":
    case "published":
    case "pass":
      return "green"
    case "submitted":
    case "proposed":
    case "needs_changes":
    case "warning":
      return "orange"
    case "rejected":
    case "archived":
    case "reject":
    case "blocked":
      return "red"
    default:
      return "grey"
  }
}

const formatSubmittedAt = (value?: string | null) => {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export const ProductDetailPage = () => {
  const { id } = useParams()
  const [role, setRole] = useState<ReviewQueueItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError("")
    try {
      const model = await fetchReviewCenter()
      const nextRole = model?.queue.find((item) => item.id === id) ?? null
      setRole(nextRole)
      setNote(nextRole?.finalNote ?? "")
      if (!nextRole) {
        setError("未找到该岗位审核记录。")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "岗位审核详情暂时无法读取。")
      setRole(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [id])

  const canApprove = useMemo(
    () =>
      Boolean(
        role?.allowedActions?.includes("finalize_approved") &&
          Object.values(role.evaluations ?? {}).every((decision) => decision === "pass"),
      ),
    [role],
  )
  const canRequestChanges = Boolean(role?.allowedActions?.includes("finalize_needs_changes"))
  const canReject = Boolean(role?.allowedActions?.includes("finalize_rejected"))

  const saveEvaluation = async (key: EvaluationKey, decision: EvaluationDecision) => {
    if (!role || saving) {
      return
    }
    const nextEvaluations = {
      roleStandard: role.evaluations?.roleStandard ?? "pending",
      safetyCompliance: role.evaluations?.safetyCompliance ?? "pending",
      pricingReasonability: role.evaluations?.pricingReasonability ?? "pending",
      [key]: decision,
    }
    setSaving(true)
    try {
      await saveReviewEvaluations(role.reviewId, {
        roleStandardDecision: nextEvaluations.roleStandard,
        safetyComplianceDecision: nextEvaluations.safetyCompliance,
        pricingReasonabilityDecision: nextEvaluations.pricingReasonability,
        summary: note.trim() || undefined,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核评估保存失败。")
    } finally {
      setSaving(false)
    }
  }

  const completeReview = async (finalResult: "approved" | "needs_changes" | "rejected") => {
    if (!role || saving) {
      return
    }
    setSaving(true)
    try {
      await finalizeReview(role.reviewId, {
        finalResult,
        summary: note.trim() || undefined,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "最终审核动作保存失败。")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <DetailState message="正在读取岗位审核详情..." />
  }

  if (error && !role) {
    return <DetailState tone="error" message={error} />
  }

  if (!role) {
    return <DetailState message="未找到岗位审核记录。" />
  }

  return (
    <div className="grid gap-6 p-6" data-testid="product-detail-page">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">审核中心</Heading>
          <Text size="small" className="mt-1 text-ui-fg-subtle">
            详情页和工作台共用同一个岗位商品审核状态。
          </Text>
        </div>
        <Button asChild size="small" variant="secondary">
          <Link to="/products">返回审核列表</Link>
        </Button>
      </div>
      {error && <div className="rounded-md border border-red-200 px-4 py-3 txt-compact-small text-red-600">{error}</div>}
      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
        <main className="grid min-w-0 gap-5">
          <Container className="divide-y p-0">
            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <div>
                <Heading level="h2">{role.title}</Heading>
                <Text size="small" className="mt-2 text-ui-fg-subtle">
                  {role.statusReason || role.subtitle || "-"}
                </Text>
              </div>
              <StatusBadge color={statusColor(role.reviewState)}>
                {role.reviewStateLabel || role.reviewState || "-"}
              </StatusBadge>
            </div>
            <ReadonlyGrid
              rows={[
                ["开发者", role.developerName || "-"],
                ["岗位包", `${role.packageId || "-"} ${role.packageVersion ? `v${role.packageVersion}` : ""}`],
                ["审核状态", role.reviewStateLabel || role.reviewState || "-"],
                ["商城上线状态", role.listingStatus || "-"],
                ["授权费", role.priceLabel || role.pricingSummary?.authorizationFee || "-"],
                ["提交时间", formatSubmittedAt(role.submittedAt)],
              ]}
            />
          </Container>
          <PackageSection role={role} />
          <CheckSection title="能力声明" items={role.capabilityChecks ?? []} />
          <CheckSection title="安全检查" items={role.safetyChecks ?? []} />
          <CheckSection title="定价检查" items={role.pricingSummary?.checks ?? []} />
          <CheckSection title="美工岗位专项检查" items={role.specialtyChecks ?? []} />
        </main>
        <aside className="grid content-start gap-5">
          <Container className="divide-y p-0">
            <div className="flex items-center gap-x-2 px-6 py-4">
              <Heading level="h2">三项评估</Heading>
              <Tooltip content="保存成功后才会刷新审核状态。">
                <InformationCircle className="text-ui-fg-muted" />
              </Tooltip>
            </div>
            {(["roleStandard", "safetyCompliance", "pricingReasonability"] as EvaluationKey[]).map((key) => (
              <div key={key} className="grid gap-3 px-6 py-4">
                <div className="flex items-center justify-between">
                  <Text size="small" weight="plus">{evaluationLabels[key]}</Text>
                  <StatusBadge color={statusColor(role.evaluations?.[key])}>
                    {decisionLabels[role.evaluations?.[key] ?? "pending"]}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["pass", "通过"],
                    ["needs_changes", "要求补充"],
                    ["reject", "驳回"],
                  ] as Array<[EvaluationDecision, string]>).map(([decision, label]) => (
                    <Button
                      key={decision}
                      size="small"
                      variant={role.evaluations?.[key] === decision ? "primary" : "secondary"}
                      disabled={saving || !role.allowedActions?.includes("save_evaluations")}
                      onClick={() => saveEvaluation(key, decision)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </Container>
          <Container className="divide-y p-0">
            <div className="px-6 py-4">
              <Heading level="h2">最终动作</Heading>
              <Text size="small" className="mt-1 text-ui-fg-subtle">
                通过后写入 approved + published，商城才可展示和授权。
              </Text>
            </div>
            <div className="grid gap-3 px-6 py-4">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="审核意见摘要"
              />
              <div className="grid gap-2">
                <Button disabled={saving || !canApprove} onClick={() => completeReview("approved")}>
                  <CheckCircle />
                  通过并上线
                </Button>
                <Button variant="secondary" disabled={saving || !canRequestChanges} onClick={() => completeReview("needs_changes")}>
                  要求补充
                </Button>
                <Button variant="secondary" disabled={saving || !canReject} onClick={() => completeReview("rejected")}>
                  <ExclamationCircle />
                  驳回
                </Button>
              </div>
            </div>
          </Container>
        </aside>
      </div>
    </div>
  )
}

const DetailState = ({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) => (
  <Container className="m-6 px-6 py-10 text-center">
    <Heading level="h2">审核中心</Heading>
    <Text size="small" className={`mt-2 ${tone === "error" ? "text-red-600" : "text-ui-fg-subtle"}`}>
      {message}
    </Text>
  </Container>
)

const ReadonlyGrid = ({ rows }: { rows: Array<[string, string]> }) => (
  <div className="grid grid-cols-2 gap-0">
    {rows.map(([label, value]) => (
      <div key={label} className="grid gap-1 border-b px-6 py-4 last:border-b-0">
        <Text size="small" weight="plus">{label}</Text>
        <Text size="small" className="text-ui-fg-subtle">{value}</Text>
      </div>
    ))}
  </div>
)

const PackageSection = ({ role }: { role: ReviewQueueItem }) => {
  const pkg = role.packageSummary
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">岗位包摘要</Heading>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          manifest、requiredCapabilities、skills、templates、validation、README/listing。
        </Text>
      </div>
      <ReadonlyGrid
        rows={[
          ["requiredCapabilities", (pkg?.requiredCapabilities ?? []).join("、") || "-"],
          ["skills", (pkg?.skills ?? []).slice(0, 4).join("、") || "-"],
          ["templates", (pkg?.templates ?? []).slice(0, 4).join("、") || "-"],
          ["validation", (pkg?.validation ?? []).slice(0, 4).join("、") || "-"],
          ["README", pkg?.readme || "-"],
          ["listing", pkg?.listing || "-"],
        ]}
      />
    </Container>
  )
}

const CheckSection = ({ title, items }: { title: string; items: ReviewCheckItem[] }) => (
  <Container className="divide-y p-0">
    <div className="px-6 py-4">
      <Heading level="h2">{title}</Heading>
    </div>
    {items.length > 0 ? (
      items.map((item) => (
        <div
          key={item.id}
          className="grid gap-4 px-6 py-4"
          style={{ gridTemplateColumns: "150px 80px minmax(0, 1fr)" }}
        >
          <Text size="small" weight="plus">{item.label}</Text>
          <StatusBadge color={statusColor(item.status)}>
            {item.status === "pass" ? "通过" : item.status === "warning" ? "需复核" : "阻断"}
          </StatusBadge>
          <Text size="small" className="text-ui-fg-subtle">{item.note}</Text>
        </div>
      ))
    ) : (
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">暂无专项检查。</Text>
      </div>
    )}
  </Container>
)
