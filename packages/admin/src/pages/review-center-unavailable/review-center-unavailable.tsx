import { ArrowUturnLeft, InformationCircle } from "@medusajs/icons"
import { Button, Container, Heading, Text, Tooltip } from "@medusajs/ui"
import { Link, useParams } from "react-router-dom"

export const ReviewCenterUnavailable = () => {
  const { id } = useParams()
  const backTo = id ? `/products/${id}` : "/products"

  return (
    <Container className="divide-y p-0" data-testid="review-center-unavailable">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">暂不开放</Heading>
          <Tooltip content="审核中心只保留岗位审核、安全摘要和审核设置。">
            <InformationCircle className="text-ui-fg-muted" />
          </Tooltip>
        </div>
        <Button asChild size="small" variant="secondary">
          <Link to={backTo}>
            <ArrowUturnLeft />
            返回审核
          </Link>
        </Button>
      </div>
      <div className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          该入口不属于岗位审核流程。
        </Text>
      </div>
    </Container>
  )
}
