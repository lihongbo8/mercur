import { Container, Heading, StatusBadge, Text } from "@medusajs/ui";

import { HttpTypes } from "@medusajs/types";

const productStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "grey";
    case "proposed":
    case "submitted":
      return "orange";
    case "published":
    case "approved":
      return "green";
    case "rejected":
      return "red";
    default:
      return "grey";
  }
};

const productStatusLabel = (status: string) => {
  switch (status) {
    case "draft":
      return "草稿";
    case "proposed":
    case "submitted":
      return "待审核";
    case "published":
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return status;
  }
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const getRoleMetadata = (product: HttpTypes.AdminProduct) => {
  return asRecord(asRecord(product.metadata).dijieRole);
};

const getRoleReviewState = (product: HttpTypes.AdminProduct) => {
  const role = getRoleMetadata(product);
  return role.reviewState ?? role.review_state ?? product.status;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

export const ProductGeneralSection = ({
  product,
}: {
  product: HttpTypes.AdminProduct;
}) => {
  const role = getRoleMetadata(product);
  const title = readString(role.title, product.title) ?? "-";

  return (
    <Container className="divide-y p-0" data-testid="product-general-section">
      <div
        className="flex items-center justify-between px-6 py-4"
        data-testid="product-general-header"
      >
        <div className="flex flex-col gap-y-1">
          <Text size="small" className="text-ui-fg-subtle">
            岗位名称
          </Text>
          <Heading data-testid="product-general-title">{title}</Heading>
        </div>
        <div
          className="flex items-center gap-x-4"
          data-testid="product-general-actions"
        >
          <StatusBadge
            color={productStatusColor(String(getRoleReviewState(product)))}
            data-testid="product-status-badge"
          >
            {productStatusLabel(String(getRoleReviewState(product)))}
          </StatusBadge>
        </div>
      </div>
    </Container>
  );
};
