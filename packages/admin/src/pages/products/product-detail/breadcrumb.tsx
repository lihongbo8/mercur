import { UIMatch } from "react-router-dom"

export const ProductDetailBreadcrumb = (props: UIMatch) => {
  return <span>{props.params?.id ? "岗位审核详情" : "岗位审核"}</span>
}
