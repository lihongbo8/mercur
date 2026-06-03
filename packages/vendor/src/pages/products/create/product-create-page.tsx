import { Children, ReactNode } from "react"
import { RouteFocusModal } from "@components/modals"
import { useSalesChannels } from "@hooks/api"
import { useStore } from "@hooks/api/store"

import { ProductCreateForm } from "./product-create-form/product-create-form"
import { ProductCreateDetailsForm } from "./product-create-details-form"
import { ProductCreateOrganizeForm } from "./product-create-organize-form"
import { TabbedForm } from "@components/tabbed-form"
import { HttpTypes } from "@mercurjs/types"

const ProductCreateFormWithModal = ({
  defaultChannel,
}: {
  defaultChannel?: HttpTypes.AdminSalesChannel
}) => {
  return <ProductCreateForm defaultChannel={defaultChannel} />
}

const Root = ({ children }: { children?: ReactNode }) => {
  const { store, isPending: isStorePending } = useStore()
  const { sales_channels, isPending: isSalesChannelPending } =
    useSalesChannels()

  const ready =
    !!store && !isStorePending && !!sales_channels && !isSalesChannelPending

  const defaultChannel = sales_channels?.[0] as
    | HttpTypes.AdminSalesChannel
    | undefined

  return (
    <RouteFocusModal>
      <RouteFocusModal.Title asChild>
        <span className="sr-only">创建岗位商品</span>
      </RouteFocusModal.Title>
      <RouteFocusModal.Description asChild>
        <span className="sr-only">上传岗位资料包并提交平台审核。</span>
      </RouteFocusModal.Description>
      {ready && (
        Children.count(children) > 0 ? (
          children
        ) : (
          <ProductCreateFormWithModal defaultChannel={defaultChannel} />
        )
      )}
    </RouteFocusModal>
  )
}

export const ProductCreatePage = Object.assign(Root, {
  DetailsForm: ProductCreateDetailsForm,
  OrganizeForm: ProductCreateOrganizeForm,
  Form: ProductCreateForm,
  Tab: TabbedForm.Tab,
})
