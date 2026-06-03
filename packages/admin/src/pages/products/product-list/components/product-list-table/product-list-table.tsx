import { CogSixTooth, InformationCircle } from "@medusajs/icons";
import { Container, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { ReactNode, useMemo, Children } from "react";
import { Link, Outlet, useLoaderData } from "react-router-dom";

import { HttpTypes } from "@medusajs/types";
import { _DataTable } from "../../../../../components/table/data-table";
import { useProducts } from "../../../../../hooks/api/products";
import { useProductTableQuery } from "../../../../../hooks/table/query/use-product-table-query";
import { useDataTable } from "../../../../../hooks/use-data-table";
import { productsLoader } from "../../loader";

const PAGE_SIZE = 20;

export const ProductListTitle = () => {
  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center gap-x-2">
        <Heading level="h2" data-testid="products-list-title">
          岗位审核
        </Heading>
        <Tooltip content="只展示公开摘要与扫描结论。">
          <InformationCircle className="text-ui-fg-muted" />
        </Tooltip>
      </div>
    </div>
  );
};

export const ProductListActions = ({ children }: { children?: ReactNode }) => {
  return (
    <div
      className="flex items-center justify-center gap-x-2"
      data-testid="products-list-actions"
    >
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <StatusBadge color="orange">审核队列</StatusBadge>
          <Tooltip content="审核中心设置">
            <Link
              to="/settings/marketplace"
              className="text-ui-fg-muted hover:text-ui-fg-base"
              aria-label="审核中心设置"
            >
              <CogSixTooth />
            </Link>
          </Tooltip>
        </>
      )}
    </div>
  );
};

export const ProductListHeader = ({ children }: { children?: ReactNode }) => {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      data-testid="products-list-header"
    >
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListTitle />
          <ProductListActions />
        </>
      )}
    </div>
  );
};

export const ProductListDataTable = () => {
  const initialData = useLoaderData() as Awaited<
    ReturnType<ReturnType<typeof productsLoader>>
  >;

  const { searchParams, raw } = useProductTableQuery({ pageSize: PAGE_SIZE });
  const { products, isLoading, isError, error } = useProducts(
    {
      ...searchParams,
      is_giftcard: false,
    },
    {
      initialData,
      placeholderData: keepPreviousData,
    },
  );

  const columns = useColumns();
  const reviewProducts = ((products ?? []) as HttpTypes.AdminProduct[]).filter(
    (product) => Boolean(getRoleMetadata(product)),
  );

  const { table } = useDataTable({
    data: reviewProducts,
    columns,
    count: reviewProducts.length,
    enablePagination: true,
    pageSize: PAGE_SIZE,
    getRowId: (row) => row.id,
  });

  if (isError) {
    throw error;
  }

  return (
    <div data-testid="products-data-table">
      <_DataTable
        table={table}
        columns={columns}
        count={reviewProducts.length}
        pageSize={PAGE_SIZE}
        search
        pagination
        isLoading={isLoading}
        queryObject={raw}
        navigateTo={(row) => `${row.original.id}`}
        orderBy={[{ key: "title", label: "岗位名称" }]}
        noRecords={{
          message: "暂无待审核岗位。",
        }}
      />
    </div>
  );
};

export const ProductListTable = ({ children }: { children?: ReactNode }) => {
  return (
    <Container className="divide-y p-0" data-testid="products-list-table">
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListHeader />
          <ProductListDataTable />
        </>
      )}
      <Outlet />
    </Container>
  );
};

const columnHelper = createColumnHelper<HttpTypes.AdminProduct>();

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const getRoleMetadata = (product: HttpTypes.AdminProduct) => {
  const role = asRecord(asRecord(product.metadata).dijieRole);
  return Object.keys(role).length ? role : null;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const getReviewState = (product: HttpTypes.AdminProduct) => {
  const role = getRoleMetadata(product);
  return role?.reviewState ?? role?.review_state ?? product.status ?? "draft";
};

const getSubmittedAt = (product: HttpTypes.AdminProduct) => {
  const role = getRoleMetadata(product);
  return readString(
    role?.submittedAt,
    role?.submitted_at,
    role?.updatedAt,
    role?.updated_at,
    product.updated_at,
    product.created_at
  );
};

const formatShortDate = (value?: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getPackageStatus = (product: HttpTypes.AdminProduct) => {
  const role = getRoleMetadata(product);
  const packageId = readString(role?.packageId, role?.package_id);
  const packageVersion = readString(role?.packageVersion, role?.package_version);

  if (packageId && packageVersion) {
    return {
      color: "green" as const,
      label: "已提交",
    };
  }

  if (packageId || packageVersion) {
    return {
      color: "orange" as const,
      label: "信息不完整",
    };
  }

  return {
    color: "red" as const,
    label: "未提交",
  };
};

const reviewStateLabel = (state: unknown) => {
  switch (state) {
    case "submitted":
    case "proposed":
      return "待审核";
    case "approved":
    case "published":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "草稿";
  }
};

const reviewStateColor = (state: unknown) => {
  switch (state) {
    case "submitted":
    case "proposed":
      return "orange";
    case "approved":
    case "published":
      return "green";
    case "rejected":
      return "red";
    default:
      return "grey";
  }
};

const hasSensitiveReviewKeys = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasSensitiveReviewKeys);
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase();
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
        return true;
      }

      return hasSensitiveReviewKeys(nestedValue);
    },
  );
};

const hasLocalPathValue = (value: unknown): boolean => {
  if (typeof value === "string") {
    return (
      value.startsWith("/") ||
      value.startsWith("~") ||
      /^[A-Za-z]:[\\/]/.test(value) ||
      value.split(/[\\/]/).includes("..")
    );
  }

  if (Array.isArray(value)) {
    return value.some(hasLocalPathValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasLocalPathValue);
  }

  return false;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const isNonNegativeInteger = (value: unknown) => {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
};

const validateRolePricing = (role: Record<string, unknown> | null) => {
  if (!role) {
    return ["缺少岗位价格信息。"];
  }

  const pricing = asRecord(role.pricing);
  const roleTokenPricing = asRecord(role.roleTokenPricing ?? role.role_token_pricing);
  const authorizationFeeCents = readNumber(
    pricing.authorizationFeeCents,
    pricing.authorization_fee_cents,
    pricing.amountCents,
    pricing.amount_cents,
    role.authorizationFeeCents
  );
  const authorizationCurrency = pricing.currency ?? "CNY";
  const authorizationPlatformFeeBps = readNumber(
    pricing.platformFeeBps,
    pricing.platform_fee_bps
  );
  const authorizationDeveloperReceivableBps = readNumber(
    pricing.developerReceivableBps,
    pricing.developer_receivable_bps
  );
  const tokenCurrency = roleTokenPricing.currency;
  const inputCentsPerMillion = readNumber(
    roleTokenPricing.inputTokenCentsPerMillion,
    roleTokenPricing.input_token_cents_per_million,
    roleTokenPricing.inputCentsPerMillion,
    roleTokenPricing.input_cents_per_million
  );
  const outputCentsPerMillion = readNumber(
    roleTokenPricing.outputTokenCentsPerMillion,
    roleTokenPricing.output_token_cents_per_million,
    roleTokenPricing.outputCentsPerMillion,
    roleTokenPricing.output_cents_per_million
  );
  const tokenPlatformFeeBps = readNumber(
    roleTokenPricing.platformFeeBps,
    roleTokenPricing.platform_fee_bps
  );
  const tokenDeveloperReceivableBps = readNumber(
    roleTokenPricing.developerReceivableBps,
    roleTokenPricing.developer_receivable_bps
  );

  return [
    pricing.kind === "one_time_authorization" ? null : "授权费类型不合规。",
    isNonNegativeInteger(authorizationFeeCents) ? null : "授权费金额不合规。",
    authorizationCurrency === "CNY" ? null : "授权费币种不合规。",
    authorizationPlatformFeeBps === 0 ? null : "授权费分账不合规。",
    authorizationDeveloperReceivableBps === 10000 ? null : "授权费应收不合规。",
    isNonNegativeInteger(inputCentsPerMillion) ? null : "输入计费不合规。",
    isNonNegativeInteger(outputCentsPerMillion) ? null : "输出计费不合规。",
    tokenCurrency === "CNY" ? null : "模型计费币种不合规。",
    tokenPlatformFeeBps === 0 ? null : "模型计费分账不合规。",
    tokenDeveloperReceivableBps === 10000 ? null : "模型计费应收不合规。",
  ].filter((error): error is string => Boolean(error));
};

const useColumns = () => {
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "role",
        header: "岗位名称",
        cell: ({ row }) => {
          const role = getRoleMetadata(row.original);
          const title = readString(role?.title, row.original.title) ?? "-";

          return (
            <Text size="small" weight="plus" className="truncate">
              {title}
            </Text>
          );
        },
      }),
      columnHelper.display({
        id: "seller",
        header: "开发者",
        cell: ({ row }) => {
          const seller = (row.original as any).seller;
          return (
            <Text size="small" className="truncate">
              {seller?.name || "-"}
            </Text>
          );
        },
      }),
      columnHelper.display({
        id: "reviewState",
        header: "审核状态",
        cell: ({ row }) => {
          const state = getReviewState(row.original);
          return (
            <StatusBadge color={reviewStateColor(state)}>
              {reviewStateLabel(state)}
            </StatusBadge>
          );
        },
      }),
      columnHelper.display({
        id: "package",
        header: "资料包校验",
        cell: ({ row }) => {
          const status = getPackageStatus(row.original);
          return <StatusBadge color={status.color}>{status.label}</StatusBadge>;
        },
      }),
      columnHelper.display({
        id: "safetyScan",
        header: "泄露扫描",
        cell: ({ row }) => {
          const role = getRoleMetadata(row.original);
          const blocked = hasSensitiveReviewKeys(role) || hasLocalPathValue(role);
          return (
            <StatusBadge color={blocked ? "red" : "green"}>
              {blocked ? "需处理" : "通过"}
            </StatusBadge>
          );
        },
      }),
      columnHelper.display({
        id: "priceCompliance",
        header: "价格合规",
        cell: ({ row }) => {
          const errors = validateRolePricing(getRoleMetadata(row.original));
          return (
            <StatusBadge color={errors.length === 0 ? "green" : "red"}>
              {errors.length === 0 ? "合规" : "需处理"}
            </StatusBadge>
          );
        },
      }),
      columnHelper.display({
        id: "submittedAt",
        header: "提交时间",
        cell: ({ row }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {formatShortDate(getSubmittedAt(row.original))}
          </Text>
        ),
      }),
    ],
    [],
  );

  return columns;
};
