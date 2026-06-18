import { InformationCircle } from "@medusajs/icons"
import { AdminStore } from "@medusajs/types"
import { Badge, Container, Heading, Text, Tooltip } from "@medusajs/ui"

import { useRegion } from "../../../../../hooks/api/regions"

type MarketplaceGeneralSectionProps = {
  store: AdminStore
}

export const MarketplaceGeneralSection = ({ store }: MarketplaceGeneralSectionProps) => {
  const { region } = useRegion(store.default_region_id!, undefined, {
    enabled: !!store.default_region_id,
  })

  const defaultCurrency = store.supported_currencies?.find((c) => c.is_default)

  return (
    <Container className="divide-y p-0" data-testid="store-general-section-container">
      <div className="flex items-center justify-between px-6 py-4" data-testid="store-general-section-header">
        <div className="flex items-center gap-x-2">
          <Heading data-testid="store-general-section-heading">审核中心设置</Heading>
          <Tooltip content="只读展示审核和计费基础项。">
            <InformationCircle className="text-ui-fg-muted" />
          </Tooltip>
        </div>
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 px-6 py-4" data-testid="store-general-section-name">
        <Text size="small" leading="compact" weight="plus" data-testid="store-general-section-name-label">
          审核中心
        </Text>
        <Text size="small" leading="compact" data-testid="store-general-section-name-value">
          {store.name}
        </Text>
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 px-6 py-4" data-testid="store-general-section-currency">
        <Text size="small" leading="compact" weight="plus" data-testid="store-general-section-currency-label">
          计费币种
        </Text>
        {defaultCurrency ? (
          <div className="flex items-center gap-x-2" data-testid="store-general-section-currency-value">
            <Badge size="2xsmall" data-testid="store-general-section-currency-badge">
              {defaultCurrency.currency_code?.toUpperCase()}
            </Badge>
            <Text size="small" leading="compact" data-testid="store-general-section-currency-name">
              {defaultCurrency.currency?.name}
            </Text>
          </div>
        ) : (
          <Text size="small" leading="compact" data-testid="store-general-section-currency-value">
            -
          </Text>
        )}
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 px-6 py-4" data-testid="store-general-section-region">
        <Text size="small" leading="compact" weight="plus" data-testid="store-general-section-region-label">
          计费地区
        </Text>
        <div className="flex items-center gap-x-2" data-testid="store-general-section-region-value">
          {region ? (
            <Badge size="2xsmall" data-testid="store-general-section-region-badge">
              {region.name}
            </Badge>
          ) : (
            <Text size="small" leading="compact">
              -
            </Text>
          )}
        </div>
      </div>
    </Container>
  )
}
