import { createColumnHelper } from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { PayoutDTO } from "@mercurjs/types"
import { StatusBadge } from "@medusajs/ui"
import {
  DateCell,
} from "../../../components/table/table-cells/common/date-cell"
import {
  DisplayIdCell,
} from "../../../components/table/table-cells/order/display-id-cell"
import { getStylizedAmount } from "../../../lib/money-amount-helpers"

const columnHelper = createColumnHelper<PayoutDTO>()

const payoutStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "green"
    case "processing":
      return "orange"
    case "pending":
      return "grey"
    case "failed":
    case "canceled":
      return "red"
    default:
      return "grey"
  }
}

export const usePayoutTableColumns = () => {
  const { t } = useTranslation()

  return useMemo(
    () => [
      columnHelper.accessor("display_id", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">结算单</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const displayId = getValue()
          return <DisplayIdCell displayId={displayId} />
        },
      }),
      columnHelper.accessor("created_at", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">提交时间</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const date = new Date(getValue())
          return <DateCell date={date} />
        },
      }),
      columnHelper.accessor("status", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">结算状态</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const status = getValue()
          return (
            <StatusBadge color={payoutStatusColor(status)}>
              {t(`payouts.status.${status}`, {
                defaultValue: status.charAt(0).toUpperCase() + status.slice(1),
              })}
            </StatusBadge>
          )
        },
      }),
      columnHelper.accessor("amount", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">结算金额</span>
          </div>
        ),
        cell: ({ getValue, row }) => {
          const amount = getValue() as number
          const currencyCode = row.original.currency_code
          return (
            <div className="text-ui-fg-subtle txt-compact-small flex h-full w-full items-center overflow-hidden">
              <span className="truncate">
                {getStylizedAmount(amount, currencyCode)}
              </span>
            </div>
          )
        },
      }),
    ],
    [t]
  )
}
