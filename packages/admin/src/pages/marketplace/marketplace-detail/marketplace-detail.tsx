import { ReactNode, Children } from "react"
import { useLoaderData } from "react-router-dom"

import { SingleColumnPageSkeleton } from "../../../components/common/skeleton"
import { SingleColumnPage } from "../../../components/layout/pages"
import { useStore } from "../../../hooks/api/store"
import { MarketplaceCurrencySection } from "./components/marketplace-currency-section"
import { MarketplaceGeneralSection } from "./components/marketplace-general-section"
import { storeLoader } from "./loader"

const Root = ({ children }: { children?: ReactNode }) => {
  const initialData = useLoaderData() as Awaited<ReturnType<typeof storeLoader>>

  const { store, isPending, isError, error } = useStore(undefined, {
    initialData,
  })

  if (isPending || !store) {
    return <SingleColumnPageSkeleton sections={2} showJSON={false} showMetadata={false} />
  }

  if (isError) {
    throw error
  }

  return Children.count(children) > 0 ? (
    <SingleColumnPage data={store} hasOutlet showMetadata={false} showJSON={false}>
      {children}
    </SingleColumnPage>
  ) : (
    <SingleColumnPage data={store} hasOutlet showMetadata={false} showJSON={false}>
      <MarketplaceGeneralSection store={store} />
      <MarketplaceCurrencySection store={store} />
    </SingleColumnPage>
  )
}

export const MarketplaceDetailPage = Object.assign(Root, {
  GeneralSection: MarketplaceGeneralSection,
  CurrencySection: MarketplaceCurrencySection,
})
