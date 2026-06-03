import type { HttpTypes } from "@medusajs/types";
import { useQueryParams } from "@hooks/use-query-params";

type UseProductTableQueryProps = {
  prefix?: string;
  pageSize?: number;
};

const DEFAULT_FIELDS = "id,title,status,metadata,seller.*";

export const useProductTableQuery = ({
  prefix,
  pageSize = 20,
}: UseProductTableQueryProps) => {
  const queryObject = useQueryParams(
    [
      "offset",
      "order",
      "q",
      "created_at",
      "updated_at",
      "is_giftcard",
      "status",
      "id",
      "seller_id",
    ],
    prefix,
  );

  const {
    offset,
    created_at,
    updated_at,
    is_giftcard,
    status,
    seller_id,
    order,
    q,
  } = queryObject;

  const searchParams = {
    limit: pageSize,
    offset: offset ? Number(offset) : 0,
    created_at: created_at ? JSON.parse(created_at) : undefined,
    updated_at: updated_at ? JSON.parse(updated_at) : undefined,
    is_giftcard: is_giftcard ? is_giftcard === "true" : undefined,
    order: order,
    status: status?.split(",") as HttpTypes.AdminProductStatus[],
    seller_id: seller_id ? seller_id.split(",") : undefined,
    q,
    fields: DEFAULT_FIELDS,
  };

  return {
    searchParams,
    raw: queryObject,
  };
};
