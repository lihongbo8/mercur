import {
  normalizeDijieRoleProductMetadataFromProduct,
  type DijieRoleProductMetadata,
} from "./role-product-metadata";
import {
  createDijieRoleListingFromStoredRecord,
  type DijieRoleListing,
} from "./role-listings";

export type DijieReceivablesQueryGraph = (query: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
}) => Promise<{ data?: unknown[] }>;

export type DijieVendorRoleAuthorizationReceivable = {
  roleListingId: string;
  title: string;
  authorizationCount: number;
  authorizationReceivableCents: number;
  lastAuthorizedAt: string | null;
};

export type DijieVendorRoleUsageReceivable = {
  roleListingId: string;
  title: string;
  packageId: string;
  packageVersion: string;
  executionCount: number;
  inputTokens: number;
  outputTokens: number;
  roleUsageReceivableCents: number;
  lastReceivedAt: string | null;
};

export type DijieVendorAuthorizationEvent = {
  roleListingId: string;
  title: string;
  source: "entitlement" | "checkout";
  authorizationFeeCents: number;
  developerReceivableCents: number;
  currency: "CNY";
  authorizedAt: string | null;
};

export type DijieVendorUsageEvent = {
  roleListingId: string;
  title: string;
  packageId: string;
  packageVersion: string;
  inputTokens: number;
  outputTokens: number;
  developerReceivableCents: number;
  currency: "CNY";
  receivedAt: string | null;
};

export type DijieVendorReceivablesReadModel = {
  summary: {
    currency: "CNY";
    authorizationReceivableCents: number;
    roleUsageReceivableCents: number;
    totalDeveloperReceivableCents: number;
    platformReceivableCents: 0;
    authorizationCount: number;
    executionCount: number;
    inputTokens: number;
    outputTokens: number;
  };
  authorizationByRole: DijieVendorRoleAuthorizationReceivable[];
  roleUsageByRole: DijieVendorRoleUsageReceivable[];
  authorizationEvents: DijieVendorAuthorizationEvent[];
  usageEvents: DijieVendorUsageEvent[];
};

type UnknownRecord = Record<string, unknown>;
type ReceivableRole = {
  id: string;
  title: string;
  pricing: {
    authorizationFeeCents: number;
    developerReceivableCents: number;
  };
};

const BLOCKED_ORDER_STATUSES = new Set(["canceled", "cancelled"]);
const PAID_ORDER_STATUSES = new Set(["completed"]);
const PAID_PAYMENT_STATUSES = new Set(["captured", "paid", "completed"]);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : undefined;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return nonEmptyString(value) ?? null;
}

function laterTimestamp(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return Date.parse(b) > Date.parse(a) ? b : a;
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

function itemProductIds(itemInput: unknown): string[] {
  const item = asRecord(itemInput);
  const itemMetadata = metadata(item);
  const product = asRecord(item.product);
  const variant = asRecord(item.variant);
  const variantProduct = asRecord(variant.product);
  return [
    nonEmptyString(item.product_id),
    nonEmptyString(itemMetadata.dijieRoleListingId),
    nonEmptyString(itemMetadata.dijie_role_listing_id),
    nonEmptyString(product.id),
    nonEmptyString(variant.product_id),
    nonEmptyString(variantProduct.id),
  ].filter((value): value is string => Boolean(value));
}

function ordersFromOrderGroups(orderGroups: unknown[]): UnknownRecord[] {
  return orderGroups.flatMap((orderGroupInput) => {
    const orderGroup = asRecord(orderGroupInput);
    return Array.isArray(orderGroup.orders) ? orderGroup.orders.map(asRecord) : [];
  });
}

function receivableRoleFromProduct(
  product: UnknownRecord,
  normalized: DijieRoleProductMetadata,
): ReceivableRole {
  return {
    id: nonEmptyString(product.id) ?? normalized.packageId,
    title:
      nonEmptyString(normalized.title) ??
      nonEmptyString(product.title) ??
      "未命名岗位",
    pricing: {
      authorizationFeeCents: normalized.pricing.authorizationFeeCents,
      developerReceivableCents: normalized.pricing.developerReceivableCents,
    },
  };
}

function receivableRoleFromListing(listing: DijieRoleListing): ReceivableRole {
  return {
    id: listing.id,
    title: listing.title,
    pricing: {
      authorizationFeeCents: listing.pricing.authorizationFeeCents,
      developerReceivableCents: listing.pricing.developerReceivableCents,
    },
  };
}

function createSellerRoleMap(params: {
  sellerId: string;
  products: unknown[];
  roleListings?: unknown[];
}) {
  const roles = new Map<string, ReceivableRole>();

  for (const listingInput of params.roleListings ?? []) {
    const record = asRecord(listingInput);
    const listing = createDijieRoleListingFromStoredRecord(record);
    if (!listing) {
      continue;
    }
    const sellerOwnsRole =
      nonEmptyString(record.billing_beneficiary_ref) === params.sellerId ||
      nonEmptyString(record.listing_owner_ref) === params.sellerId ||
      nonEmptyString(record.developer_ref) === params.sellerId;
    if (!sellerOwnsRole) {
      continue;
    }
    roles.set(listing.id, receivableRoleFromListing(listing));
  }

  for (const productInput of params.products) {
    const product = asRecord(productInput);
    const id = nonEmptyString(product.id);
    if (!id) {
      continue;
    }

    const normalized = normalizeDijieRoleProductMetadataFromProduct(product);
    if (!normalized.ok) {
      continue;
    }

    const seller = asRecord(product.seller);
    const sellerOwnsRole =
      nonEmptyString(seller.id) === params.sellerId ||
      normalized.value.billingBeneficiaryRef === params.sellerId ||
      normalized.value.listingOwnerRef === params.sellerId ||
      normalized.value.developerRef === params.sellerId;
    if (!sellerOwnsRole) {
      continue;
    }

    if (!roles.has(id)) {
      roles.set(id, receivableRoleFromProduct(product, normalized.value));
    }
  }

  return roles;
}

function aggregateAuthorizationReceivables(params: {
  sellerId: string;
  roles: Map<string, ReceivableRole>;
  orderGroups: unknown[];
  orders: unknown[];
}) {
  const byRole = new Map<string, DijieVendorRoleAuthorizationReceivable>();
  const orderGroupsByOrderId = new Map<string, string>();
  const seen = new Set<string>();

  for (const orderGroupInput of params.orderGroups) {
    const orderGroup = asRecord(orderGroupInput);
    const orderGroupId = nonEmptyString(orderGroup.id);
    if (!orderGroupId || !Array.isArray(orderGroup.orders)) {
      continue;
    }
    for (const order of orderGroup.orders.map(asRecord)) {
      const orderId = nonEmptyString(order.id);
      if (orderId) {
        orderGroupsByOrderId.set(orderId, orderGroupId);
      }
    }
  }

  const orders = [...ordersFromOrderGroups(params.orderGroups), ...params.orders.map(asRecord)];
  for (const order of orders) {
    if (orderIsBlocked(order) || !orderIsPaid(order)) {
      continue;
    }

    const orderId = nonEmptyString(order.id);
    const entitlementId =
      (orderId ? orderGroupsByOrderId.get(orderId) : undefined) ??
      nonEmptyString(order.order_group_id) ??
      orderId;
    if (!entitlementId) {
      continue;
    }

    const authorizedAt =
      toIsoString(order.completed_at) ??
      toIsoString(order.created_at) ??
      toIsoString(order.updated_at);
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      for (const productId of itemProductIds(item)) {
        const role = params.roles.get(productId);
        if (!role) {
          continue;
        }

        const key = `${entitlementId}:${role.id}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const current = byRole.get(role.id) ?? {
          roleListingId: role.id,
          title: role.title,
          authorizationCount: 0,
          authorizationReceivableCents: 0,
          lastAuthorizedAt: null,
        };
        current.authorizationCount += 1;
        current.authorizationReceivableCents += role.pricing.developerReceivableCents;
        current.lastAuthorizedAt = laterTimestamp(current.lastAuthorizedAt, authorizedAt);
        byRole.set(role.id, current);
      }
    }
  }

  return [...byRole.values()].sort((a, b) =>
    (b.lastAuthorizedAt ?? "").localeCompare(a.lastAuthorizedAt ?? ""),
  );
}

function metersFromLedger(ledger: UnknownRecord): { inputTokens: number; outputTokens: number } {
  const meters = Array.isArray(ledger.meters) ? ledger.meters.map(asRecord) : [];
  const findMeter = (name: string) =>
    meters.find((meter) => nonEmptyString(meter.name) === name)?.quantity;
  return {
    inputTokens: nonNegativeInteger(findMeter("input_tokens")) ?? 0,
    outputTokens: nonNegativeInteger(findMeter("output_tokens")) ?? 0,
  };
}

function modelUsageFromRecord(record: UnknownRecord, ledger: UnknownRecord) {
  const modelProxyUsage = asRecord(record.model_proxy_usage);
  const meterUsage = metersFromLedger(ledger);
  return {
    inputTokens:
      nonNegativeInteger(modelProxyUsage.inputTokens ?? modelProxyUsage.input_tokens) ??
      meterUsage.inputTokens,
    outputTokens:
      nonNegativeInteger(modelProxyUsage.outputTokens ?? modelProxyUsage.output_tokens) ??
      meterUsage.outputTokens,
  };
}

function latestRecordsByExecution(auditRecords: unknown[]): UnknownRecord[] {
  const byExecution = new Map<string, UnknownRecord>();
  for (const input of auditRecords) {
    const record = asRecord(input);
    const executionId = nonEmptyString(record.execution_id);
    if (!executionId) {
      continue;
    }

    const current = byExecution.get(executionId);
    const receivedAt = toIsoString(record.received_at);
    if (!current || Date.parse(receivedAt ?? "") > Date.parse(toIsoString(current.received_at) ?? "")) {
      byExecution.set(executionId, record);
    }
  }
  return [...byExecution.values()];
}

function aggregateRoleUsageReceivables(params: {
  sellerId: string;
  roles: Map<string, ReceivableRole>;
  auditRecords: unknown[];
}) {
  const byRole = new Map<string, DijieVendorRoleUsageReceivable>();

  for (const record of latestRecordsByExecution(params.auditRecords)) {
    const ledger = asRecord(record.role_usage_ledger);
    const billingBeneficiaryRef =
      nonEmptyString(record.billing_beneficiary_ref) ??
      nonEmptyString(ledger.billingBeneficiaryRef);
    if (billingBeneficiaryRef !== params.sellerId || ledger.source !== "role_usage") {
      continue;
    }

    const roleListingId =
      nonEmptyString(record.role_listing_id) ??
      nonEmptyString(ledger.roleListingId);
    const packageId =
      nonEmptyString(record.package_id) ??
      nonEmptyString(ledger.packageId);
    const packageVersion =
      nonEmptyString(record.package_version) ??
      nonEmptyString(ledger.packageVersion);
    const amountCents = nonNegativeInteger(ledger.developerReceivableCents);
    if (!roleListingId || !packageId || !packageVersion || amountCents === undefined) {
      continue;
    }

    const receivedAt = toIsoString(record.received_at);
    const usage = modelUsageFromRecord(record, ledger);
    const role = params.roles.get(roleListingId);
    const key = `${roleListingId}:${packageId}:${packageVersion}`;
    const current = byRole.get(key) ?? {
      roleListingId,
      title: role?.title ?? "未知岗位",
      packageId,
      packageVersion,
      executionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      roleUsageReceivableCents: 0,
      lastReceivedAt: null,
    };
    current.executionCount += 1;
    current.inputTokens += usage.inputTokens;
    current.outputTokens += usage.outputTokens;
    current.roleUsageReceivableCents += amountCents;
    current.lastReceivedAt = laterTimestamp(current.lastReceivedAt, receivedAt);
    byRole.set(key, current);
  }

  return [...byRole.values()].sort((a, b) =>
    (b.lastReceivedAt ?? "").localeCompare(a.lastReceivedAt ?? ""),
  );
}

function authorizationEventsFromEntitlements(params: {
  sellerId: string;
  roles: Map<string, ReceivableRole>;
  entitlements: unknown[];
}): DijieVendorAuthorizationEvent[] {
  return params.entitlements
    .map(asRecord)
    .filter((entitlement) => {
      return (
        nonEmptyString(entitlement.billing_beneficiary_ref) === params.sellerId &&
        nonEmptyString(entitlement.entitlement_status) === "authorized"
      );
    })
    .map((entitlement) => {
      const roleListingId = nonEmptyString(entitlement.role_listing_id) ?? "unknown_role";
      const pricing = asRecord(entitlement.pricing);
      const role = params.roles.get(roleListingId);
      return {
        roleListingId,
        title: role?.title ?? "未知岗位",
        source: nonEmptyString(entitlement.source) === "checkout" ? "checkout" : "entitlement",
        authorizationFeeCents:
          nonNegativeInteger(pricing.authorizationFeeCents) ??
          role?.pricing.authorizationFeeCents ??
          0,
        developerReceivableCents:
          nonNegativeInteger(pricing.developerReceivableCents) ??
          role?.pricing.developerReceivableCents ??
          0,
        currency: "CNY",
        authorizedAt: toIsoString(entitlement.authorized_at),
      } satisfies DijieVendorAuthorizationEvent;
    })
    .sort((a, b) => (b.authorizedAt ?? "").localeCompare(a.authorizedAt ?? ""));
}

function usageEventsFromAuditRecords(params: {
  sellerId: string;
  roles: Map<string, ReceivableRole>;
  auditRecords: unknown[];
}): DijieVendorUsageEvent[] {
  return latestRecordsByExecution(params.auditRecords)
    .flatMap((record) => {
      const ledger = asRecord(record.role_usage_ledger);
      const billingBeneficiaryRef =
        nonEmptyString(record.billing_beneficiary_ref) ??
        nonEmptyString(ledger.billingBeneficiaryRef);
      if (billingBeneficiaryRef !== params.sellerId || ledger.source !== "role_usage") {
        return [];
      }

      const roleListingId =
        nonEmptyString(record.role_listing_id) ??
        nonEmptyString(ledger.roleListingId);
      const packageId =
        nonEmptyString(record.package_id) ??
        nonEmptyString(ledger.packageId);
      const packageVersion =
        nonEmptyString(record.package_version) ??
        nonEmptyString(ledger.packageVersion);
      const amountCents = nonNegativeInteger(ledger.developerReceivableCents);
      if (!roleListingId || !packageId || !packageVersion || amountCents === undefined) {
        return [];
      }

      const role = params.roles.get(roleListingId);
      const usage = modelUsageFromRecord(record, ledger);
      return [
        {
          roleListingId,
          title: role?.title ?? "未知岗位",
          packageId,
          packageVersion,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          developerReceivableCents: amountCents,
          currency: "CNY",
          receivedAt: toIsoString(record.received_at),
        } satisfies DijieVendorUsageEvent,
      ];
    })
    .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
}

function aggregateAuthorizationEventsByRole(
  events: DijieVendorAuthorizationEvent[],
): DijieVendorRoleAuthorizationReceivable[] {
  const byRole = new Map<string, DijieVendorRoleAuthorizationReceivable>();
  for (const event of events) {
    const current = byRole.get(event.roleListingId) ?? {
      roleListingId: event.roleListingId,
      title: event.title,
      authorizationCount: 0,
      authorizationReceivableCents: 0,
      lastAuthorizedAt: null,
    };
    current.authorizationCount += 1;
    current.authorizationReceivableCents += event.developerReceivableCents;
    current.lastAuthorizedAt = laterTimestamp(current.lastAuthorizedAt, event.authorizedAt);
    byRole.set(event.roleListingId, current);
  }
  return [...byRole.values()].sort((a, b) =>
    (b.lastAuthorizedAt ?? "").localeCompare(a.lastAuthorizedAt ?? ""),
  );
}

function mergeAuthorizationReceivables(params: {
  entitlementBacked: DijieVendorRoleAuthorizationReceivable[];
  orderBacked: DijieVendorRoleAuthorizationReceivable[];
}): DijieVendorRoleAuthorizationReceivable[] {
  const byRole = new Map<string, DijieVendorRoleAuthorizationReceivable>();
  for (const role of params.entitlementBacked) {
    byRole.set(role.roleListingId, role);
  }
  for (const role of params.orderBacked) {
    if (!byRole.has(role.roleListingId)) {
      byRole.set(role.roleListingId, role);
    }
  }
  return [...byRole.values()].sort((a, b) =>
    (b.lastAuthorizedAt ?? "").localeCompare(a.lastAuthorizedAt ?? ""),
  );
}

export function createDijieVendorReceivablesReadModel(params: {
  sellerId: string;
  products: unknown[];
  roleListings?: unknown[];
  entitlements?: unknown[];
  orderGroups: unknown[];
  orders: unknown[];
  auditRecords: unknown[];
}): DijieVendorReceivablesReadModel {
  const roles = createSellerRoleMap({
    sellerId: params.sellerId,
    products: params.products,
    roleListings: params.roleListings,
  });
  const orderAuthorizationByRole = aggregateAuthorizationReceivables({
    sellerId: params.sellerId,
    roles,
    orderGroups: params.orderGroups,
    orders: params.orders,
  });
  const roleUsageByRole = aggregateRoleUsageReceivables({
    sellerId: params.sellerId,
    roles,
    auditRecords: params.auditRecords,
  });
  const authorizationEvents = authorizationEventsFromEntitlements({
    sellerId: params.sellerId,
    roles,
    entitlements: params.entitlements ?? [],
  });
  const authorizationByRole = mergeAuthorizationReceivables({
    entitlementBacked: aggregateAuthorizationEventsByRole(authorizationEvents),
    orderBacked: orderAuthorizationByRole,
  });
  const usageEvents = usageEventsFromAuditRecords({
    sellerId: params.sellerId,
    roles,
    auditRecords: params.auditRecords,
  });

  const authorizationReceivableCents = authorizationByRole.reduce(
    (sum, role) => sum + role.authorizationReceivableCents,
    0,
  );
  const roleUsageReceivableCents = roleUsageByRole.reduce(
    (sum, role) => sum + role.roleUsageReceivableCents,
    0,
  );
  const inputTokens = roleUsageByRole.reduce((sum, role) => sum + role.inputTokens, 0);
  const outputTokens = roleUsageByRole.reduce((sum, role) => sum + role.outputTokens, 0);

  return {
    summary: {
      currency: "CNY",
      authorizationReceivableCents,
      roleUsageReceivableCents,
      totalDeveloperReceivableCents: authorizationReceivableCents + roleUsageReceivableCents,
      platformReceivableCents: 0,
      authorizationCount: authorizationByRole.reduce(
        (sum, role) => sum + role.authorizationCount,
        0,
      ),
      executionCount: roleUsageByRole.reduce((sum, role) => sum + role.executionCount, 0),
      inputTokens,
      outputTokens,
    },
    authorizationByRole,
    roleUsageByRole,
    authorizationEvents,
    usageEvents,
  };
}

export async function getDijieVendorReceivablesReadModel(params: {
  sellerId: string;
  queryGraph: DijieReceivablesQueryGraph;
}): Promise<DijieVendorReceivablesReadModel> {
  const [productResult, listingResult, entitlementResult, orderGroupResult, orderResult, auditResult] = await Promise.all([
    params.queryGraph({
      entity: "product",
      fields: ["id", "title", "metadata", "seller.id"],
      pagination: { take: 200 },
    }),
    params.queryGraph({
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
        "category",
        "listing_status",
        "review_state",
        "capabilities",
        "manifest_summary",
        "pricing",
        "role_token_pricing",
        "scopes",
      ],
      filters: { billing_beneficiary_ref: params.sellerId },
      pagination: { take: 200 },
    }),
    params.queryGraph({
      entity: "dijie_role_entitlement",
      fields: [
        "id",
        "actor_id",
        "role_listing_id",
        "package_id",
        "package_version",
        "developer_ref",
        "listing_owner_ref",
        "billing_beneficiary_ref",
        "entitlement_status",
        "source",
        "order_id",
        "pricing",
        "role_token_pricing",
        "authorized_at",
      ],
      filters: {
        billing_beneficiary_ref: params.sellerId,
        entitlement_status: "authorized",
      },
      pagination: { take: 200 },
    }),
    params.queryGraph({
      entity: "order_group",
      fields: [
        "id",
        "customer_id",
        "orders.id",
        "orders.status",
        "orders.payment_status",
        "orders.created_at",
        "orders.updated_at",
        "orders.completed_at",
        "orders.payment_collections.status",
        "orders.payment_collections.amount",
        "orders.payment_collections.captured_amount",
        "orders.items.product_id",
        "orders.items.variant.product_id",
        "orders.items.variant.product.id",
        "orders.items.product.id",
        "orders.items.metadata",
      ],
      pagination: { take: 200 },
    }),
    params.queryGraph({
      entity: "order",
      fields: [
        "id",
        "order_group_id",
        "customer_id",
        "status",
        "payment_status",
        "created_at",
        "updated_at",
        "completed_at",
        "payment_collections.status",
        "payment_collections.amount",
        "payment_collections.captured_amount",
        "items.product_id",
        "items.variant.product_id",
        "items.variant.product.id",
        "items.product.id",
        "items.metadata",
      ],
      pagination: { take: 200 },
    }),
    params.queryGraph({
      entity: "dijie_audit_record",
      fields: [
        "execution_id",
        "role_listing_id",
        "package_id",
        "package_version",
        "billing_beneficiary_ref",
        "role_usage_ledger",
        "model_proxy_usage",
        "received_at",
      ],
      filters: { billing_beneficiary_ref: params.sellerId },
      pagination: { take: 200 },
    }),
  ]);

  return createDijieVendorReceivablesReadModel({
    sellerId: params.sellerId,
    products: productResult.data ?? [],
    roleListings: listingResult.data ?? [],
    entitlements: entitlementResult.data ?? [],
    orderGroups: orderGroupResult.data ?? [],
    orders: orderResult.data ?? [],
    auditRecords: auditResult.data ?? [],
  });
}
