import { HttpTypes } from "@medusajs/types"
import {
  ColumnDef,
  ColumnDefBase,
  createColumnHelper,
} from "@tanstack/react-table"
import { useMemo } from "react"
import {
  DateCell,
} from "../../../components/table/table-cells/common/date-cell"
import {
  CustomerCell,
} from "../../../components/table/table-cells/order/customer-cell"
import {
  DisplayIdCell,
} from "../../../components/table/table-cells/order/display-id-cell"
import { PaymentStatusCell } from "../../../components/table/table-cells/order/payment-status-cell"
import { TotalCell } from "../../../components/table/table-cells/order/total-cell"

// We have to use any here, as the type of Order is so complex that it lags the TS server
const columnHelper = createColumnHelper<HttpTypes.AdminOrder>()

type UseOrderTableColumnsProps = {
  exclude?: string[]
}

export const useOrderTableColumns = (props: UseOrderTableColumnsProps) => {
  const { exclude = [] } = props ?? {}

  const columns = useMemo(
    () => [
      columnHelper.accessor("display_id", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">记录编号</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const id = getValue()

          return <DisplayIdCell displayId={id!} />
        },
      }),
      columnHelper.accessor("created_at", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">成交时间</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const date = new Date(getValue())

          return <DateCell date={date} />
        },
      }),
      columnHelper.accessor("customer", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">客户</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const customer = getValue()

          return <CustomerCell customer={customer} />
        },
      }),
      columnHelper.accessor("payment_status", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">收款状态</span>
          </div>
        ),
        cell: ({ getValue }) => {
          const status = getValue()

          return <PaymentStatusCell status={status} />
        },
      }),
      columnHelper.accessor("total", {
        header: () => (
          <div className="flex h-full w-full items-center">
            <span className="truncate">金额</span>
          </div>
        ),
        cell: ({ getValue, row }) => {
            const isFullyRefunded = row.original.payment_status === "refunded"
            const total = !isFullyRefunded
              ? getValue()
              : row.original.payment_collections?.reduce(
                  (acc, payCol) => acc + (payCol.refunded_amount ?? 0),
                  0
                ) || 0
            const currencyCode = row.original.currency_code

            return (
              <TotalCell
                currencyCode={currencyCode}
                total={total}
                className={
                  isFullyRefunded ? "text-ui-fg-muted line-through" : ""
                }
              />
            )
        },
      }),
    ],
    []
  )

  const isAccessorColumnDef = (
    c: any
  ): c is ColumnDef<HttpTypes.AdminOrder> & { accessorKey: string } => {
    return c.accessorKey !== undefined
  }

  const isDisplayColumnDef = (
    c: any
  ): c is ColumnDef<HttpTypes.AdminOrder> & { id: string } => {
    return c.id !== undefined
  }

  const shouldExclude = <TDef extends ColumnDefBase<HttpTypes.AdminOrder, any>>(
    c: TDef
  ) => {
    if (isAccessorColumnDef(c)) {
      return exclude.includes(c.accessorKey)
    } else if (isDisplayColumnDef(c)) {
      return exclude.includes(c.id)
    }

    return false
  }

  return columns.filter(
    (c) => !shouldExclude(c)
  ) as ColumnDef<HttpTypes.AdminOrder>[]
}
