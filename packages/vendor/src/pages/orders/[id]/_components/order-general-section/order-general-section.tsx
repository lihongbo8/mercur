import { HttpTypes } from "@medusajs/types"
import {
  Container,
  Copy,
  Heading,
  StatusBadge,
  Text,
} from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { useDate } from "@hooks/use-date"
import {
  getCanceledOrderStatus,
  getOrderPaymentStatus,
} from "@lib/order-helpers"

type OrderGeneralSectionProps = {
  order: HttpTypes.AdminOrder
}

export const OrderGeneralSection = ({ order }: OrderGeneralSectionProps) => {
  const { t } = useTranslation()
  const { getFullDate } = useDate()

  return (
    <Container className="flex items-center justify-between px-6 py-4">
      <div>
        <div className="flex items-center gap-x-1">
          <Heading>#{order.display_id}</Heading>
          <Copy content={`#${order.display_id}`} className="text-ui-fg-muted" />
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {t("orders.onDateFromSalesChannel", {
            date: getFullDate({ date: order.created_at, includeTime: true }),
            salesChannel: order.sales_channel?.name,
          })}
        </Text>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="flex items-center gap-x-1.5">
          <OrderBadge order={order} />
          <PaymentBadge order={order} />
        </div>
      </div>
    </Container>
  )
}

const PaymentBadge = ({ order }: { order: HttpTypes.AdminOrder }) => {
  const { t } = useTranslation()

  if (!order.payment_status) {
    return null
  }

  const { label, color } = getOrderPaymentStatus(t, order.payment_status)

  return (
    <StatusBadge color={color} className="text-nowrap">
      {label}
    </StatusBadge>
  )
}

const OrderBadge = ({ order }: { order: HttpTypes.AdminOrder }) => {
  const { t } = useTranslation()
  const orderStatus = getCanceledOrderStatus(t, order.status)

  if (!orderStatus) {
    return null
  }

  return (
    <StatusBadge color={orderStatus.color} className="text-nowrap">
      {orderStatus.label}
    </StatusBadge>
  )
}
