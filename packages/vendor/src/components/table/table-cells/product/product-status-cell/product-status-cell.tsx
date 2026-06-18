import { StatusCell } from "../../common/status-cell"
import { HttpTypes } from "@medusajs/types"

type ProductStatusCellProps = {
  status: HttpTypes.AdminProductStatus
}

export const ProductStatusCell = ({ status }: ProductStatusCellProps) => {
  const [color, text] = {
    draft: ["grey", "草稿"],
    proposed: ["orange", "待审核"],
    published: ["green", "已上架"],
    rejected: ["red", "未通过"],
  }[status] as ["grey" | "orange" | "green" | "red", string]

  return <StatusCell color={color}>{text}</StatusCell>
}

export const ProductStatusHeader = () => {
  return (
    <div className="flex h-full w-full items-center">
      <span>审核状态</span>
    </div>
  )
}
