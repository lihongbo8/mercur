import { Link } from "react-router-dom"
import { Button, Container, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui"

import { SingleColumnPage } from "../../components/layout/pages"

type ChatAction = {
  label: string
  title: string
  description: string
  href: string
  tooltip: string
}

type ReviewStatus = {
  label: string
  value: string
  color: "blue" | "green" | "grey" | "orange" | "red"
}

type ReviewEntry = {
  eyebrow: string
  title: string
  description: string
  href: string
}

type BackendContract = {
  label: string
  description: string
}

const chatActions: ChatAction[] = [
  {
    label: "查看队列",
    title: "进入待审核岗位商品列表。",
    description: "先选择开发者提交的岗位商品。",
    href: "/products",
    tooltip: "查看还没有进入人工判断的岗位商品。",
  },
  {
    label: "审核详情",
    title: "查看岗位介绍、能力需求和上架材料。",
    description: "核对材料完整性和前台展示口径。",
    href: "/products",
    tooltip: "进入单个岗位商品的审核详情。",
  },
  {
    label: "停在确认",
    title: "通过或驳回前必须人工确认。",
    description: "确认点只记录判断，不直接提交成功。",
    href: "/products",
    tooltip: "通过和驳回都必须进入确认点。",
  },
]

const reviewStatuses: ReviewStatus[] = [
  {
    label: "待审核岗位",
    value: "0",
    color: "grey",
  },
  {
    label: "材料完整性",
    value: "待检查",
    color: "orange",
  },
  {
    label: "安全摘要",
    value: "待接入",
    color: "orange",
  },
  {
    label: "价格与计费",
    value: "待接入",
    color: "orange",
  },
  {
    label: "审计回读",
    value: "脱敏",
    color: "green",
  },
  {
    label: "确认点",
    value: "2",
    color: "grey",
  },
]

const reviewEntries: ReviewEntry[] = [
  {
    eyebrow: "队列",
    title: "待审核岗位商品",
    description: "进入待审核列表，选择一个岗位商品开始判断。",
    href: "/products",
  },
  {
    eyebrow: "详情",
    title: "岗位材料核对",
    description: "核对岗位介绍、业务场景、本地能力需求和授权价格。",
    href: "/products",
  },
  {
    eyebrow: "安全",
    title: "敏感字段扫描",
    description: "查看违规项、敏感字段和失败关闭原因。",
    href: "/products",
  },
  {
    eyebrow: "记录",
    title: "审核记录回读",
    description: "回看脱敏后的判断动作、备注和交接记录。",
    href: "/products",
  },
]

const backendContracts: BackendContract[] = [
  {
    label: "商品材料",
    description: "岗位介绍、业务场景、本地能力需求、授权价格。",
  },
  {
    label: "安全摘要",
    description: "违规项、敏感字段检查、失败关闭原因。",
  },
  {
    label: "计费摘要",
    description: "授权费、模型用量单价、分账摘要。",
  },
  {
    label: "审计回读",
    description: "只返回脱敏后的动作、费用和能力调用摘要。",
  },
]

export const Home = () => {
  return (
    <SingleColumnPage hasOutlet={false}>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-ui-fg-subtle">迭界AI</Text>
            <Text className="text-ui-fg-muted">›</Text>
            <Text className="text-ui-fg-subtle">审核中心</Text>
            <Text className="text-ui-fg-muted">›</Text>
            <Text className="txt-compact-small-plus text-ui-fg-interactive">审核对话</Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge color="blue">审核模式</StatusBadge>
            <StatusBadge color="orange">待审核 0</StatusBadge>
            <StatusBadge color="orange">确认点 2</StatusBadge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Container className="flex min-h-[424px] flex-col divide-y p-0">
            <div className="px-6 py-5">
              <Heading level="h1">审核对话</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                按开发者中心同款对话入口推进材料、风险、计费和确认点。
              </Text>
            </div>

            <div className="flex flex-1 flex-col gap-y-4 px-6 py-5">
              <div className="max-w-[760px] rounded-md border bg-ui-bg-subtle px-4 py-3">
                <Text className="text-ui-fg-base">
                  选择一个待审核岗位商品，先看提交材料，再进入安全摘要和价格检查。
                </Text>
              </div>

              <div className="max-w-[760px] rounded-md border border-ui-border-interactive bg-ui-bg-interactive/10 px-4 py-3">
                <Text className="txt-compact-small-plus text-ui-fg-interactive">
                  商品图检查岗位需要核对本地能力需求、授权价格、模型用量单价和脱敏回读。
                </Text>
              </div>

              <div className="grid max-w-[820px] grid-cols-1 gap-3 md:grid-cols-3">
                {chatActions.map((action) => (
                  <Tooltip key={action.label} content={action.tooltip}>
                    <Button
                      asChild
                      variant="transparent"
                      className="h-auto min-h-[104px] justify-start rounded-md border bg-ui-bg-base p-4"
                    >
                      <Link to={action.href}>
                        <span className="flex flex-col items-start gap-y-2 text-left">
                          <span className="txt-compact-small-plus text-ui-fg-base">
                            {action.label}
                          </span>
                          <span className="txt-small text-ui-fg-subtle">{action.title}</span>
                          <span className="txt-compact-small text-ui-fg-muted">
                            {action.description}
                          </span>
                        </span>
                      </Link>
                    </Button>
                  </Tooltip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row">
              <input
                className="min-h-10 flex-1 rounded-md border bg-ui-bg-base px-3 txt-compact-small text-ui-fg-base outline-none transition-fg placeholder:text-ui-fg-muted focus:border-ui-border-interactive"
                placeholder="输入审核问题，例如：看商品图检查岗位的计费和风险"
                type="text"
              />
              <Button className="min-h-10 rounded-md px-6">发送</Button>
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="px-6 py-5">
              <Heading level="h2">审核状态</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                照开发者中心状态面板，只放当前判断。
              </Text>
            </div>
            <div>
              {reviewStatuses.map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-[72px] items-center justify-between gap-x-4 border-b px-6 last:border-b-0"
                >
                  <Text className="text-ui-fg-base">{item.label}</Text>
                  {item.value.length > 1 ? (
                    <StatusBadge color={item.color}>{item.value}</StatusBadge>
                  ) : (
                    <Text className="txt-compact-medium text-ui-fg-subtle">{item.value}</Text>
                  )}
                </div>
              ))}
            </div>
          </Container>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Container className="divide-y p-0">
            <div className="px-6 py-5">
              <Heading level="h2">审核入口</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                入口卡片保留，但降级为下方操作区。
              </Text>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {reviewEntries.map((entry) => (
                <Button
                  key={entry.title}
                  asChild
                  variant="transparent"
                  className="h-auto min-h-[104px] justify-start rounded-md border bg-ui-bg-base p-4"
                >
                  <Link to={entry.href}>
                    <span className="flex flex-col items-start gap-y-2 text-left">
                      <span className="txt-compact-small text-ui-fg-subtle">{entry.eyebrow}</span>
                      <span className="txt-compact-large-plus text-ui-fg-base">{entry.title}</span>
                      <span className="txt-small text-ui-fg-subtle">{entry.description}</span>
                    </span>
                  </Link>
                </Button>
              ))}
            </div>
          </Container>

          <Container className="divide-y p-0">
            <div className="px-6 py-5">
              <Heading level="h2">后端配合</Heading>
              <Text className="mt-2 text-ui-fg-subtle">
                协议按这个前端流程提供字段，不暴露内部结构。
              </Text>
            </div>
            <div className="space-y-3 p-5">
              {backendContracts.map((contract) => (
                <div
                  key={contract.label}
                  className="grid gap-2 rounded-md border px-4 py-3 md:grid-cols-[120px_1fr]"
                >
                  <Text className="txt-compact-small-plus text-ui-fg-base">
                    {contract.label}
                  </Text>
                  <Text className="txt-small text-ui-fg-subtle">{contract.description}</Text>
                </div>
              ))}
            </div>
          </Container>
        </div>
      </div>
    </SingleColumnPage>
  )
}
