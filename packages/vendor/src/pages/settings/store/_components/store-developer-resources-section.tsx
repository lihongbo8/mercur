import { ArrowLongRight, CloudArrowUp, Tag } from "@medusajs/icons"
import { Button, Container, Heading, Text, Tooltip } from "@medusajs/ui"
import { Link } from "react-router-dom"

export const StoreDeveloperResourcesSection = () => {
  return (
    <Container className="p-0">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Heading level="h2">常用入口</Heading>
        <Tooltip content="开发者中心常用入口">
          <Text size="small" className="text-ui-fg-muted">
            ?
          </Text>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Button variant="secondary" size="small" asChild>
          <Link to="/products/create" title="上传岗位包并提交审核">
            <CloudArrowUp />
            上传岗位
          </Link>
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/products" title="查看岗位列表">
            <Tag />
            岗位商品
          </Link>
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/orders" title="查看岗位销售记录">
            <ArrowLongRight />
            销售记录
          </Link>
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/payouts" title="查看开发者结算记录">
            <ArrowLongRight />
            结算记录
          </Link>
        </Button>
      </div>
    </Container>
  )
}
