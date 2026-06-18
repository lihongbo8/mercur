import { SingleColumnPage } from "../../components/layout/pages"
import { ReviewCenterWorkbench } from "./review-center-workbench"

export const Home = () => {
  return (
    <SingleColumnPage hasOutlet={false}>
      <ReviewCenterWorkbench />
    </SingleColumnPage>
  )
}
