import { Link } from "react-router-dom"
import { Button, Container, Heading, StatusBadge, Text, Tooltip } from "@medusajs/ui"

import { SingleColumnPage } from "../../components/layout/pages"

type ReviewEntry = {
  label: string
  value: string
  href: string
  title: string
}

const entries: ReviewEntry[] = [
  {
    label: "待审核岗位商品",
    value: "待处理",
    href: "/products",
    title: "审核开发者提交的岗位商品",
  },
  {
    label: "审核详情",
    value: "看单项",
    href: "/products",
    title: "进入岗位商品后查看材料、风险、计费和结论",
  },
  {
    label: "安全摘要",
    value: "看风险",
    href: "/products",
    title: "查看岗位包安全扫描和敏感字段结果",
  },
  {
    label: "价格检查",
    value: "看计费",
    href: "/products",
    title: "检查授权费、模型单价和分账口径",
  },
  {
    label: "驳回记录",
    value: "看原因",
    href: "/products",
    title: "查看驳回过的岗位和处理意见",
  },
  {
    label: "审核设置",
    value: "看规则",
    href: "/settings/marketplace",
    title: "维护平台审核和市场规则",
  },
  {
    label: "审核记录",
    value: "可追溯",
    href: "/products",
    title: "查看审核动作和交接记录",
  },
]

const reviewSteps = ["待审核岗位商品", "审核详情", "通过确认", "驳回确认", "审核记录"]

export const Home = () => {
  return (
    <SingleColumnPage>
      <div className="flex flex-col gap-y-4">
        <Container className="p-0">
          <div className="flex items-start justify-between gap-x-4 border-b px-6 py-5">
            <div>
              <div className="mb-2 flex items-center gap-x-2">
                <StatusBadge color="blue">审核助手</StatusBadge>
                <StatusBadge color="orange">待确认</StatusBadge>
              </div>
              <Heading level="h1">审核中心</Heading>
              <Text className="mt-2 text-ui-fg-subtle">岗位审核、风险、计费。</Text>
            </div>
            <Button size="small" asChild>
              <Link to="/products">进入审核</Link>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 p-6">
            {entries.map((entry) => (
              <Tooltip key={entry.label} content={entry.title}>
                <Button
                  asChild
                  variant="transparent"
                  className="h-28 justify-start rounded-md border p-4"
                >
                  <Link to={entry.href}>
                    <span className="flex flex-col items-start gap-y-3 text-left">
                      <span className="txt-compact-small text-ui-fg-subtle">{entry.label}</span>
                      <span className="txt-compact-large-plus text-ui-fg-base">{entry.value}</span>
                    </span>
                  </Link>
                </Button>
              </Tooltip>
            ))}
          </div>
        </Container>

        <div className="grid grid-cols-[1.1fr_0.9fr] gap-4">
          <Container className="p-0">
            <div className="border-b px-6 py-4">
              <Heading level="h2">审核流程</Heading>
            </div>
            <div className="grid grid-cols-5 gap-3 p-6">
              {reviewSteps.map((step) => (
                <div key={step} className="rounded-md border p-4" title={`${step}由审核中心汇总`}>
                  <Text className="text-ui-fg-subtle">{step}</Text>
                  <Text className="mt-2 text-ui-fg-base">已接入</Text>
                </div>
              ))}
            </div>
          </Container>

          <Container className="p-0">
            <div className="border-b px-6 py-4">
              <Heading level="h2">确认点</Heading>
            </div>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between rounded-md border p-4" title="通过审核前需要人工确认">
                <Text>通过</Text>
                <StatusBadge color="orange">待确认</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-md border p-4" title="驳回前需要人工确认">
                <Text>驳回</Text>
                <StatusBadge color="orange">待确认</StatusBadge>
              </div>
            </div>
          </Container>
        </div>
      </div>
    </SingleColumnPage>
  )
}
