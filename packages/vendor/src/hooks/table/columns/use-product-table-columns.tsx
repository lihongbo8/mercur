import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  ProductCell,
  ProductHeader,
} from "../../../components/table/table-cells/product/product-cell";
import {
  ProductStatusCell,
  ProductStatusHeader,
} from "../../../components/table/table-cells/product/product-status-cell";
import {
  DateCell,
} from "../../../components/table/table-cells/common/date-cell";
import { HttpTypes } from "@mercurjs/types";

const columnHelper = createColumnHelper<HttpTypes.VendorProduct>();

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

const getRoleMetadata = (product: HttpTypes.VendorProduct) => {
  return ((product as any).metadata?.dijieRole ?? {}) as {
    pricing?: {
      authorizationFeeCents?: number;
    };
    roleTokenPricing?: {
      inputTokenCentsPerMillion?: number;
      outputTokenCentsPerMillion?: number;
    };
  };
};

export const useProductTableColumns = () => {
  return useMemo(
    () => [
      columnHelper.display({
        id: "product",
        header: () => <ProductHeader />,
        cell: ({ row }) => <ProductCell product={row.original} />,
      }),
      columnHelper.display({
        id: "authorization_fee",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">授权费</span>
          </div>
        ),
        cell: ({ row }) => {
          const role = getRoleMetadata(row.original);

          return (
            <span className="text-ui-fg-subtle txt-compact-small truncate">
              {formatCny(role.pricing?.authorizationFeeCents)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "usage_price",
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">调用单价</span>
          </div>
        ),
        cell: ({ row }) => {
          const role = getRoleMetadata(row.original);
          const price =
            role.roleTokenPricing?.outputTokenCentsPerMillion ??
            role.roleTokenPricing?.inputTokenCentsPerMillion;

          return (
            <span className="text-ui-fg-subtle txt-compact-small truncate">
              {price === undefined ? "-" : `${formatCny(price)} / 百万`}
            </span>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: () => <ProductStatusHeader />,
        cell: ({ row }) => <ProductStatusCell status={row.original.status} />,
      }),
      columnHelper.accessor("created_at", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">创建时间</span>
          </div>
        ),
        cell: ({ getValue }) => <DateCell date={new Date(getValue())} />,
      }),
    ],
    [],
  );
};
