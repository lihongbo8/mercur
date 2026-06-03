import { ArrowLongRight } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

export const RouteDisabledPage = () => {
  return (
    <div className="flex min-h-full items-start justify-center p-6">
      <Container className="flex w-full max-w-[560px] flex-col gap-y-4 p-6">
        <div>
          <Heading>暂不开放</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            请回到开发者中心的安全入口。
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" asChild>
            <Link to="/products">
              <ArrowLongRight />
              岗位商品
            </Link>
          </Button>
          <Button size="small" variant="secondary" asChild>
            <Link to="/orders">销售记录</Link>
          </Button>
          <Button size="small" variant="secondary" asChild>
            <Link to="/payouts">结算记录</Link>
          </Button>
        </div>
      </Container>
    </div>
  )
}

export const Component = RouteDisabledPage
