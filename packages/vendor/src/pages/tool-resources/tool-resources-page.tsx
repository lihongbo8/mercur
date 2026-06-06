import { ArrowLongRight, ArrowUpRightOnBox, CloudArrowUp } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

const resources = [
  {
    title: "岗位商城",
    href: "http://127.0.0.1:3026/us",
    external: true,
  },
  {
    title: "岗位商品",
    href: "/products",
  },
  {
    title: "上传岗位",
    href: "/products/create",
  },
  {
    title: "销售记录",
    href: "/orders",
  },
  {
    title: "结算记录",
    href: "/payouts",
  },
  {
    title: "开发者资料",
    href: "/settings/profile",
  },
  {
    title: "开发者中心",
    href: "/",
  },
]

const capabilitySources = [
  {
    name: "OpenClaw skill-creator",
    type: "skill",
    status: "available",
    note: "缺失 skill 先生成候选，再验收",
  },
  {
    name: "browser",
    type: "tool",
    status: "available",
    note: "用于页面巡检和竞品分析",
  },
  {
    name: "image.inspect / image.generate",
    type: "provider",
    status: "candidate_found",
    note: "需确认本地模型 provider 配置",
  },
  {
    name: "aics_product_db / aics_product_assets",
    type: "data_adapter",
    status: "adapter_needed",
    note: "商品资料和图片资料需接入 AICS 业务 adapter",
  },
  {
    name: "aics_visual_issue / aics_design_standard",
    type: "data_adapter",
    status: "adapter_needed",
    note: "问题台账和设计标准写入需要人工确认边界",
  },
  {
    name: "unknown capability",
    type: "blocked",
    status: "missing",
    note: "未知能力必须阻断，不能降级通过",
  },
]

export const ToolResourcesPage = () => {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <Container className="flex items-center justify-between p-6">
        <div>
          <Heading>能力资源</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            查看本地已开放能力和常用入口，岗位只声明能力需求，不绑定工具权限。
          </Text>
        </div>
        <Button size="small" asChild>
          <Link to="/products/create" title="上传岗位包">
            <CloudArrowUp />
            上传岗位
          </Link>
        </Button>
      </Container>
      <div className="grid grid-cols-3 gap-3">
        {resources.map((resource) => (
          <Container
            key={resource.href}
            className="flex min-h-[120px] flex-col justify-between p-5"
          >
            <Heading level="h2">{resource.title}</Heading>
            <Button size="small" variant="secondary" asChild>
              {resource.external ? (
                <a href={resource.href} title="打开买家侧岗位商城">
                  <ArrowUpRightOnBox />
                  查看
                </a>
              ) : (
                <Link to={resource.href}>
                  <ArrowLongRight />
                  进入
                </Link>
              )}
            </Button>
          </Container>
        ))}
      </div>
      <Container className="p-0">
        <div className="border-b px-6 py-5">
          <Heading level="h2">岗位能力获取流程</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            岗位包只声明 requiredCapabilities，系统负责匹配已有 skill、工具、模型 provider 和业务 adapter。
          </Text>
        </div>
        <div className="divide-y">
          {capabilitySources.map((source) => (
            <div
              key={source.name}
              className="grid min-h-[66px] grid-cols-[1.4fr_0.8fr_0.8fr_2fr] items-center gap-3 px-6"
            >
              <Text className="txt-compact-small-plus text-ui-fg-base">{source.name}</Text>
              <Text className="txt-compact-small text-ui-fg-subtle">{source.type}</Text>
              <Text className="txt-compact-small text-ui-fg-subtle">{source.status}</Text>
              <Text className="txt-compact-small text-ui-fg-subtle">{source.note}</Text>
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}

export const Component = ToolResourcesPage
