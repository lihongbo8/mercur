import { InformationCircle } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Badge, Container, Heading, Text, Tooltip } from "@medusajs/ui"
import type { ReactNode } from "react"

type MarketplaceCurrencySectionProps = {
  store: HttpTypes.AdminStore
}

export const MarketplaceCurrencySection = ({
  store,
}: MarketplaceCurrencySectionProps) => {
  const supportedCurrencies = store.supported_currencies ?? []
  const defaultCurrency = supportedCurrencies.find((currency) => currency.is_default)

  return (
    <Container className="divide-y p-0" data-testid="store-currency-section-container">
      <div className="flex items-center justify-between px-6 py-4" data-testid="store-currency-section-header">
        <div className="flex items-center gap-x-2">
          <Heading level="h2" data-testid="store-currency-section-heading">
            计费授权检查
          </Heading>
          <Tooltip content="只读展示审核中心允许的计费币种。">
            <InformationCircle className="text-ui-fg-muted" />
          </Tooltip>
        </div>
        <Badge size="2xsmall" color={supportedCurrencies.length ? "green" : "red"}>
          {supportedCurrencies.length ? "已配置" : "未配置"}
        </Badge>
      </div>
      <ReadonlyRow
        label="默认币种"
        value={defaultCurrency?.currency_code?.toUpperCase() ?? "-"}
      />
      <ReadonlyRow
        label="允许币种"
        value={
          supportedCurrencies.length ? (
            <div className="flex flex-wrap gap-2">
              {supportedCurrencies.map((currency) => (
                <Badge key={currency.currency_code} size="2xsmall">
                  {currency.currency_code.toUpperCase()}
                </Badge>
              ))}
            </div>
          ) : (
            "-"
          )
        }
      />
      <ReadonlyRow
        label="审核策略"
        value="岗位审核只允许 CNY 授权费和 CNY Token 使用费。"
      />
    </Container>
  )
}

const ReadonlyRow = ({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) => {
  return (
    <div className="text-ui-fg-subtle grid grid-cols-2 px-6 py-4">
      <Text size="small" leading="compact" weight="plus">
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text size="small" leading="compact">
          {value}
        </Text>
      ) : (
        value
      )}
    </div>
  )
}
