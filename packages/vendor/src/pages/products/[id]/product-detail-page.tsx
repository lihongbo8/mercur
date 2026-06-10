import { Children, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Container, Heading, StatusBadge, Text, toast } from "@medusajs/ui";

import { TwoColumnPageSkeleton } from "@components/common/skeleton";
import { TwoColumnPage } from "@components/layout/pages";
import { useProduct } from "@hooks/api";
import {
  type DijieRoleListing,
  useDelistDijieRoleListing,
  useDijieRoleListings,
  usePublishDijieRoleListing,
  useSubmitDijieRoleListingReview,
} from "@hooks/api/dijie-role-listings";

import { ProductDetailProvider, useProductDetailContext } from "./context";

import { ProductGeneralSection } from "./_components/product-general-section";
import { ProductMediaSection } from "./_components/product-media-section";
import { ProductOptionSection } from "./_components/product-option-section";
import { ProductOrganizationSection } from "./_components/product-organization-section";
import { ProductVariantSection } from "./_components/product-variant-section";
import { ProductAttributeSection } from "./_components/product-attribute-section";
import { ProductAdditionalAttributesSection } from "./_components/product-additional-attribute-section";
import { ProductShippingProfileSection } from "./_components/product-shipping-profile-section";
import { ProductSalesChannelSection } from "./_components/product-sales-channel-section";
import {
  RoleActionSection,
  RoleGeneralSection,
  RolePricingSection,
} from "./_components/role-detail-sections";

const listingStatusLabels: Record<DijieRoleListing["listingStatus"], string> = {
  draft: "草稿",
  proposed: "待审核",
  published: "已上架",
  delisted: "未上架/已下架",
  archived: "已归档",
};

const reviewStateLabels: Record<DijieRoleListing["reviewState"], string> = {
  draft: "未提交",
  submitted: "审核中",
  needs_changes: "要求补充",
  approved: "已通过",
  rejected: "已驳回",
};

const listingStatusColors: Record<
  DijieRoleListing["listingStatus"],
  "grey" | "orange" | "green" | "red"
> = {
  draft: "grey",
  proposed: "orange",
  published: "green",
  delisted: "grey",
  archived: "grey",
};

const reviewStateColors: Record<
  DijieRoleListing["reviewState"],
  "grey" | "orange" | "green" | "red"
> = {
  draft: "grey",
  submitted: "orange",
  needs_changes: "orange",
  approved: "green",
  rejected: "red",
};

const formatCny = (cents?: number) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const formatTokenFee = (cents?: number) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "-";
  }
  return `${formatCny(cents)}/百万 Token`;
};

const Root = ({ children }: { children?: ReactNode }) => {
  const { id } = useParams();
  const isDijieRoleListing = id?.startsWith("djrole_") === true;
  const roleListingsQuery = useDijieRoleListings({
    enabled: isDijieRoleListing,
  });
  const { product, isLoading, isError, error } = useProduct(
    id!,
    undefined,
    {
      enabled: !isDijieRoleListing,
    },
  );

  if (isDijieRoleListing) {
    const role = roleListingsQuery.listings.find(
      (item) => (item.roleListingId || item.id) === id,
    );
    if (roleListingsQuery.isLoading) {
      return <TwoColumnPageSkeleton mainSections={4} sidebarSections={3} />;
    }
    if (roleListingsQuery.isError) {
      throw roleListingsQuery.error;
    }
    if (!role) {
      return (
        <Container className="m-6 p-6">
          <Heading>未找到岗位商品</Heading>
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            当前开发者店铺没有这个岗位商品，或账号无权查看。
          </Text>
          <Button size="small" variant="secondary" className="mt-4" asChild>
            <Link to="/products">返回岗位商品</Link>
          </Button>
        </Container>
      );
    }

    return <AicsRoleListingDetail role={role} />;
  }

  if (isLoading || !product) {
    return <TwoColumnPageSkeleton mainSections={4} sidebarSections={3} />;
  }

  if (isError) {
    throw error;
  }

  return (
    <ProductDetailProvider product={product}>
      {Children.count(children) > 0 ? (
        children
      ) : (
        <TwoColumnPage data={product}>
          <TwoColumnPage.Main>
            <RoleGeneralSection />
            <RolePricingSection />
          </TwoColumnPage.Main>
          <TwoColumnPage.Sidebar>
            <RoleActionSection />
          </TwoColumnPage.Sidebar>
        </TwoColumnPage>
      )}
    </ProductDetailProvider>
  );
};

export const ProductDetailPage = Object.assign(Root, {
  Main: TwoColumnPage.Main,
  Sidebar: TwoColumnPage.Sidebar,
  MainGeneralSection: ProductGeneralSection,
  MainMediaSection: ProductMediaSection,
  MainOptionSection: ProductOptionSection,
  MainVariantSection: ProductVariantSection,
  MainAttributeSection: ProductAttributeSection,
  MainAdditionalAttributeSection: ProductAdditionalAttributesSection,
  SidebarShippingProfileSection: ProductShippingProfileSection,
  SidebarOrganizationSection: ProductOrganizationSection,
  SidebarSalesChannelSection: ProductSalesChannelSection,
  useContext: useProductDetailContext,
});

const AicsRoleListingDetail = ({ role }: { role: DijieRoleListing }) => {
  return (
    <TwoColumnPage data={role}>
      <TwoColumnPage.Main>
        <Container className="divide-y p-0">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0">
              <Heading className="truncate">{role.title}</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                {role.packageId}@{role.packageVersion}
              </Text>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge color={reviewStateColors[role.reviewState]}>
                {reviewStateLabels[role.reviewState]}
              </StatusBadge>
              <StatusBadge color={listingStatusColors[role.listingStatus]}>
                {listingStatusLabels[role.listingStatus]}
              </StatusBadge>
            </div>
          </div>
          <DetailRow title="岗位简介" value={role.subtitle || role.description || "-"} />
          <DetailRow title="使用规范" value={role.usageInstructions || "-"} />
          <DetailRow title="分类" value={role.category || "-"} />
          <DetailRow title="能力标签" value={(role.capabilities ?? []).join("、") || "-"} />
          <DetailRow title="状态说明" value={role.statusReason || "-"} />
        </Container>
        <Container className="mt-6 divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">费用</Heading>
          </div>
          <DetailRow title="授权费" value={formatCny(role.pricing?.authorizationFeeCents)} />
          <DetailRow
            title="输入 Token"
            value={formatTokenFee(role.roleTokenPricing?.inputTokenCentsPerMillion)}
          />
          <DetailRow
            title="输出 Token"
            value={formatTokenFee(role.roleTokenPricing?.outputTokenCentsPerMillion)}
          />
        </Container>
      </TwoColumnPage.Main>
      <TwoColumnPage.Sidebar>
        <AicsRoleListingActions role={role} />
      </TwoColumnPage.Sidebar>
    </TwoColumnPage>
  );
};

const DetailRow = ({ title, value }: { title: string; value: string }) => (
  <div className="grid grid-cols-[160px_1fr] gap-4 px-6 py-4">
    <Text size="small" className="text-ui-fg-subtle">
      {title}
    </Text>
    <Text size="small" className="text-ui-fg-base">
      {value}
    </Text>
  </div>
);

const AicsRoleListingActions = ({ role }: { role: DijieRoleListing }) => {
  const roleListingId = role.roleListingId || role.id;
  const allowedActions = new Set(role.allowedActions ?? []);
  const submitReview = useSubmitDijieRoleListingReview({
    onSuccess: () => toast.success("岗位商品已提交审核。"),
    onError: (error) => toast.error(error.message),
  });
  const publish = usePublishDijieRoleListing({
    onSuccess: () => toast.success("岗位商品已上架，商城可见。"),
    onError: (error) => toast.error(error.message),
  });
  const delist = useDelistDijieRoleListing({
    onSuccess: () => toast.success("岗位商品已下架，商城不可见。"),
    onError: (error) => toast.error(error.message),
  });
  const isMutating =
    submitReview.isPending || publish.isPending || delist.isPending;

  return (
    <Container className="p-0">
      <div className="border-b px-6 py-4">
        <Heading level="h2">操作</Heading>
      </div>
      <div className="grid gap-2 p-3">
        <Button variant="secondary" size="small" asChild>
          <Link to="/products/create">重新上传</Link>
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={!allowedActions.has("submit_review") || isMutating}
          isLoading={submitReview.isPending}
          onClick={() => submitReview.mutate(roleListingId)}
        >
          提交审核
        </Button>
        <Button
          size="small"
          disabled={!allowedActions.has("publish") || isMutating}
          isLoading={publish.isPending}
          onClick={() => publish.mutate(roleListingId)}
        >
          上架
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={!allowedActions.has("delist") || isMutating}
          isLoading={delist.isPending}
          onClick={() => delist.mutate(roleListingId)}
        >
          下架
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/orders">销售记录</Link>
        </Button>
        <Button variant="secondary" size="small" asChild>
          <Link to="/payouts">结算记录</Link>
        </Button>
      </div>
    </Container>
  );
};
