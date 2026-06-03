import { ArrowLongRight, ArrowUpRightOnBox, CloudArrowUp } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

const resources = [
  {
    title: "岗位商城",
    href: "/us",
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

export const ToolResourcesPage = () => {
  return (
    <div className="flex flex-col gap-y-3 p-6">
      <Container className="flex items-center justify-between p-6">
        <div>
          <Heading>工具资源</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            常用入口
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
    </div>
  )
}

export const Component = ToolResourcesPage
