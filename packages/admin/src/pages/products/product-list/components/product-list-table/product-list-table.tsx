import { CogSixTooth, InformationCircle } from "@medusajs/icons"
import { Container, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui"
import { Children, ReactNode, useEffect, useMemo, useState } from "react"
import { Link, Outlet } from "react-router-dom"

import {
  fetchReviewCenter,
  type ReviewQueueItem,
} from "../../../../../lib/dijie/review-center"

const reviewStateColor = (state?: string) => {
  switch (state) {
    case "approved":
    case "published":
      return "green"
    case "submitted":
    case "proposed":
    case "needs_changes":
      return "orange"
    case "rejected":
    case "archived":
      return "red"
    default:
      return "grey"
  }
}

const formatSubmittedAt = (value?: string | null) => {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export const ProductListTitle = () => {
  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center gap-x-2">
        <Heading level="h2" data-testid="products-list-title">
          岗位审核
        </Heading>
        <Tooltip content="审核中心列表来自同一个 AICS 岗位商品审核队列。">
          <InformationCircle className="text-ui-fg-muted" />
        </Tooltip>
      </div>
    </div>
  )
}

export const ProductListActions = ({ children }: { children?: ReactNode }) => {
  return (
    <div
      className="flex items-center justify-center gap-x-2"
      data-testid="products-list-actions"
    >
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <StatusBadge color="orange">审核队列</StatusBadge>
          <Tooltip content="审核中心设置">
            <Link
              to="/settings/marketplace"
              className="text-ui-fg-muted hover:text-ui-fg-base"
              aria-label="审核中心设置"
            >
              <CogSixTooth />
            </Link>
          </Tooltip>
        </>
      )}
    </div>
  )
}

export const ProductListHeader = ({ children }: { children?: ReactNode }) => {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      data-testid="products-list-header"
    >
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListTitle />
          <ProductListActions />
        </>
      )}
    </div>
  )
}

export const ProductListDataTable = () => {
  const [roles, setRoles] = useState<ReviewQueueItem[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchReviewCenter()
      .then((model) => {
        if (!mounted) {
          return
        }
        setRoles(model?.queue ?? [])
        setError("")
      })
      .catch((err) => {
        if (!mounted) {
          return
        }
        setError(err instanceof Error ? err.message : "审核队列暂时无法读取。")
        setRoles([])
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const filteredRoles = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) {
      return roles
    }
    return roles.filter((role) =>
      [
        role.title,
        role.developerName,
        role.subtitle,
        role.packageId,
        role.reviewStateLabel,
        role.statusReason,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    )
  }, [roles, search])

  return (
    <div data-testid="products-data-table">
      <div className="border-b px-6 py-4">
        <input
          className="h-10 w-full max-w-[360px] rounded-md border bg-ui-bg-base px-3 txt-compact-small outline-none placeholder:text-ui-fg-muted"
          placeholder="搜索岗位、开发者或审核状态"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading ? (
        <div className="px-6 py-8 txt-compact-small text-ui-fg-muted">正在读取审核队列...</div>
      ) : error ? (
        <div className="px-6 py-8 txt-compact-small text-red-600">{error}</div>
      ) : filteredRoles.length === 0 ? (
        <div className="px-6 py-8 txt-compact-small text-ui-fg-muted">暂无待审核岗位。</div>
      ) : (
        <div className="divide-y">
          <div
            className="grid gap-4 px-6 py-3 txt-compact-small-plus text-ui-fg-muted"
            style={{ gridTemplateColumns: "minmax(180px, 1.4fr) minmax(120px, 1fr) 110px 130px 130px" }}
          >
            <span>岗位名称</span>
            <span>开发者</span>
            <span>审核状态</span>
            <span>商城上线状态</span>
            <span>提交时间</span>
          </div>
          {filteredRoles.map((role) => (
            <Link
              key={role.id}
              to={`/products/${role.id}`}
              className="grid gap-4 px-6 py-4 hover:bg-ui-bg-subtle"
              style={{ gridTemplateColumns: "minmax(180px, 1.4fr) minmax(120px, 1fr) 110px 130px 130px" }}
            >
              <div className="min-w-0">
                <Text size="small" weight="plus" className="truncate">
                  {role.title}
                </Text>
                <Text size="small" className="truncate text-ui-fg-subtle">
                  {role.statusReason || role.subtitle || role.packageId || "-"}
                </Text>
              </div>
              <Text size="small" className="truncate">
                {role.developerName || "-"}
              </Text>
              <StatusBadge color={reviewStateColor(role.reviewState)}>
                {role.reviewStateLabel || role.reviewState || "-"}
              </StatusBadge>
              <StatusBadge color={reviewStateColor(role.listingStatus)}>
                {role.listingStatus || "-"}
              </StatusBadge>
              <Text size="small" className="text-ui-fg-subtle">
                {formatSubmittedAt(role.submittedAt)}
              </Text>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export const ProductListTable = ({ children }: { children?: ReactNode }) => {
  return (
    <Container className="divide-y p-0" data-testid="products-list-table">
      {Children.count(children) > 0 ? (
        children
      ) : (
        <>
          <ProductListHeader />
          <ProductListDataTable />
        </>
      )}
      <Outlet />
    </Container>
  )
}
