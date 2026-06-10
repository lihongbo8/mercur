import type {
  DijieExecutionTokenPricing,
  DijieRoleTokenPricing,
} from "./execution-token";
import type { DijieRoleListingStorageRecord } from "./role-listing-store";
import {
  isPublicDijieRoleProduct,
  normalizeDijieRoleProductMetadataFromProduct,
} from "./role-product-metadata";

export type DijieQueryGraph = (query: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
  pagination?: Record<string, unknown>;
}) => Promise<{ data?: unknown[] }>;

export type DijieRoleListing = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  usageInstructions: string | null;
  category: string | null;
  handle: string | null;
  listingStatus: string;
  reviewState: string | null;
  developerId: string | null;
  developerName: string | null;
  packageId: string | null;
  packageVersion: string | null;
  protocolVersion: string | null;
  capabilities: string[];
  pricing: DijieExecutionTokenPricing;
  roleTokenPricing: DijieRoleTokenPricing;
  scopes: string[];
  checkout?: DijieRoleCheckoutReadModel;
};

export type DijieRoleCheckoutReadModel = {
  requiresCheckout: boolean;
  productId: string | null;
  variantId: string | null;
};

export type DijiePublicRoleListingReadModel = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  usageInstructions: string | null;
  category: string | null;
  handle: string | null;
  listingStatus: string;
  reviewState: string | null;
  developerName: string | null;
  capabilities: string[];
  pricing: Pick<
    DijieExecutionTokenPricing,
    "kind" | "authorizationFeeCents" | "currency"
  >;
  roleTokenPricing: Pick<
    DijieRoleTokenPricing,
    "inputTokenCentsPerMillion" | "outputTokenCentsPerMillion" | "currency"
  >;
  authorizationSummary: {
    authorizationFeeCents: number;
    currency: "CNY";
    executionFeeNote: string;
  };
  tokenUsageSummary: {
    inputTokenFee: string;
    outputTokenFee: string;
    executionFeeNote: string;
  };
  checkout: DijieRoleCheckoutReadModel;
};

export type DijieRoleDetailReadModel = DijiePublicRoleListingReadModel & {
  detailSections: {
    roleDetails: string[];
    usageInstructions: string[];
    executionStandards: string[];
    requiredCapabilities: string[];
    failureBoundaries: string[];
    inputRequirements: string[];
    outputExamples: string[];
    humanConfirmations: string[];
    reviewInfo: string[];
  };
  relatedRoles: Array<
    Pick<DijieRoleListing, "id" | "title" | "subtitle" | "handle">
  >;
};

export type DijieInstalledRole = {
  entitlementId: string;
  entitlementSource: "local_entitlement" | "order_group" | "order";
  orderId: string | null;
  authorizedAt: string | null;
  role: DijiePublicRoleListingReadModel &
    Pick<
      DijieRoleListing,
      | "packageId"
      | "packageVersion"
      | "protocolVersion"
      | "developerId"
      | "scopes"
    >;
};

type UnknownRecord = Record<string, unknown>;

const BLOCKED_ORDER_STATUSES = new Set(["canceled", "cancelled"]);
const PAID_ORDER_STATUSES = new Set(["completed"]);
const PAID_PAYMENT_STATUSES = new Set(["authorized", "captured", "paid", "completed"]);
const ROLE_PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "handle",
  "status",
  "metadata",
  "seller.id",
  "seller.name",
  "variants.id",
];

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function dateString(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return nonEmptyString(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function metadata(record: UnknownRecord): UnknownRecord {
  return asRecord(record.metadata);
}

function sellerRecord(product: UnknownRecord): UnknownRecord {
  return asRecord(product.seller);
}

function firstVariantId(product: UnknownRecord): string | null {
  const variants = Array.isArray(product.variants)
    ? product.variants.map(asRecord)
    : [];
  return nonEmptyString(variants[0]?.id) ?? null;
}

function createCheckoutReadModel(params: {
  authorizationFeeCents?: number;
  productId?: string | null;
  variantId?: string | null;
}): DijieRoleCheckoutReadModel {
  const authorizationFeeCents = Number(params.authorizationFeeCents ?? 0);
  return {
    requiresCheckout:
      Number.isFinite(authorizationFeeCents) && authorizationFeeCents > 0,
    productId: params.productId ?? null,
    variantId: params.variantId ?? null,
  };
}

export function createDijieRoleListingFromProduct(
  productInput: unknown,
): DijieRoleListing | undefined {
  const product = asRecord(productInput);
  const id = nonEmptyString(product.id);
  if (!id) {
    return undefined;
  }

  const roleResult = normalizeDijieRoleProductMetadataFromProduct(product);
  if (!roleResult.ok || !isPublicDijieRoleProduct(roleResult.value)) {
    return undefined;
  }
  const role = roleResult.value;
  const seller = sellerRecord(product);
  const capabilities =
    role.capabilities.length > 0
      ? role.capabilities
      : (role.manifestSummary.requiredCapabilities ?? []);
  return {
    id,
    title:
      nonEmptyString(role.title) ??
      nonEmptyString(product.title) ??
      "未命名岗位",
    subtitle: nonEmptyString(role.subtitle ?? product.subtitle) ?? null,
    description:
      nonEmptyString(role.description ?? product.description) ?? null,
    usageInstructions: nonEmptyString(role.usageInstructions) ?? null,
    category: nonEmptyString((role as { category?: unknown }).category) ?? null,
    handle: nonEmptyString(product.handle) ?? null,
    listingStatus: role.listingStatus,
    reviewState: role.reviewState,
    developerId:
      nonEmptyString(role.developerRef) ?? nonEmptyString(seller.id) ?? null,
    developerName: nonEmptyString(seller.name) ?? null,
    packageId: role.packageId,
    packageVersion: role.packageVersion,
    protocolVersion: role.protocolVersion,
    capabilities,
    pricing: role.pricing,
    roleTokenPricing: role.roleTokenPricing,
    scopes: role.scopes,
    checkout: createCheckoutReadModel({
      authorizationFeeCents: role.pricing.authorizationFeeCents,
      productId: id,
      variantId: firstVariantId(product),
    }),
  };
}

export function createDijieRoleListingFromStoredRecord(
  recordInput: unknown,
): DijieRoleListing | undefined {
  const record = asRecord(recordInput) as UnknownRecord &
    Partial<DijieRoleListingStorageRecord>;
  const id = nonEmptyString(record.id);
  const title = nonEmptyString(record.title);
  const packageId = nonEmptyString(record.package_id);
  const packageVersion = nonEmptyString(record.package_version);
  if (!id || !title || !packageId || !packageVersion) {
    return undefined;
  }
  if (
    record.listing_status !== "published" ||
    record.review_state !== "approved"
  ) {
    return undefined;
  }

  const capabilities = Array.isArray(record.capabilities)
    ? stringArray(record.capabilities)
    : [];
  const manifestSummary = asRecord(record.manifest_summary);
  const fallbackCapabilities = stringArray(
    manifestSummary.requiredCapabilities ??
      manifestSummary.required_capabilities,
  );
  const pricing = record.pricing as DijieExecutionTokenPricing | undefined;
  const roleTokenPricing = record.role_token_pricing as
    | DijieRoleTokenPricing
    | undefined;
  if (!pricing || !roleTokenPricing) {
    return undefined;
  }

  return {
    id,
    title,
    subtitle: nonEmptyString(record.subtitle) ?? null,
    description: nonEmptyString(record.description) ?? null,
    usageInstructions: nonEmptyString(record.usage_instructions) ?? null,
    category: nonEmptyString(record.category) ?? null,
    handle: id,
    listingStatus: record.listing_status,
    reviewState: record.review_state,
    developerId: nonEmptyString(record.developer_ref) ?? null,
    developerName: null,
    packageId,
    packageVersion,
    protocolVersion: "2026-05",
    capabilities: capabilities.length > 0 ? capabilities : fallbackCapabilities,
    pricing,
    roleTokenPricing,
    scopes: Array.isArray(record.scopes)
      ? stringArray(record.scopes)
      : ["role.execute", "audit.write"],
    checkout: createCheckoutReadModel({
      authorizationFeeCents: pricing.authorizationFeeCents,
    }),
  };
}

function createRoleDetails(listing: DijieRoleListing): string[] {
  return [listing.description, listing.subtitle].filter(
    (value): value is string => Boolean(value),
  );
}

function textLines(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function createUsageInstructions(listing: DijieRoleListing): string[] {
  const explicit = textLines(listing.usageInstructions);
  if (explicit.length > 0) {
    return explicit;
  }
  const capabilityText = listing.capabilities.join("、");
  if (
    /image|图片|视觉|主图|详情|design|generate|inspect/i.test(capabilityText)
  ) {
    return [
      "在使用窗口说明商品、平台、目标风格、卖点、禁用元素和人工确认标准。",
      "有图片素材时上传商品图、主图或详情页素材；没有图片时先提供明确文字设计需求。",
    ];
  }
  return ["在使用窗口提供业务目标、必要材料、约束条件和人工确认标准。"];
}

function createExecutionStandards(listing: DijieRoleListing): string[] {
  return listing.capabilities.length > 0
    ? listing.capabilities.map(
        (capability) => `${capability}：按岗位包公开规则执行并输出可审计结果。`,
      )
    : ["按岗位包公开规则执行并输出可审计结果。"];
}

function createFailureBoundaries(listing: DijieRoleListing): string[] {
  const capabilityHint =
    listing.capabilities.length > 0
      ? `未获得 ${listing.capabilities[0]} 所需本地能力时停止执行。`
      : "未获得所需本地能力时停止执行。";
  return [
    capabilityHint,
    "授权、确认点或审计回读缺失时停止执行。",
    "岗位包只提供业务规则和能力需求，不包含本地工具实现。",
  ];
}

function createInputRequirements(listing: DijieRoleListing): string[] {
  const capabilityText = listing.capabilities.join("、");
  if (
    /image|图片|视觉|主图|详情|design|generate|inspect/i.test(capabilityText)
  ) {
    return [
      "提供商品图、详情页素材或明确的文字需求。",
      "提供品牌、卖点、平台规则和人工确认标准。",
    ];
  }
  return ["提供岗位执行所需的业务材料、目标和人工确认标准。"];
}

function createOutputExamples(listing: DijieRoleListing): string[] {
  const capabilityText = listing.capabilities.join("、");
  if (
    /image|图片|视觉|主图|详情|design|generate|inspect/i.test(capabilityText)
  ) {
    return ["主图巡检报告", "详情页优化清单", "设计方案文本或图片产物引用"];
  }
  return ["业务结果摘要", "可回读 artifact 引用", "审计与费用记录摘要"];
}

function createHumanConfirmations(): string[] {
  return [
    "购买/授权前需要用户确认。",
    "执行前的输入、费用和高风险动作需要进入使用者中心或 OpenClaw 正式确认点。",
  ];
}

function tokenCentsPerMillionLabel(value: number): string {
  return `¥${(value / 100).toFixed(2)}/百万 Token`;
}

function roleProductCheckoutMappings(products: unknown[]) {
  const byRoleListingId = new Map<string, DijieRoleCheckoutReadModel>();
  const byPackageKey = new Map<string, DijieRoleCheckoutReadModel | null>();

  for (const productInput of products) {
    const product = asRecord(productInput);
    const productId = nonEmptyString(product.id);
    if (!productId) {
      continue;
    }
    const roleResult = normalizeDijieRoleProductMetadataFromProduct(product);
    if (!roleResult.ok || !isPublicDijieRoleProduct(roleResult.value)) {
      continue;
    }

    const role = roleResult.value;
    const checkout = createCheckoutReadModel({
      authorizationFeeCents: role.pricing.authorizationFeeCents,
      productId,
      variantId: firstVariantId(product),
    });
    if (role.roleListingId) {
      byRoleListingId.set(role.roleListingId, checkout);
    }
    byRoleListingId.set(productId, checkout);

    const packageKey = `${role.packageId}@${role.packageVersion}`;
    byPackageKey.set(
      packageKey,
      byPackageKey.has(packageKey) ? null : checkout,
    );
  }

  return { byRoleListingId, byPackageKey };
}

function attachCheckoutMappingsToStoredListings(
  listings: DijieRoleListing[],
  products: unknown[],
): DijieRoleListing[] {
  const mappings = roleProductCheckoutMappings(products);
  return listings.map((listing) => {
    const packageKey =
      listing.packageId && listing.packageVersion
        ? `${listing.packageId}@${listing.packageVersion}`
        : undefined;
    const checkout =
      mappings.byRoleListingId.get(listing.id) ??
      (packageKey ? mappings.byPackageKey.get(packageKey) ?? undefined : undefined);
    return {
      ...listing,
      checkout: checkout ?? listing.checkout,
    };
  });
}

export function createDijiePublicRoleListingReadModel(
  listing: DijieRoleListing,
): DijiePublicRoleListingReadModel {
  return {
    id: listing.id,
    title: listing.title,
    subtitle: listing.subtitle,
    description: listing.description,
    usageInstructions: listing.usageInstructions,
    category: listing.category,
    handle: listing.handle,
    listingStatus: listing.listingStatus,
    reviewState: listing.reviewState,
    developerName: listing.developerName,
    capabilities: listing.capabilities,
    pricing: {
      kind: listing.pricing.kind,
      authorizationFeeCents: listing.pricing.authorizationFeeCents,
      currency: listing.pricing.currency,
    },
    roleTokenPricing: {
      inputTokenCentsPerMillion:
        listing.roleTokenPricing.inputTokenCentsPerMillion,
      outputTokenCentsPerMillion:
        listing.roleTokenPricing.outputTokenCentsPerMillion,
      currency: listing.roleTokenPricing.currency,
    },
    authorizationSummary: {
      authorizationFeeCents: listing.pricing.authorizationFeeCents,
      currency: "CNY",
      executionFeeNote:
        "执行费用按实际输入/输出 Token 用量进入 ledger/readback。",
    },
    tokenUsageSummary: {
      inputTokenFee: tokenCentsPerMillionLabel(
        listing.roleTokenPricing.inputTokenCentsPerMillion,
      ),
      outputTokenFee: tokenCentsPerMillionLabel(
        listing.roleTokenPricing.outputTokenCentsPerMillion,
      ),
      executionFeeNote:
        "消费者执行前可查看单价，执行后以账本实际用量和费用为准。",
    },
    checkout: createCheckoutReadModel({
      authorizationFeeCents: listing.pricing.authorizationFeeCents,
      productId: listing.checkout?.productId,
      variantId: listing.checkout?.variantId,
    }),
  };
}

export function createDijieRoleDetailReadModel(
  listing: DijieRoleListing,
  allListings: DijieRoleListing[],
): DijieRoleDetailReadModel {
  return {
    ...createDijiePublicRoleListingReadModel(listing),
    detailSections: {
      roleDetails: createRoleDetails(listing),
      usageInstructions: createUsageInstructions(listing),
      executionStandards: createExecutionStandards(listing),
      requiredCapabilities: listing.capabilities,
      failureBoundaries: createFailureBoundaries(listing),
      inputRequirements: createInputRequirements(listing),
      outputExamples: createOutputExamples(listing),
      humanConfirmations: createHumanConfirmations(),
      reviewInfo: [
        "该岗位只在 approved + published 后进入商城。",
        "商城只负责购买前解释和授权入口，不执行岗位任务。",
      ],
    },
    relatedRoles: allListings
      .filter((candidate) => candidate.id !== listing.id)
      .slice(0, 3)
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        subtitle: candidate.subtitle,
        handle: candidate.handle,
      })),
  };
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
    return (
      Number.isFinite(amount) &&
      amount > 0 &&
      Number.isFinite(capturedAmount) &&
      capturedAmount >= amount
    );
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
    return Array.isArray(orderGroup.orders)
      ? orderGroup.orders.map(asRecord)
      : [];
  });
}

function entitlementSourceRank(
  source: DijieInstalledRole["entitlementSource"],
): number {
  if (source === "local_entitlement") {
    return 0;
  }
  if (source === "order_group") {
    return 1;
  }
  return 2;
}

function uniqueInstalledRoles(
  roles: DijieInstalledRole[],
): DijieInstalledRole[] {
  const byRoleId = new Map<string, DijieInstalledRole>();
  for (const role of roles) {
    const existing = byRoleId.get(role.role.id);
    if (
      !existing ||
      entitlementSourceRank(role.entitlementSource) <
        entitlementSourceRank(existing.entitlementSource)
    ) {
      byRoleId.set(role.role.id, role);
    }
  }
  return [...byRoleId.values()];
}

function createInstalledRoleReadModel(
  role: DijieRoleListing,
): DijieInstalledRole["role"] {
  return {
    ...createDijiePublicRoleListingReadModel(role),
    packageId: role.packageId,
    packageVersion: role.packageVersion,
    protocolVersion: role.protocolVersion,
    developerId: role.developerId,
    scopes: role.scopes,
  };
}

export function createDijieInstalledRolesFromMarketplaceFacts(params: {
  products: unknown[];
  roleListings?: unknown[];
  entitlements?: unknown[];
  orderGroups: unknown[];
  orders: unknown[];
  includeLegacyOrderFacts?: boolean;
}): DijieInstalledRole[] {
  const listings = new Map<string, DijieRoleListing>();
  const storedListings = (params.roleListings ?? [])
    .map(createDijieRoleListingFromStoredRecord)
    .filter((listing): listing is DijieRoleListing => Boolean(listing));
  const listingFacts =
    storedListings.length > 0
      ? storedListings
      : params.products
          .map(createDijieRoleListingFromProduct)
          .filter((listing): listing is DijieRoleListing => Boolean(listing));
  for (const listing of listingFacts) {
    if (listing) {
      listings.set(listing.id, listing);
    }
  }

  const installed: DijieInstalledRole[] = [];
  for (const entitlementInput of params.entitlements ?? []) {
    const entitlement = asRecord(entitlementInput);
    if (entitlement.entitlement_status !== "authorized") {
      continue;
    }
    const entitlementId = nonEmptyString(entitlement.id);
    const roleListingId = nonEmptyString(entitlement.role_listing_id);
    const role = roleListingId ? listings.get(roleListingId) : undefined;
    if (!entitlementId || !role) {
      continue;
    }
    installed.push({
      entitlementId,
      entitlementSource: "local_entitlement",
      orderId: nonEmptyString(entitlement.order_id) ?? null,
      authorizedAt: dateString(entitlement.authorized_at) ?? null,
      role: createInstalledRoleReadModel(role),
    });
  }

  if (params.includeLegacyOrderFacts === true) {
    const orderGroupsByOrderId = new Map<string, string>();
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

    for (const order of [
      ...ordersFromOrderGroups(params.orderGroups),
      ...params.orders.map(asRecord),
    ]) {
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
        nonEmptyString(order.created_at) ??
        nonEmptyString(order.updated_at) ??
        nonEmptyString(order.completed_at) ??
        null;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        for (const productId of itemProductIds(item)) {
          const role = listings.get(productId);
          if (!role) {
            continue;
          }
          installed.push({
            entitlementId,
            entitlementSource:
              orderId && orderGroupsByOrderId.has(orderId)
                ? "order_group"
                : "order",
            orderId: orderId ?? null,
            authorizedAt,
            role: createInstalledRoleReadModel(role),
          });
        }
      }
    }
  }

  return uniqueInstalledRoles(installed);
}

export async function listDijieRoleListings(
  queryGraph: DijieQueryGraph,
): Promise<DijieRoleListing[]> {
  try {
    const { data = [] } = await queryGraph({
      entity: "dijie_role_listing",
      fields: [
        "id",
        "package_id",
        "package_version",
        "developer_ref",
        "title",
        "subtitle",
        "description",
        "usage_instructions",
        "category",
        "listing_status",
        "review_state",
        "capabilities",
        "manifest_summary",
        "pricing",
        "role_token_pricing",
        "scopes",
      ],
      filters: {
        listing_status: "published",
        review_state: "approved",
      },
      pagination: { take: 100 },
    });
    const storedListings = data
      .map(createDijieRoleListingFromStoredRecord)
      .filter((listing): listing is DijieRoleListing => Boolean(listing));
    if (storedListings.length > 0) {
      const productResult = await queryGraph({
        entity: "product",
        fields: ROLE_PRODUCT_FIELDS,
        pagination: { take: 100 },
      }).catch(() => ({ data: [] }));
      return attachCheckoutMappingsToStoredListings(
        storedListings,
        productResult.data ?? [],
      );
    }
  } catch {
    // Older local databases may not have the stored listing table yet; keep product fallback.
  }

  const { data = [] } = await queryGraph({
    entity: "product",
    fields: ROLE_PRODUCT_FIELDS,
    pagination: { take: 100 },
  });

  return data
    .map(createDijieRoleListingFromProduct)
    .filter((listing): listing is DijieRoleListing => Boolean(listing));
}

export async function listDijiePublicRoleListingReadModels(
  queryGraph: DijieQueryGraph,
): Promise<DijiePublicRoleListingReadModel[]> {
  const listings = await listDijieRoleListings(queryGraph);
  return listings.map(createDijiePublicRoleListingReadModel);
}

export async function getDijieRoleDetailReadModel(params: {
  roleListingId: string;
  queryGraph: DijieQueryGraph;
}): Promise<DijieRoleDetailReadModel | null> {
  const listings = await listDijieRoleListings(params.queryGraph);
  const listing = listings.find(
    (candidate) => candidate.id === params.roleListingId,
  );
  return listing ? createDijieRoleDetailReadModel(listing, listings) : null;
}

export async function listDijieInstalledRoles(params: {
  actorId: string;
  queryGraph: DijieQueryGraph;
}): Promise<DijieInstalledRole[]> {
  const storedListingResult = await params
    .queryGraph({
      entity: "dijie_role_listing",
      fields: [
        "id",
        "package_id",
        "package_version",
        "developer_ref",
        "title",
        "subtitle",
        "description",
        "usage_instructions",
        "category",
        "listing_status",
        "review_state",
        "capabilities",
        "manifest_summary",
        "pricing",
        "role_token_pricing",
        "scopes",
      ],
      filters: {
        listing_status: "published",
        review_state: "approved",
      },
      pagination: { take: 100 },
    })
    .catch(() => ({ data: [] }));
  const entitlementResult = await params
    .queryGraph({
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
        actor_id: params.actorId,
        entitlement_status: "authorized",
      },
      pagination: { take: 100 },
    })
    .catch(() => ({ data: [] }));

  const productResult = await params.queryGraph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "handle",
      "status",
      "metadata",
      "seller.id",
      "seller.name",
    ],
    pagination: { take: 100 },
  });

  return createDijieInstalledRolesFromMarketplaceFacts({
    products: productResult.data ?? [],
    roleListings: storedListingResult.data ?? [],
    entitlements: entitlementResult.data ?? [],
    orderGroups: [],
    orders: [],
  });
}
