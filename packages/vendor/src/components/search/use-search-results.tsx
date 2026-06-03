import { HttpTypes } from "@medusajs/types"
import { keepPreviousData } from "@tanstack/react-query"
import { TFunction } from "i18next"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useOrders,
  useProducts,
} from "../../hooks/api"
import { Shortcut, ShortcutType } from "../../providers/keybind-provider"
import { useGlobalShortcuts } from "../../providers/keybind-provider/hooks"
import { DynamicSearchResult, SearchArea } from "./types"

type UseSearchProps = {
  q?: string
  limit: number
  area?: SearchArea
}

export const useSearchResults = ({
  q,
  limit,
  area = "all",
}: UseSearchProps) => {
  const staticResults = useStaticSearchResults(area)
  const { dynamicResults, isFetching } = useDynamicSearchResults(area, limit, q)

  return {
    staticResults,
    dynamicResults,
    isFetching,
  }
}

const useStaticSearchResults = (currentArea: SearchArea) => {
  const globalCommands = useGlobalShortcuts()

  const results = useMemo(() => {
    const groups = new Map<ShortcutType, Shortcut[]>()

    globalCommands.forEach((command) => {
      const group = groups.get(command.type) || []
      group.push(command)
      groups.set(command.type, group)
    })

    let filteredGroups: [ShortcutType, Shortcut[]][]

    switch (currentArea) {
      case "all":
        filteredGroups = Array.from(groups)
        break
      case "navigation":
        filteredGroups = Array.from(groups).filter(
          ([type]) => type === "pageShortcut" || type === "settingShortcut"
        )
        break
      case "command":
        filteredGroups = Array.from(groups).filter(
          ([type]) => type === "commandShortcut"
        )
        break
      default:
        filteredGroups = []
    }

    return filteredGroups.map(([title, items]) => ({
      title,
      items,
    }))
  }, [globalCommands, currentArea])

  return results
}

const useDynamicSearchResults = (
  currentArea: SearchArea,
  limit: number,
  q?: string
) => {
  const { t } = useTranslation()

  const debouncedSearch = useDebouncedSearch(q, 300)

  const orderResponse = useOrders(
    {
      q: debouncedSearch?.replace(/^#/, ""), // Since we display the ID with a # prefix, it's natural for the user to include it in the search. This will however cause no results to be returned, so we remove the # prefix from the search query.
      limit,
      fields: "id,display_id,email",
    },
    {
      enabled: isAreaEnabled(currentArea, "order"),
      placeholderData: keepPreviousData,
    }
  )

  const productResponse = useProducts(
    {
      q: debouncedSearch,
      limit,
      // TODO: Remove exclusion once we avoid including unnecessary relations by default in the query config
      fields:
        "id,title,thumbnail,-type,-collection,-options,-tags,-images,-variants,-sales_channels",
    },
    {
      enabled: isAreaEnabled(currentArea, "product"),
      placeholderData: keepPreviousData,
    }
  )

  const responseMap = useMemo(
    () => ({
      order: orderResponse,
      product: productResponse,
    }),
    [orderResponse, productResponse]
  )

  const results = useMemo(() => {
    const groups = Object.entries(responseMap)
      .map(([key, response]) => {
        const area = key as SearchArea
        if (isAreaEnabled(currentArea, area) || currentArea === "all") {
          return transformDynamicSearchResults(area, limit, t, response)
        }
        return null
      })
      .filter(Boolean) // Remove null values

    return groups
  }, [responseMap, currentArea, limit, t])

  const isAreaFetching = useCallback(
    (area: SearchArea): boolean => {
      if (area === "all") {
        return Object.values(responseMap).some(
          (response) => response.isFetching
        )
      }

      return (
        isAreaEnabled(currentArea, area) &&
        responseMap[area as keyof typeof responseMap]?.isFetching
      )
    },
    [currentArea, responseMap]
  )

  const isFetching = useMemo(() => {
    return isAreaFetching(currentArea)
  }, [currentArea, isAreaFetching])

  const dynamicResults = q
    ? (results.filter(
        (group) => !!group && group.items.length > 0
      ) as DynamicSearchResult[])
    : []

  return {
    dynamicResults,
    isFetching,
  }
}

const useDebouncedSearch = (value: string | undefined, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function isAreaEnabled(area: SearchArea, currentArea: SearchArea) {
  if (area === "all") {
    return true
  }
  if (area === currentArea) {
    return true
  }
  return false
}

type TransformMap = {
  [K in SearchArea]?: {
    dataKey: string
    transform: (item: any) => {
      id: string
      title: string
      subtitle?: string
      to: string
      value: string
      thumbnail?: string
    }
  }
}

const transformMap: TransformMap = {
  order: {
    dataKey: "orders",
    transform: (order: HttpTypes.AdminOrder) => ({
      id: order.id,
      title: `#${order.display_id}`,
      subtitle: order.email ?? undefined,
      to: `/orders/${order.id}`,
      value: `order:${order.id}`,
    }),
  },
  product: {
    dataKey: "products",
    transform: (product: HttpTypes.AdminProduct) => ({
      id: product.id,
      title: product.title,
      to: `/products/${product.id}`,
      thumbnail: product.thumbnail ?? undefined,
      value: `product:${product.id}`,
    }),
  },
}

function transformDynamicSearchResults<T extends { count: number }>(
  type: SearchArea,
  limit: number,
  t: TFunction,
  response?: T
): DynamicSearchResult | undefined {
  if (!response || !transformMap[type]) {
    return undefined
  }

  const { dataKey, transform } = transformMap[type]!
  const data = response[dataKey as keyof T]

  if (!data || !Array.isArray(data)) {
    return undefined
  }

  return {
    title: t(`app.search.groups.${type}`),
    area: type,
    hasMore: response.count > limit,
    count: response.count,
    items: data.map(transform),
  }
}
