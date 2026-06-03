import { HttpTypes } from "@medusajs/types"
import { Container, Heading, Text } from "@medusajs/ui"

import { getLocaleAmount } from "@lib/money-amount-helpers"

type OrderSummarySectionProps = {
  order: HttpTypes.AdminOrder
}

export const OrderSummarySection = ({ order }: OrderSummarySectionProps) => {
  const items = order.items ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">销售内容</Heading>
      </div>
      <div className="divide-y">
        {items.length ? (
          items.map((item) => (
            <RoleSaleItem
              key={item.id}
              item={item}
              currencyCode={order.currency_code}
            />
          ))
        ) : (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-subtle">
              暂无明细
            </Text>
          </div>
        )}
      </div>
      <SaleTotal label="小计" value={order.subtotal} currencyCode={order.currency_code} />
      <SaleTotal label="税费" value={order.tax_total} currencyCode={order.currency_code} />
      <SaleTotal label="实收" value={order.total} currencyCode={order.currency_code} strong />
    </Container>
  )
}

const RoleSaleItem = ({
  item,
  currencyCode,
}: {
  item: HttpTypes.AdminOrderLineItem
  currencyCode: string
}) => {
  return (
    <div className="grid grid-cols-[1fr_120px_120px] items-center gap-x-4 px-6 py-4">
      <div className="min-w-0">
        <Text size="small" weight="plus" className="truncate">
          {item.title || item.product_title || "岗位授权"}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {item.quantity} 次
        </Text>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {getLocaleAmount(item.unit_price, currencyCode)}
      </Text>
      <Text size="small" weight="plus" className="text-right">
        {getLocaleAmount(item.original_total || 0, currencyCode)}
      </Text>
    </div>
  )
}

const SaleTotal = ({
  label,
  value,
  currencyCode,
  strong = false,
}: {
  label: string
  value?: number | null
  currencyCode: string
  strong?: boolean
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <Text size="small" weight={strong ? "plus" : "regular"}>
        {label}
      </Text>
      <Text size="small" weight={strong ? "plus" : "regular"}>
        {getLocaleAmount(value || 0, currencyCode)}
      </Text>
    </div>
  )
}
