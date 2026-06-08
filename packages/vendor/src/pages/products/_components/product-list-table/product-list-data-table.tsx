import { StatusBadge } from "@medusajs/ui";
import { keepPreviousData } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { _DataTable } from "@components/table/data-table";
import {
  type DijieRoleListing,
  useDijieRoleListings,
} from "@hooks/api/dijie-role-listings";
import { useDataTable } from "@hooks/use-data-table";

export const PAGE_SIZE = 10;

const columnHelper = createColumnHelper<DijieRoleListing>();

const listingStatusLabels: Record<DijieRoleListing["listingStatus"], string> = {
  draft: "草稿",
  proposed: "待审核",
  published: "已上架",
  delisted: "已下架",
  archived: "已归档",
};

const reviewStateLabels: Record<DijieRoleListing["reviewState"], string> = {
  draft: "未提交",
  submitted: "审核中",
  needs_changes: "要求补充",
  approved: "已通过",
  rejected: "已驳回",
};

const listingStatusColors: Record<
  DijieRoleListing["listingStatus"],
  "grey" | "orange" | "green" | "red"
> = {
  draft: "grey",
  proposed: "orange",
  published: "green",
  delisted: "red",
  archived: "grey",
};

const reviewStateColors: Record<
  DijieRoleListing["reviewState"],
  "grey" | "orange" | "green" | "red"
> = {
  draft: "grey",
  submitted: "orange",
  needs_changes: "orange",
  approved: "green",
  rejected: "red",
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

const formatDate = (value?: string | null) => {
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

export const ProductListDataTable = () => {
  const { listings, count, isLoading, isError, error } = useDijieRoleListings({
    placeholderData: keepPreviousData,
  });

  const columns = useColumns();

  const { table } = useDataTable({
    data: listings,
    columns,
    count,
    enablePagination: true,
    pageSize: PAGE_SIZE,
    getRowId: (row) => row.roleListingId || row.id,
  });

  if (isError) {
    throw error;
  }

  return (
    <_DataTable
      table={table}
      columns={columns}
      count={count}
      pageSize={PAGE_SIZE}
      pagination
      isLoading={isLoading}
      noRecords={{
        message: "还没有云端岗位商品。请先在开发对话生成岗位包，再到上传岗位承接并提交审核。",
      }}
    />
  );
};

const useColumns = () => {
  return useMemo(
    () => [
      columnHelper.display({
        id: "role",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">岗位商品</span>
          </div>
        ),
        cell: ({ row }) => {
          const role = row.original;
          return (
            <div className="flex min-w-0 flex-col">
              <span className="txt-compact-small-plus truncate text-ui-fg-base">
                {role.title}
              </span>
              <span className="txt-compact-small truncate text-ui-fg-subtle">
                {role.packageId}@{role.packageVersion}
              </span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "listing_status",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">上架状态</span>
          </div>
        ),
        cell: ({ row }) => (
          <StatusBadge color={listingStatusColors[row.original.listingStatus]}>
            {listingStatusLabels[row.original.listingStatus]}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: "review_state",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">审核</span>
          </div>
        ),
        cell: ({ row }) => (
          <StatusBadge color={reviewStateColors[row.original.reviewState]}>
            {reviewStateLabels[row.original.reviewState]}
          </StatusBadge>
        ),
      }),
      columnHelper.display({
        id: "authorization_fee",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">授权费</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="txt-compact-small truncate text-ui-fg-subtle">
            {formatCny(row.original.pricing?.authorizationFeeCents)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "submitted_at",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">提交时间</span>
          </div>
        ),
        cell: ({ row }) => (
          <span className="txt-compact-small truncate text-ui-fg-subtle">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      }),
    ],
    [],
  );
};
