import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { createDataTableFilterHelper } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { useDataTableDateFilters } from "../../../../../components/data-table/helpers/general/use-data-table-date-filters"

const filterHelper = createDataTableFilterHelper<HttpTypes.AdminProduct>()

/**
 * Hook to create filters in the format expected by @medusajs/ui DataTable
 */
export const useProductTableFilters = () => {
  const { t } = useTranslation()
  const dateFilters = useDataTableDateFilters()

  return useMemo(() => {
    const filters = [...dateFilters]
    filters.push(
      filterHelper.accessor("status", {
        label: "审核状态",
        type: "multiselect",
        options: [
          {
            label: t("products.productStatus.draft"),
            value: "draft",
          },
          {
            label: t("products.productStatus.proposed"),
            value: "proposed",
          },
          {
            label: t("products.productStatus.published"),
            value: "published",
          },
          {
            label: t("products.productStatus.rejected"),
            value: "rejected",
          },
        ],
      })
    )

    return filters
  }, [dateFilters, t])
}
