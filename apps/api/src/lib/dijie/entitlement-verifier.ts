import type { DijieExecutionTokenPricing, DijieRoleTokenPricing } from "./execution-token";
import {
  isPublicDijieRoleProduct,
  normalizeDijieRoleProductMetadataFromProduct,
} from "./role-product-metadata";
import {
  createDijieRoleListingFromStoredRecord,
  type DijieRoleListing,
} from "./role-listings";

export type DijieEntitlementVerificationInput = {
  actorId: string;
  roleListingId: string;
  entitlementId: string;
  deviceId: string;
  workspaceRef: string;
  localGatewayId: string;
};

export type DijieEntitlementVerificationResult =
  | {
      ok: true;
      packageId: string;
      packageVersion: string;
      developerRef: string;
      listingOwnerRef: string;
      billingBeneficiaryRef: string;
      pricing: DijieExecutionTokenPricing;
      roleTokenPricing: DijieRoleTokenPricing;
      scopes: string[];
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type DijieQueryGraph = (query: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
}) => Promise<{ data?: unknown[] }>;

export type DijiePaidRoleCheckoutVerificationInput = {
  actorId: string;
  roleListingId: string;
  orderId: string;
};

export type DijiePaidRoleCheckoutVerificationResult =
  | {
      ok: true;
      orderId: string;
      matchedOrderId?: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type UnknownRecord = Record<string, unknown>;

const BLOCKED_ORDER_STATUSES = new Set(["canceled", "cancelled"]);
const PAID_ORDER_STATUSES = new Set(["completed"]);
const PAID_PAYMENT_STATUSES = new Set(["authorized", "captured", "paid", "completed"]);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadata(record: UnknownRecord): UnknownRecord {
  return asRecord(record.metadata);
}

function orderIsBlocked(order: UnknownRecord): boolean {
  const status = nonEmptyString(order.status)?.toLowerCase();
  return Boolean(status && BLOCKED_ORDER_STATUSES.has(status));
}

function orderIsPaid(order: UnknownRecord): boolean {
  const status = nonEmptyString(order.status)?.toLowerCase();
  if (status && PAID_ORDER_STATUSES.has(status)) {
    return true;
  }

  const paymentStatus = nonEmptyString(order.payment_status)?.toLowerCase();
  if (paymentStatus && PAID_PAYMENT_STATUSES.has(paymentStatus)) {
    return true;
  }

  const paymentCollections = Array.isArray(order.payment_collections)
    ? order.payment_collections
    : [];
  return paymentCollections.some((payment) => {
    const record = asRecord(payment);
    const collectionStatus = nonEmptyString(record.status)?.toLowerCase();
    if (collectionStatus && PAID_PAYMENT_STATUSES.has(collectionStatus)) {
      return true;
    }

    const amount = Number(record.amount);
    const capturedAmount = Number(record.captured_amount);
    return Number.isFinite(amount) && amount > 0 && Number.isFinite(capturedAmount) && capturedAmount >= amount;
  });
}

function itemMatchesRoleListing(item: UnknownRecord, roleListingId: string): boolean {
  const itemMetadata = metadata(item);
  if (
    item.product_id === roleListingId ||
    itemMetadata.dijieRoleListingId === roleListingId ||
    itemMetadata.dijie_role_listing_id === roleListingId
  ) {
    return true;
  }

  const product = asRecord(item.product);
  if (product.id === roleListingId) {
    return true;
  }

  const variant = asRecord(item.variant);
  return variant.product_id === roleListingId || asRecord(variant.product).id === roleListingId;
}

function orderIncludesRoleListing(order: UnknownRecord, roleListingId: string): boolean {
  const items = Array.isArray(order.items) ? order.items.map(asRecord) : [];
  return items.some((item) => itemMatchesRoleListing(item, roleListingId));
}

function ordersFromOrderGroups(orderGroups: unknown[]): UnknownRecord[] {
  return orderGroups.flatMap((orderGroup) => {
    const group = asRecord(orderGroup);
    return Array.isArray(group.orders) ? group.orders.map(asRecord) : [];
  });
}

function assertRequiredInput(input: DijieEntitlementVerificationInput): string | undefined {
  const missing = Object.entries(input)
    .filter(([, value]) => !nonEmptyString(value))
    .map(([key]) => key);

  return missing.length > 0 ? `Missing required fields: ${missing.join(", ")}` : undefined;
}

function assertRequiredCheckoutInput(
  input: DijiePaidRoleCheckoutVerificationInput,
): string | undefined {
  const missing = Object.entries(input)
    .filter(([, value]) => !nonEmptyString(value))
    .map(([key]) => key);

  return missing.length > 0 ? `Missing required fields: ${missing.join(", ")}` : undefined;
}

async function readStoredRoleListing(
  input: DijieEntitlementVerificationInput,
  queryGraph: DijieQueryGraph,
): Promise<
  | { found: true; listing?: DijieRoleListing; record: UnknownRecord }
  | { found: false }
  | { error: true }
> {
  try {
    const result = await queryGraph({
      entity: "dijie_role_listing",
      fields: [
        "id",
        "package_id",
        "package_version",
        "developer_ref",
        "listing_owner_ref",
        "billing_beneficiary_ref",
        "title",
        "subtitle",
        "description",
        "listing_status",
        "review_state",
        "capabilities",
        "manifest_summary",
        "pricing",
        "role_token_pricing",
        "scopes",
      ],
      filters: { id: input.roleListingId },
      pagination: { take: 1 },
    });
    const [record] = result.data ?? [];
    if (!record) {
      return { found: false };
    }
    return {
      found: true,
      listing: createDijieRoleListingFromStoredRecord(record),
      record: asRecord(record),
    };
  } catch {
    return { error: true };
  }
}

function entitlementFromStoredListing(
  listing: DijieRoleListing,
  record: UnknownRecord,
): Extract<DijieEntitlementVerificationResult, { ok: true }> {
  const developerRef = nonEmptyString(record.developer_ref) ?? listing.developerId!;
  const listingOwnerRef = nonEmptyString(record.listing_owner_ref) ?? developerRef;
  const billingBeneficiaryRef = nonEmptyString(record.billing_beneficiary_ref) ?? developerRef;
  return {
    ok: true,
    packageId: listing.packageId!,
    packageVersion: listing.packageVersion!,
    developerRef,
    listingOwnerRef,
    billingBeneficiaryRef,
    pricing: listing.pricing,
    roleTokenPricing: listing.roleTokenPricing,
    scopes: listing.scopes,
  };
}

export async function verifyPaidDijieRoleCheckoutFacts(
  input: DijiePaidRoleCheckoutVerificationInput,
  queryGraph: DijieQueryGraph,
): Promise<DijiePaidRoleCheckoutVerificationResult> {
  const missing = assertRequiredCheckoutInput(input);
  if (missing) {
    return { ok: false, status: 400, error: missing };
  }

  let orderGroups: unknown[] = [];
  let ordersById: unknown[] = [];
  try {
    const [orderGroupResult, orderResult] = await Promise.all([
      queryGraph({
        entity: "order_group",
        fields: [
          "id",
          "customer_id",
          "orders.id",
          "orders.status",
          "orders.payment_status",
          "orders.payment_collections.status",
          "orders.payment_collections.amount",
          "orders.payment_collections.captured_amount",
          "orders.items.*",
          "orders.items.product.id",
          "orders.items.product_id",
          "orders.items.variant.product_id",
          "orders.items.metadata",
        ],
        filters: {
          id: input.orderId,
          customer_id: input.actorId,
        },
      }),
      queryGraph({
        entity: "order",
        fields: [
          "id",
          "customer_id",
          "status",
          "payment_status",
          "payment_collections.status",
          "payment_collections.amount",
          "payment_collections.captured_amount",
          "items.*",
          "items.product.id",
          "items.product_id",
          "items.variant.product_id",
          "items.metadata",
        ],
        filters: {
          id: input.orderId,
          customer_id: input.actorId,
        },
      }),
    ]);
    orderGroups = orderGroupResult.data ?? [];
    ordersById = orderResult.data ?? [];
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Dijie entitlement verifier could not read marketplace facts.",
    };
  }

  const orders = [...ordersFromOrderGroups(orderGroups), ...ordersById.map(asRecord)];
  const matchingOrder = orders.find(
    (order) =>
      !orderIsBlocked(order) &&
      orderIsPaid(order) &&
      orderIncludesRoleListing(order, input.roleListingId),
  );
  if (!matchingOrder) {
    return {
      ok: false,
      status: 403,
      error: "No paid one-time role authorization was found for this customer.",
    };
  }

  return {
    ok: true,
    orderId: input.orderId,
    matchedOrderId: nonEmptyString(matchingOrder.id),
  };
}

export async function verifyDijieEntitlement(
  input: DijieEntitlementVerificationInput,
  queryGraph: DijieQueryGraph,
): Promise<DijieEntitlementVerificationResult> {
  const missing = assertRequiredInput(input);
  if (missing) {
    return { ok: false, status: 400, error: missing };
  }

  const storedListing = await readStoredRoleListing(input, queryGraph);
  let verifiedRole: Extract<DijieEntitlementVerificationResult, { ok: true }>;
  if ("found" in storedListing && storedListing.found) {
    if (!storedListing.listing || !nonEmptyString(storedListing.record?.developer_ref)) {
      return { ok: false, status: 403, error: "Role listing is not executable." };
    }
    verifiedRole = entitlementFromStoredListing(storedListing.listing, storedListing.record ?? {});
  } else {
    let products: unknown[] = [];
    try {
      const productResult = await queryGraph({
        entity: "product",
        fields: ["id", "status", "title", "metadata", "seller.id"],
        filters: { id: input.roleListingId },
      });
      products = productResult.data ?? [];
    } catch {
      return {
        ok: false,
        status: 502,
        error: "Dijie entitlement verifier could not read marketplace facts.",
      };
    }

    const product = asRecord(products[0]);
    if (!product.id) {
      return { ok: false, status: 404, error: "Role listing was not found." };
    }

    const roleProduct = normalizeDijieRoleProductMetadataFromProduct(product);
    if (!roleProduct.ok) {
      return {
        ok: false,
        status: 422,
        error: "Role listing metadata is not a valid Dijie role product.",
      };
    }
    if (!isPublicDijieRoleProduct(roleProduct.value)) {
      return { ok: false, status: 403, error: "Role listing is not executable." };
    }

    verifiedRole = {
      ok: true,
      packageId: roleProduct.value.packageId,
      packageVersion: roleProduct.value.packageVersion,
      developerRef: roleProduct.value.developerRef,
      listingOwnerRef: roleProduct.value.listingOwnerRef,
      billingBeneficiaryRef: roleProduct.value.billingBeneficiaryRef,
      pricing: roleProduct.value.pricing,
      roleTokenPricing: roleProduct.value.roleTokenPricing,
      scopes: roleProduct.value.scopes,
    };
  }

  try {
    const entitlementResult = await queryGraph({
      entity: "dijie_role_entitlement",
      fields: [
        "id",
        "actor_id",
        "role_listing_id",
        "entitlement_status",
        "source",
        "order_id",
        "authorized_at",
      ],
      filters: {
        id: input.entitlementId,
        actor_id: input.actorId,
        role_listing_id: input.roleListingId,
        entitlement_status: "authorized",
      },
      pagination: { take: 1 },
    });
    const [entitlement] = entitlementResult.data ?? [];
    if (asRecord(entitlement).id === input.entitlementId) {
      return verifiedRole;
    }
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Dijie entitlement verifier could not read local entitlement facts.",
    };
  }

  return {
    ok: false,
    status: 403,
    error: "No materialized Dijie role entitlement was found for this customer.",
  };
}
