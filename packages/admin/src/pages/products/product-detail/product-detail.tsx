import { ReactNode, Children } from "react";
import { Link, useLoaderData, useParams } from "react-router-dom";

import { HttpTypes } from "@medusajs/types";
import { SellerDTO } from "@mercurjs/types";
import { CogSixTooth, InformationCircle } from "@medusajs/icons";
import { Container, Heading, StatusBadge, Tooltip } from "@medusajs/ui";
import { TwoColumnPageSkeleton } from "../../../components/common/skeleton";
import { TwoColumnPage } from "../../../components/layout/pages";
import { useProduct } from "../../../hooks/api/products";
import { ProductGeneralSection } from "./components/product-general-section";
import {
  ProductRoleReviewSection,
  createPublicDijieRoleMetadata,
} from "./components/product-role-review-section";
import { ProductSellerSection } from "./components/product-seller-section/product-seller-section";
import { productLoader } from "./loader";
import { PRODUCT_DETAIL_QUERY } from "../constants";

type AdminProductWithSeller = HttpTypes.AdminProduct & {
  seller?: SellerDTO;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const hasDijieRoleMetadata = (product: AdminProductWithSeller) => {
  return Object.keys(asRecord(asRecord(product.metadata).dijieRole)).length > 0;
};

const getRoleMetadata = (product: AdminProductWithSeller) => {
  return asRecord(asRecord(product.metadata).dijieRole);
};

const getReviewState = (product: AdminProductWithSeller) => {
  const role = getRoleMetadata(product);
  return role.reviewState ?? role.review_state ?? product.status ?? "draft";
};

const reviewStateLabel = (state: unknown) => {
  switch (state) {
    case "submitted":
    case "proposed":
      return "待审核";
    case "approved":
    case "published":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return "草稿";
  }
};

const reviewStateColor = (state: unknown) => {
  switch (state) {
    case "submitted":
    case "proposed":
      return "orange";
    case "approved":
    case "published":
      return "green";
    case "rejected":
      return "red";
    default:
      return "grey";
  }
};

const sanitizeProductForExtraData = (
  product: AdminProductWithSeller,
): AdminProductWithSeller => {
  const metadata = asRecord(product.metadata);
  const role = asRecord(metadata.dijieRole);

  if (!Object.keys(role).length) {
    return product;
  }

  return {
    ...product,
    metadata: {
      ...metadata,
      dijieRole: createPublicDijieRoleMetadata(role),
    },
  };
};

const Root = ({ children }: { children?: ReactNode }) => {
  const initialData = useLoaderData() as Awaited<
    ReturnType<typeof productLoader>
  >;

  const { id } = useParams();
  const { product: rawProduct, isLoading, isError, error } = useProduct(
    id!,
    PRODUCT_DETAIL_QUERY,
    {
      initialData: initialData,
    },
  );
  const product = rawProduct as AdminProductWithSeller | undefined;

  if (isLoading || !product) {
    return (
      <TwoColumnPageSkeleton
        mainSections={4}
        sidebarSections={3}
        showJSON={false}
        showMetadata={false}
      />
    );
  }

  if (isError) {
    throw error;
  }

  const isDijieRoleProduct = hasDijieRoleMetadata(product);
  const extraDataProduct = sanitizeProductForExtraData(product);

  if (!isDijieRoleProduct) {
    return (
      <TwoColumnPage
        data={extraDataProduct}
        showJSON={false}
        showMetadata={false}
        data-testid="product-detail-page"
      >
        <TwoColumnPage.Main data-testid="product-detail-main">
          <Container className="divide-y p-0" data-testid="product-detail-unavailable">
            <div className="flex items-center gap-x-2 px-6 py-4">
              <Heading level="h2">暂不开放</Heading>
              <Tooltip content="审核中心只处理岗位审核提交。">
                <InformationCircle className="text-ui-fg-muted" />
              </Tooltip>
            </div>
            <div className="px-6 py-4">
              该记录不是岗位审核提交，旧产品详情入口已拦截。
            </div>
          </Container>
        </TwoColumnPage.Main>
        <TwoColumnPage.Sidebar data-testid="product-detail-sidebar">
          <ReviewCenterSidebarSection product={product} />
        </TwoColumnPage.Sidebar>
      </TwoColumnPage>
    );
  }

  return Children.count(children) > 0 ? (
    <TwoColumnPage
      data={extraDataProduct}
      showJSON={false}
      showMetadata={false}
      data-testid="product-detail-page"
    >
      {children}
    </TwoColumnPage>
  ) : (
    <TwoColumnPage
      data={extraDataProduct}
      showJSON={false}
      showMetadata={false}
      data-testid="product-detail-page"
    >
      <TwoColumnPage.Main data-testid="product-detail-main">
        <ProductGeneralSection product={product} />
        <ProductRoleReviewSection product={product} />
      </TwoColumnPage.Main>
      <TwoColumnPage.Sidebar data-testid="product-detail-sidebar">
        <ReviewCenterSidebarSection product={product} />
        <ProductSellerSection seller={product.seller} />
      </TwoColumnPage.Sidebar>
    </TwoColumnPage>
  );
};

export const ProductDetailPage = Object.assign(Root, {
  Main: TwoColumnPage.Main,
  Sidebar: TwoColumnPage.Sidebar,
  MainGeneralSection: ProductGeneralSection,
  MainRoleReviewSection: ProductRoleReviewSection,
  SidebarSellerSection: ProductSellerSection,
});

const ReviewCenterSidebarSection = ({
  product,
}: {
  product: AdminProductWithSeller;
}) => {
  const state = getReviewState(product);

  return (
    <Container className="divide-y p-0" data-testid="review-center-sidebar">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h2">审核中心</Heading>
          <Tooltip content="岗位商品只显示安全摘要。">
            <InformationCircle className="text-ui-fg-muted" />
          </Tooltip>
        </div>
        <StatusBadge color={reviewStateColor(state)}>
          {reviewStateLabel(state)}
        </StatusBadge>
      </div>
      <Link
        to="/settings/marketplace"
        className="text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-x-2 px-6 py-4 text-sm"
      >
        <CogSixTooth />
        审核设置
      </Link>
    </Container>
  );
};
