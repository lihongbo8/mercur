import { CheckCircle, ExclamationCircle, InformationCircle } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  Textarea,
  Tooltip,
  toast,
} from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { Dialog as RadixDialog } from "radix-ui"
import { useState } from "react"

import { SectionRow } from "../../../../../components/common/section"

type RoleReviewState = "draft" | "submitted" | "approved" | "rejected"
type RoleListingStatus = "draft" | "proposed" | "published" | "rejected"

type DijieRoleMetadata = Record<string, unknown> & {
  reviewState?: RoleReviewState
  review_state?: RoleReviewState
  listingStatus?: RoleListingStatus
  listing_status?: RoleListingStatus
  packageId?: string
  package_id?: string
  packageVersion?: string
  package_version?: string
  authorizationFeeCents?: number
  pricing?: {
    kind?: string
    authorizationFeeCents?: number
    authorization_fee_cents?: number
    amountCents?: number
    amount_cents?: number
    currency?: string
    platformFeeBps?: number
    platform_fee_bps?: number
    developerReceivableBps?: number
    developer_receivable_bps?: number
    developerReceivableCents?: number
    developer_receivable_cents?: number
  }
  roleTokenPricing?: {
    currency?: string
    inputTokenCentsPerMillion?: number
    input_token_cents_per_million?: number
    inputCentsPerMillion?: number
    input_cents_per_million?: number
    outputTokenCentsPerMillion?: number
    output_token_cents_per_million?: number
    outputCentsPerMillion?: number
    output_cents_per_million?: number
    platformFeeBps?: number
    platform_fee_bps?: number
    developerReceivableBps?: number
    developer_receivable_bps?: number
  }
}

const REVIEW_STATE_LABELS: Record<string, string> = {
  draft: "草稿",
  submitted: "待审核",
  approved: "已通过",
  rejected: "已驳回",
}

const REJECTION_REASON_OPTIONS = [
  "资料包校验未通过",
  "泄露扫描需处理",
  "费用配置不合规",
]

const PLATFORM_INPUT_TOKEN_COST_CENTS_PER_MILLION = 120
const PLATFORM_OUTPUT_TOKEN_COST_CENTS_PER_MILLION = 360
const PLATFORM_TOKEN_MAX_MARKUP_MULTIPLIER = 20

const statusColor = (value?: string) => {
  switch (value) {
    case "approved":
    case "published":
      return "green"
    case "submitted":
    case "proposed":
      return "orange"
    case "rejected":
      return "red"
    default:
      return "grey"
  }
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const getRoleMetadata = (product: HttpTypes.AdminProduct) => {
  const metadata = asRecord(product.metadata)
  const role = asRecord(metadata.dijieRole)

  return Object.keys(role).length ? (role as DijieRoleMetadata) : null
}

const getReviewState = (role: DijieRoleMetadata) => {
  return role.reviewState ?? role.review_state ?? "draft"
}

const getListingStatus = (role: DijieRoleMetadata) => {
  return role.listingStatus ?? role.listing_status ?? "draft"
}

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
  }

  return undefined
}

const isNonNegativeInteger = (value: unknown) => {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

const isLocalPathString = (value: string) => {
  return (
    value.startsWith("/") ||
    value.startsWith("~") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.split(/[\\/]/).includes("..")
  )
}

const readPublicString = (...values: unknown[]) => {
  const value = readString(...values)

  return value && !isLocalPathString(value) ? value : undefined
}

const readStringArray = (value: unknown) => {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim())
    : []
}

const readPublicStringArray = (value: unknown) => {
  return readStringArray(value).filter((item) => !isLocalPathString(item))
}

const joinPublicStrings = (value: unknown) => {
  const items = readPublicStringArray(value)

  return items.length ? items.join("、") : "-"
}

const definedRecord = (record: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  )
}

const hasSensitiveReviewKeys = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false
  }

  if (Array.isArray(value)) {
    return value.some(hasSensitiveReviewKeys)
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase()
      if (
        normalizedKey.includes("raw") ||
        normalizedKey.includes("prompt") ||
        normalizedKey.includes("history") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("apikey") ||
        normalizedKey.includes("api_key") ||
        normalizedKey.includes("providerkey") ||
        normalizedKey.includes("provider_key") ||
        normalizedKey.includes("authtoken") ||
        normalizedKey.includes("auth_token") ||
        normalizedKey.includes("accesstoken") ||
        normalizedKey.includes("access_token") ||
        normalizedKey.includes("rawtoken") ||
        normalizedKey.includes("raw_token") ||
        normalizedKey.includes("localpath") ||
        normalizedKey.includes("local_path")
      ) {
        return true
      }

      return hasSensitiveReviewKeys(nestedValue)
    }
  )
}

const hasLocalPathValue = (value: unknown): boolean => {
  if (typeof value === "string") {
    return isLocalPathString(value)
  }

  if (Array.isArray(value)) {
    return value.some(hasLocalPathValue)
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasLocalPathValue)
  }

  return false
}

export const createPublicDijieRoleMetadata = (
  role: DijieRoleMetadata,
  overrides: Partial<Pick<DijieRoleMetadata, "reviewState" | "listingStatus">> = {}
) => {
  const pricing = asRecord(role.pricing)
  const roleTokenPricing = getRoleTokenPricing(role)

  return definedRecord({
    kind: "role_product",
    listingStatus: overrides.listingStatus ?? getListingStatus(role),
    reviewState: overrides.reviewState ?? getReviewState(role),
    title: readPublicString(role.title),
    subtitle: readPublicString(role.subtitle),
    description: readPublicString(role.description),
    capabilities: readPublicStringArray(role.capabilities),
    pricing: definedRecord({
      kind: readPublicString(pricing.kind) ?? "one_time_authorization",
      authorizationFeeCents: readNumber(
        pricing.authorizationFeeCents,
        pricing.authorization_fee_cents,
        pricing.amountCents,
        pricing.amount_cents,
        role.authorizationFeeCents
      ),
      currency: readPublicString(pricing.currency) ?? "CNY",
      platformFeeBps: readNumber(pricing.platformFeeBps, pricing.platform_fee_bps),
      developerReceivableBps: readNumber(
        pricing.developerReceivableBps,
        pricing.developer_receivable_bps
      ),
      developerReceivableCents: readNumber(
        pricing.developerReceivableCents,
        pricing.developer_receivable_cents
      ),
    }),
    roleTokenPricing: definedRecord({
      currency: readPublicString(roleTokenPricing.currency) ?? "CNY",
      inputTokenCentsPerMillion: readNumber(
        roleTokenPricing.inputTokenCentsPerMillion,
        roleTokenPricing.input_token_cents_per_million,
        roleTokenPricing.inputCentsPerMillion,
        roleTokenPricing.input_cents_per_million
      ),
      outputTokenCentsPerMillion: readNumber(
        roleTokenPricing.outputTokenCentsPerMillion,
        roleTokenPricing.output_token_cents_per_million,
        roleTokenPricing.outputCentsPerMillion,
        roleTokenPricing.output_cents_per_million
      ),
      platformFeeBps: readNumber(roleTokenPricing.platformFeeBps, roleTokenPricing.platform_fee_bps),
      developerReceivableBps: readNumber(
        roleTokenPricing.developerReceivableBps,
        roleTokenPricing.developer_receivable_bps
      ),
    }),
    scopes: readPublicStringArray(role.scopes),
  }) as DijieRoleMetadata
}

const getRoleTokenPricing = (role: DijieRoleMetadata) => {
  return asRecord(
    role.roleTokenPricing ?? (role as Record<string, unknown>).role_token_pricing
  )
}

const validateRolePricing = (role: DijieRoleMetadata) => {
  const errors: string[] = []
  const pricing = asRecord(role.pricing)
  const roleTokenPricing = getRoleTokenPricing(role)

  const authorizationFeeCents = readNumber(
    pricing.authorizationFeeCents,
    pricing.authorization_fee_cents,
    pricing.amountCents,
    pricing.amount_cents,
    role.authorizationFeeCents
  )
  const authorizationCurrency = pricing.currency ?? "CNY"
  const authorizationPlatformFeeBps = readNumber(
    pricing.platformFeeBps,
    pricing.platform_fee_bps
  )
  const authorizationDeveloperReceivableBps = readNumber(
    pricing.developerReceivableBps,
    pricing.developer_receivable_bps
  )
  const authorizationDeveloperReceivableCents = readNumber(
    pricing.developerReceivableCents,
    pricing.developer_receivable_cents
  )

  if (pricing.kind !== "one_time_authorization") {
    errors.push("授权费类型不合规。")
  }
  if (!isNonNegativeInteger(authorizationFeeCents)) {
    errors.push("一次授权费必须是非负整数分。")
  }
  if (authorizationCurrency !== "CNY") {
    errors.push("一次授权费币种必须是 CNY。")
  }
  if (authorizationPlatformFeeBps !== 0) {
    errors.push("授权费分账不合规。")
  }
  if (authorizationDeveloperReceivableBps !== 10000) {
    errors.push("授权费应收不合规。")
  }
  if (
    authorizationDeveloperReceivableCents !== undefined &&
    authorizationDeveloperReceivableCents !== authorizationFeeCents
  ) {
    errors.push("授权费应收金额不合规。")
  }

  const tokenCurrency = roleTokenPricing.currency
  const inputCentsPerMillion = readNumber(
    roleTokenPricing.inputTokenCentsPerMillion,
    roleTokenPricing.input_token_cents_per_million,
    roleTokenPricing.inputCentsPerMillion,
    roleTokenPricing.input_cents_per_million
  )
  const outputCentsPerMillion = readNumber(
    roleTokenPricing.outputTokenCentsPerMillion,
    roleTokenPricing.output_token_cents_per_million,
    roleTokenPricing.outputCentsPerMillion,
    roleTokenPricing.output_cents_per_million
  )
  const tokenPlatformFeeBps = readNumber(
    roleTokenPricing.platformFeeBps,
    roleTokenPricing.platform_fee_bps
  )
  const tokenDeveloperReceivableBps = readNumber(
    roleTokenPricing.developerReceivableBps,
    roleTokenPricing.developer_receivable_bps
  )

  if (
    !isNonNegativeInteger(inputCentsPerMillion) ||
    inputCentsPerMillion < PLATFORM_INPUT_TOKEN_COST_CENTS_PER_MILLION
  ) {
    errors.push("输入 Token 使用费不能低于平台成本 ¥1.20/百万。")
  }
  if (
    !isNonNegativeInteger(outputCentsPerMillion) ||
    outputCentsPerMillion < PLATFORM_OUTPUT_TOKEN_COST_CENTS_PER_MILLION
  ) {
    errors.push("输出 Token 使用费不能低于平台成本 ¥3.60/百万。")
  }
  if (
    isNonNegativeInteger(inputCentsPerMillion) &&
    inputCentsPerMillion >
      PLATFORM_INPUT_TOKEN_COST_CENTS_PER_MILLION * PLATFORM_TOKEN_MAX_MARKUP_MULTIPLIER
  ) {
    errors.push("输入 Token 使用费超过平台最大倍率 20x。")
  }
  if (
    isNonNegativeInteger(outputCentsPerMillion) &&
    outputCentsPerMillion >
      PLATFORM_OUTPUT_TOKEN_COST_CENTS_PER_MILLION * PLATFORM_TOKEN_MAX_MARKUP_MULTIPLIER
  ) {
    errors.push("输出 Token 使用费超过平台最大倍率 20x。")
  }
  if (tokenCurrency !== "CNY") {
    errors.push("Token 使用费币种必须是 CNY。")
  }
  if (tokenPlatformFeeBps !== 0) {
    errors.push("Token 使用费分账不合规。")
  }
  if (tokenDeveloperReceivableBps !== 10000) {
    errors.push("Token 使用费应收不合规。")
  }

  return errors
}

const formatCents = (value?: number) => {
  if (!isNonNegativeInteger(value)) {
    return "-"
  }

  return `¥${(value / 100).toFixed(2)}`
}

const getPricingSummary = (role: DijieRoleMetadata) => {
  const pricing = asRecord(role.pricing)
  const roleTokenPricing = getRoleTokenPricing(role)
  const authorizationFeeCents = readNumber(
    pricing.authorizationFeeCents,
    pricing.authorization_fee_cents,
    pricing.amountCents,
    pricing.amount_cents,
    role.authorizationFeeCents
  )
  const inputCentsPerMillion = readNumber(
    roleTokenPricing.inputTokenCentsPerMillion,
    roleTokenPricing.input_token_cents_per_million,
    roleTokenPricing.inputCentsPerMillion,
    roleTokenPricing.input_cents_per_million
  )
  const outputCentsPerMillion = readNumber(
    roleTokenPricing.outputTokenCentsPerMillion,
    roleTokenPricing.output_token_cents_per_million,
    roleTokenPricing.outputCentsPerMillion,
    roleTokenPricing.output_cents_per_million
  )

  return [
    `授权 ${formatCents(authorizationFeeCents)}`,
    `输入 ${formatCents(inputCentsPerMillion)}/百万`,
    `输出 ${formatCents(outputCentsPerMillion)}/百万`,
  ].join(" · ")
}

const getSubmittedAt = (product: HttpTypes.AdminProduct, role: DijieRoleMetadata) => {
  return readString(
    role.submittedAt,
    (role as Record<string, unknown>).submitted_at,
    product.updated_at,
    product.created_at
  )
}

const formatSubmittedAt = (value?: string) => {
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

const getPackageStatus = (role: DijieRoleMetadata) => {
  const packageId = readString(role.packageId, role.package_id)
  const packageVersion = readString(role.packageVersion, role.package_version)

  if (packageId && packageVersion) {
    return {
      color: "green" as const,
      label: "已提交",
      ready: true,
    }
  }

  if (packageId || packageVersion) {
    return {
      color: "orange" as const,
      label: "信息不完整",
      ready: false,
    }
  }

  return {
    color: "red" as const,
    label: "未提交",
    ready: false,
  }
}

const getReviewConclusion = ({
  readyToApprove,
  securityPassed,
  pricePassed,
  packageReady,
}: {
  readyToApprove: boolean
  securityPassed: boolean
  pricePassed: boolean
  packageReady: boolean
}) => {
  if (readyToApprove) {
    return {
      color: "green" as const,
      label: "可进入人工通过确认",
    }
  }

  if (!packageReady) {
    return {
      color: "red" as const,
      label: "资料包需处理",
    }
  }

  if (!securityPassed) {
    return {
      color: "red" as const,
      label: "安全摘要需处理",
    }
  }

  if (!pricePassed) {
    return {
      color: "red" as const,
      label: "价格授权需处理",
    }
  }

  return {
    color: "orange" as const,
    label: "等待人工复核",
  }
}

export const ProductRoleReviewSection = ({
  product,
}: {
  product: HttpTypes.AdminProduct
}) => {
  const role = getRoleMetadata(product)
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectReasonError, setRejectReasonError] = useState("")

  if (!role) {
    return null
  }

  const reviewState = getReviewState(role)
  const listingStatus = getListingStatus(role)
  const canApprove = reviewState === "submitted" && listingStatus === "proposed"
  const canReject = reviewState === "submitted"
  const pricingErrors = validateRolePricing(role)
  const pricePassed = pricingErrors.length === 0
  const packageStatus = getPackageStatus(role)
  const sensitiveBlocked = hasSensitiveReviewKeys(role)
  const localPathBlocked = hasLocalPathValue(role)
  const securityPassed = !sensitiveBlocked && !localPathBlocked
  const riskPassed = securityPassed && packageStatus.ready
  const readyToApprove = securityPassed && pricePassed && packageStatus.ready
  const reviewConclusion = getReviewConclusion({
    readyToApprove,
    securityPassed,
    pricePassed,
    packageReady: packageStatus.ready,
  })

  const openApproveDialog = () => {
    if (!readyToApprove) {
      toast.error("暂不能通过", {
        description: "请先处理岗位包、价格或安全扫描问题。",
      })
      return
    }

    setIsApproveOpen(true)
  }

  const openRejectDialog = () => {
    setRejectReason("")
    setRejectReasonError("")
    setIsRejectOpen(true)
  }

  const handleReject = async () => {
    const reason = rejectReason.trim()

    if (!reason) {
      setRejectReasonError("请输入驳回原因。")
      return
    }

    toast.info("已停在人类确认点", {
      description: "驳回原因已在本页确认，未自动写入或通知开发者。",
    })
    setIsRejectOpen(false)
  }

  return (
    <Container className="divide-y p-0" data-testid="product-role-review-section">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Heading level="h2">岗位审核</Heading>
            <Tooltip content="只展示公开摘要与扫描结论。">
              <InformationCircle className="text-ui-fg-muted" />
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-x-2">
          {canReject && (
            <Button
              size="small"
              variant="secondary"
              onClick={openRejectDialog}
              data-testid="product-role-review-reject-button"
            >
              <ExclamationCircle />
              驳回
            </Button>
          )}
          {canApprove && (
            <Button
              size="small"
              variant="secondary"
              onClick={openApproveDialog}
              disabled={!readyToApprove}
              data-testid="product-role-review-approve-button"
            >
              <CheckCircle />
              通过
            </Button>
          )}
        </div>
      </div>
      <SectionRow
        title="审核状态"
        value={
          <div className="flex flex-col gap-y-1">
            <StatusBadge color={statusColor(reviewState)}>
              {REVIEW_STATE_LABELS[reviewState] ?? reviewState}
            </StatusBadge>
            <Text size="small" className="text-ui-fg-subtle">
              通过或驳回只停在人工确认，不自动发布、不自动写入。
            </Text>
          </div>
        }
      />
      <SectionRow
        title="资料包校验"
        value={
          <StatusBadge color={packageStatus.color}>
            {packageStatus.label}
          </StatusBadge>
        }
      />
      <SectionRow
        title="公开材料"
        value={
          <div className="flex flex-col gap-y-1">
            <Text size="small" className="text-ui-fg-base">
              {readPublicString(role.title, product.title) ?? "-"}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              副标题：{readPublicString(role.subtitle, product.subtitle) ?? "-"}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              描述：{readPublicString(role.description, product.description) ?? "-"}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              能力：{joinPublicStrings(role.capabilities)}
            </Text>
          </div>
        }
      />
      <SectionRow
        title="安全摘要"
        value={
          <div className="flex flex-col gap-y-1">
            <StatusBadge color={securityPassed ? "green" : "red"}>
              {securityPassed ? "通过" : "需处理"}
            </StatusBadge>
            <Text size="small" className="text-ui-fg-subtle">
              敏感字段：{sensitiveBlocked ? "命中" : "未命中"}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              路径风险：{localPathBlocked ? "命中" : "未命中"}
            </Text>
          </div>
        }
      />
      <SectionRow
        title="执行风险"
        value={
          <StatusBadge color={riskPassed ? "green" : "red"}>
            {riskPassed ? "低风险" : "需处理"}
          </StatusBadge>
        }
      />
      <SectionRow
        title="价格授权检查"
        value={
          pricingErrors.length === 0 ? (
            <div className="flex flex-col gap-y-1">
              <StatusBadge color="green">合规</StatusBadge>
              <Text size="small" className="text-ui-fg-subtle">
                {getPricingSummary(role)}
              </Text>
            </div>
          ) : (
            <div className="flex flex-col gap-y-1">
              <StatusBadge color="red">需处理</StatusBadge>
              {pricingErrors.map((error) => (
                <Text key={error} size="small" className="text-ui-fg-subtle">
                  {error}
                </Text>
              ))}
            </div>
          )
        }
      />
      <SectionRow
        title="提交时间"
        value={formatSubmittedAt(getSubmittedAt(product, role))}
      />
      <SectionRow
        title="审核结论"
        value={
          <div className="flex flex-col gap-y-1">
            <StatusBadge color={reviewConclusion.color}>
              {reviewConclusion.label}
            </StatusBadge>
            <Text size="small" className="text-ui-fg-subtle">
              最终通过或驳回需在人工确认后由后端审批流程执行。
            </Text>
          </div>
        }
      />
      <RejectReviewDialog
        open={isRejectOpen}
        reason={rejectReason}
        error={rejectReasonError}
        onOpenChange={setIsRejectOpen}
        onReasonChange={(value) => {
          setRejectReason(value)
          if (value.trim()) {
            setRejectReasonError("")
          }
        }}
        onConfirm={handleReject}
      />
      <ApproveReviewDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        onConfirm={() => {
          toast.info("已停在人类确认点", {
            description: "审核通过已在本页确认，未自动发布到岗位商城。",
          })
          setIsApproveOpen(false)
        }}
      />
    </Container>
  )
}

const ApproveReviewDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) => {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ui-bg-overlay fixed inset-0 z-50" />
        <RadixDialog.Content className="bg-ui-bg-base shadow-elevation-modal fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col divide-y overflow-hidden rounded-lg">
          <div className="flex flex-col gap-y-1 px-6 py-4">
            <RadixDialog.Title asChild>
              <Heading level="h2">确认通过审核</Heading>
            </RadixDialog.Title>
            <RadixDialog.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                这里是人工确认点。确认后不会自动发布、不会写入状态，需由后端审批流程执行最终动作。
              </Text>
            </RadixDialog.Description>
          </div>
          <div className="flex items-center justify-end gap-x-2 px-6 py-4">
            <RadixDialog.Close asChild>
              <Button size="small" variant="secondary">
                取消
              </Button>
            </RadixDialog.Close>
            <Button
              size="small"
              variant="secondary"
              onClick={onConfirm}
              data-testid="product-role-review-approve-confirm-button"
            >
              已人工确认
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

const RejectReviewDialog = ({
  open,
  reason,
  error,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: {
  open: boolean
  reason: string
  error: string
  onOpenChange: (open: boolean) => void
  onReasonChange: (value: string) => void
  onConfirm: () => void
}) => {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="bg-ui-bg-overlay fixed inset-0 z-50" />
        <RadixDialog.Content className="bg-ui-bg-base shadow-elevation-modal fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col divide-y overflow-hidden rounded-lg">
          <div className="flex flex-col gap-y-1 px-6 py-4">
            <RadixDialog.Title asChild>
              <Heading level="h2">确认驳回审核</Heading>
            </RadixDialog.Title>
            <RadixDialog.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                这里是人工确认点。确认后不会自动写入或通知开发者，需由后端审批流程执行最终动作。
              </Text>
            </RadixDialog.Description>
          </div>
          <div className="flex flex-col gap-y-2 px-6 py-4">
            <Textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="填写需要开发者修正的原因"
              data-testid="product-role-review-reject-reason"
            />
            <div className="flex flex-wrap gap-2">
              {REJECTION_REASON_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="small"
                  variant="secondary"
                  type="button"
                  onClick={() => onReasonChange(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            {error && (
              <Text size="small" className="text-ui-fg-error">
                {error}
              </Text>
            )}
          </div>
          <div className="flex items-center justify-end gap-x-2 px-6 py-4">
            <RadixDialog.Close asChild>
              <Button size="small" variant="secondary">
                取消
              </Button>
            </RadixDialog.Close>
            <Button
              size="small"
              variant="secondary"
              onClick={onConfirm}
              data-testid="product-role-review-reject-confirm-button"
            >
              已人工确认
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
