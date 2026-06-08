import { ArrowLongRight, CheckCircle, CloudArrowUp } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Text,
  Tooltip,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { Link } from "react-router-dom";

import { SectionRow } from "@components/common/section";
import { useProductDetailContext } from "../../context";

type RoleReviewState = "draft" | "submitted" | "approved" | "rejected";
type RoleListingStatus =
  | "draft"
  | "proposed"
  | "published"
  | "rejected"
  | "delisted"
  | "archived";

type RoleMetadata = Record<string, unknown> & {
  reviewState?: RoleReviewState;
  review_state?: RoleReviewState;
  listingStatus?: RoleListingStatus;
  listing_status?: RoleListingStatus;
  packageId?: string;
  package_id?: string;
  packageVersion?: string;
  package_version?: string;
  usageInstructions?: string;
  usage_instructions?: string;
  pricing?: Record<string, unknown>;
  reviewRejectionReason?: string;
  review_rejection_reason?: string;
};

const REVIEW_STATE_LABELS: Record<string, string> = {
  draft: "草稿",
  submitted: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};

const LISTING_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  proposed: "待上架",
  published: "已上架",
  rejected: "已驳回",
  delisted: "已下架",
  archived: "已归档",
};

const statusColor = (value?: string) => {
  switch (value) {
    case "approved":
    case "published":
      return "green";
    case "submitted":
    case "proposed":
      return "orange";
    case "rejected":
      return "red";
    default:
      return "grey";
  }
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const isLocalPathString = (value?: string) => {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") ||
    value.startsWith("~") ||
    value.startsWith("file://") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.split(/[\\/]/).includes("..")
  );
};

const readPublicString = (...values: unknown[]) => {
  const value = readString(...values);

  return value && !isLocalPathString(value) ? value : undefined;
};

const getRoleMetadata = (product: Record<string, unknown>) => {
  const metadata = asRecord(product.metadata);
  const role = asRecord(metadata.dijieRole);

  return Object.keys(role).length ? (role as RoleMetadata) : null;
};

const getReviewState = (role: RoleMetadata | null) => {
  return role?.reviewState ?? role?.review_state ?? "draft";
};

const getListingStatus = (role: RoleMetadata | null) => {
  return role?.listingStatus ?? role?.listing_status ?? "draft";
};

const formatCny = (cents?: number) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "-";
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDate = (value?: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getRoleSummary = (product: Record<string, unknown>) => {
  const role = getRoleMetadata(product);
  const pricing = asRecord(role?.pricing);
  const packageVersion = readPublicString(
    role?.packageVersion,
    role?.package_version,
  );
  const hasPackage = !!readPublicString(role?.packageId, role?.package_id);
  const authorizationFeeCents = readNumber(
    pricing.authorizationFeeCents,
    pricing.authorization_fee_cents,
    pricing.amountCents,
    pricing.amount_cents,
    (role as Record<string, unknown> | null)?.authorizationFeeCents,
  );

  return {
    role,
    hasPackage,
    packageVersion,
    reviewState: getReviewState(role),
    listingStatus: getListingStatus(role),
    rejectionReason: readPublicString(
      role?.reviewRejectionReason,
      role?.review_rejection_reason,
    ),
    usageInstructions: readPublicString(
      role?.usageInstructions,
      role?.usage_instructions,
    ),
    authorizationFeeCents,
  };
};

export const RoleGeneralSection = () => {
  const { product } = useProductDetailContext();
  const summary = getRoleSummary(product);

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="min-w-0">
          <Heading className="truncate">{product.title}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            开发者中心
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <StatusBadge color={statusColor(summary.reviewState)}>
            {REVIEW_STATE_LABELS[summary.reviewState] ?? summary.reviewState}
          </StatusBadge>
          <StatusBadge color={statusColor(summary.listingStatus)}>
            {LISTING_STATUS_LABELS[summary.listingStatus] ??
              summary.listingStatus}
          </StatusBadge>
        </div>
      </div>
      <SectionRow title="岗位名称" value={product.title || "-"} />
      <SectionRow
        title="资料包"
        value={
          summary.hasPackage
            ? summary.packageVersion
              ? `已上传 · ${summary.packageVersion}`
              : "已上传"
            : "未上传"
        }
      />
      <SectionRow title="版本" value={summary.packageVersion || "-"} />
      <SectionRow title="最近提交" value={formatDate(product.updated_at)} />
      {summary.reviewState === "rejected" && (
        <SectionRow title="驳回原因" value={summary.rejectionReason || "-"} />
      )}
      <SectionRow title="使用规范" value={summary.usageInstructions || "-"} />
    </Container>
  );
};

export const RolePricingSection = () => {
  const { product } = useProductDetailContext();
  const summary = getRoleSummary(product);

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">费用</Heading>
        <Tooltip content="只展示开发者可见的安全计费摘要">
          <Badge size="2xsmall">?</Badge>
        </Tooltip>
      </div>
      <SectionRow
        title="授权费"
        value={formatCny(summary.authorizationFeeCents)}
      />
      <SectionRow
        title="开发者应收"
        value="授权费按平台结算规则归集；执行费用由平台账本核算"
      />
    </Container>
  );
};

export const RoleActionSection = () => {
  const { product } = useProductDetailContext();
  const prompt = usePrompt();
  const summary = getRoleSummary(product);
  const canSubmit =
    summary.hasPackage &&
    summary.reviewState !== "submitted" &&
    summary.reviewState !== "approved";

  const handleSubmitReview = async () => {
    if (!summary.hasPackage) {
      toast.error("请先上传岗位包");
      return;
    }

    const confirmed = await prompt({
      title: "提交审核？",
      description: "当前只进入确认态，不会直接提交给平台审核。",
      confirmText: "停在确认态",
      cancelText: "取消",
    });

    if (confirmed) {
      toast.warning("已停在确认态，暂未提交审核。");
    }
  };

  return (
    <Container className="p-0">
      <div className="border-b px-6 py-4">
        <Heading level="h2">操作</Heading>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button variant="secondary" size="small" asChild>
          <Link to="/products/create" title="上传岗位包并创建新版本">
            <CloudArrowUp />
            重新上传
          </Link>
        </Button>
        <Button
          size="small"
          onClick={handleSubmitReview}
          disabled={!canSubmit}
          title={canSubmit ? "提交给审核中心" : "当前状态不可重复提交"}
        >
          <CheckCircle />
          提交审核
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/orders" title="查看岗位销售记录">
            <ArrowLongRight />
            销售记录
          </Link>
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/payouts" title="查看开发者结算记录">
            <ArrowLongRight />
            结算记录
          </Link>
        </Button>
      </div>
    </Container>
  );
};
