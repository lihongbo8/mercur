import { Avatar, Container, Heading, StatusBadge, Text } from "@medusajs/ui";
import { SellerDTO } from "@mercurjs/types";

type ProductSellerSectionProps = {
  seller?: SellerDTO | null;
};

export const ProductSellerSection = ({ seller }: ProductSellerSectionProps) => {
  if (!seller) {
    return null;
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">开发者摘要</Heading>
        <StatusBadge color="green">已登记</StatusBadge>
      </div>
      <div className="txt-small flex flex-col gap-2 p-2">
        <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={seller.logo ?? undefined}
              fallback={seller.name.charAt(0).toUpperCase()}
            />
            <div className="flex flex-1 flex-col">
              <span className="text-ui-fg-base font-medium">
                {seller.name}
              </span>
              <Text size="small" className="text-ui-fg-subtle">
                只展示公开身份
              </Text>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
};
