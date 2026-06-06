import {
  createDijieRoleListingFromStoredRecord,
} from "./role-listings";
import type { DijieRoleListingStorageRecord } from "./role-listing-store";
import type {
  DijieExecutionTokenPricing,
  DijieRoleTokenPricing,
} from "./execution-token";

export type DijieRoleEntitlementStatus = "authorized" | "revoked";
export type DijieRoleEntitlementSource = "zero_price" | "checkout";

export type DijieRoleEntitlementStorageRecord = {
  id?: string;
  actor_id: string;
  role_listing_id: string;
  package_id: string;
  package_version: string;
  developer_ref: string;
  listing_owner_ref: string;
  billing_beneficiary_ref: string;
  entitlement_status: DijieRoleEntitlementStatus;
  source: DijieRoleEntitlementSource;
  order_id: string | null;
  pricing: DijieExecutionTokenPricing;
  role_token_pricing: DijieRoleTokenPricing;
  authorized_at: Date;
};

export type DijieRoleEntitlementRepository = {
  createDijieRoleEntitlements: (
    data: Omit<DijieRoleEntitlementStorageRecord, "id">,
  ) => Promise<DijieRoleEntitlementStorageRecord & { id: string }>;
};

export type DijieRoleEntitlementLookupRepository = {
  listDijieRoleEntitlements: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRoleEntitlementStorageRecord & { id: string }>>;
};

export type DijieRoleEntitlementStore = {
  authorizeDijieRoleListing: (input: {
    actorId: string;
    roleListingId: string;
  }) => Promise<DijieRoleEntitlementMutationResult>;
  authorizeDijiePaidRoleListing: (input: {
    actorId: string;
    roleListingId: string;
    orderId: string;
  }) => Promise<DijieRoleEntitlementMutationResult>;
};

export type DijieRoleEntitlementMutationResult =
  | {
      ok: true;
      value: {
        entitlementId: string;
        entitlement: DijieRoleEntitlementStorageRecord & { id: string };
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
      code?: "checkout_required";
    };

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function publishedListingFromRecord(
  record: DijieRoleListingStorageRecord & { id: string },
) {
  const listing = createDijieRoleListingFromStoredRecord(record);
  if (!listing || !listing.packageId || !listing.packageVersion) {
    return undefined;
  }
  const raw = asRecord(record);
  const developerRef = nonEmptyString(raw.developer_ref);
  if (!developerRef) {
    return undefined;
  }
  return {
    listing,
    developerRef,
    listingOwnerRef: nonEmptyString(raw.listing_owner_ref) ?? developerRef,
    billingBeneficiaryRef: nonEmptyString(raw.billing_beneficiary_ref) ?? developerRef,
  };
}

export async function authorizeDijieRoleListingWithRepository(
  repository: DijieRoleEntitlementRepository &
    DijieRoleEntitlementLookupRepository & {
      listDijieRoleListings: (
        filters?: Record<string, unknown>,
        config?: { take?: number },
      ) => Promise<Array<DijieRoleListingStorageRecord & { id: string }>>;
    },
  input: { actorId: string; roleListingId: string },
): Promise<DijieRoleEntitlementMutationResult> {
  const actorId = nonEmptyString(input.actorId);
  const roleListingId = nonEmptyString(input.roleListingId);
  if (!actorId || !roleListingId) {
    return { ok: false, status: 400, error: "授权岗位需要登录账号并选择岗位。" };
  }

  const [existing] = await repository.listDijieRoleEntitlements(
    {
      actor_id: actorId,
      role_listing_id: roleListingId,
      entitlement_status: "authorized",
    },
    { take: 1, order: { authorized_at: "DESC" } },
  );
  if (existing) {
    return {
      ok: true,
      value: {
        entitlementId: existing.id,
        entitlement: existing,
      },
    };
  }

  const [record] = await repository.listDijieRoleListings(
    {
      id: roleListingId,
    },
    { take: 1 },
  );
  if (!record) {
    return { ok: false, status: 404, error: "未找到可授权的岗位。" };
  }

  const publicListing = publishedListingFromRecord(record);
  if (!publicListing) {
    return { ok: false, status: 403, error: "岗位尚未发布或未通过审核，不能授权。" };
  }

  if (publicListing.listing.pricing.authorizationFeeCents > 0) {
    return {
      ok: false,
      status: 402,
      code: "checkout_required",
      error: "该岗位需要完成结算后才能生成授权。",
    };
  }

  const entitlement = await repository.createDijieRoleEntitlements({
    actor_id: actorId,
    role_listing_id: publicListing.listing.id,
    package_id: publicListing.listing.packageId!,
    package_version: publicListing.listing.packageVersion!,
    developer_ref: publicListing.developerRef,
    listing_owner_ref: publicListing.listingOwnerRef,
    billing_beneficiary_ref: publicListing.billingBeneficiaryRef,
    entitlement_status: "authorized",
    source: "zero_price",
    order_id: null,
    pricing: publicListing.listing.pricing,
    role_token_pricing: publicListing.listing.roleTokenPricing,
    authorized_at: new Date(),
  });

  return {
    ok: true,
    value: {
      entitlementId: entitlement.id,
      entitlement,
    },
  };
}

export async function authorizeDijiePaidRoleListingWithRepository(
  repository: DijieRoleEntitlementRepository &
    DijieRoleEntitlementLookupRepository & {
      listDijieRoleListings: (
        filters?: Record<string, unknown>,
        config?: { take?: number },
      ) => Promise<Array<DijieRoleListingStorageRecord & { id: string }>>;
    },
  input: { actorId: string; roleListingId: string; orderId: string },
): Promise<DijieRoleEntitlementMutationResult> {
  const actorId = nonEmptyString(input.actorId);
  const roleListingId = nonEmptyString(input.roleListingId);
  const orderId = nonEmptyString(input.orderId);
  if (!actorId || !roleListingId || !orderId) {
    return {
      ok: false,
      status: 400,
      error: "付费岗位授权需要登录账号、岗位和已支付订单。",
    };
  }

  const sameOrderEntitlements = await repository.listDijieRoleEntitlements(
    {
      actor_id: actorId,
      role_listing_id: roleListingId,
      source: "checkout",
      order_id: orderId,
    },
    { take: 5, order: { authorized_at: "DESC" } },
  );
  const existing = sameOrderEntitlements.find(
    (entitlement) =>
      entitlement.actor_id === actorId &&
      entitlement.role_listing_id === roleListingId &&
      entitlement.source === "checkout" &&
      entitlement.order_id === orderId &&
      entitlement.entitlement_status === "authorized",
  );
  if (existing) {
    return {
      ok: true,
      value: {
        entitlementId: existing.id,
        entitlement: existing,
      },
    };
  }

  const revoked = sameOrderEntitlements.some(
    (entitlement) =>
      entitlement.actor_id === actorId &&
      entitlement.role_listing_id === roleListingId &&
      entitlement.source === "checkout" &&
      entitlement.order_id === orderId &&
      entitlement.entitlement_status === "revoked",
  );
  if (revoked) {
    return {
      ok: false,
      status: 403,
      error: "该订单对应的岗位授权已被撤销，不能再次使用。",
    };
  }

  const [record] = await repository.listDijieRoleListings(
    {
      id: roleListingId,
    },
    { take: 1 },
  );
  if (!record) {
    return { ok: false, status: 404, error: "未找到可授权的岗位。" };
  }

  const publicListing = publishedListingFromRecord(record);
  if (!publicListing) {
    return { ok: false, status: 403, error: "岗位尚未发布或未通过审核，不能授权。" };
  }

  if (publicListing.listing.pricing.authorizationFeeCents <= 0) {
    return {
      ok: false,
      status: 400,
      error: "该岗位不需要付费订单授权。",
    };
  }

  const entitlement = await repository.createDijieRoleEntitlements({
    actor_id: actorId,
    role_listing_id: publicListing.listing.id,
    package_id: publicListing.listing.packageId!,
    package_version: publicListing.listing.packageVersion!,
    developer_ref: publicListing.developerRef,
    listing_owner_ref: publicListing.listingOwnerRef,
    billing_beneficiary_ref: publicListing.billingBeneficiaryRef,
    entitlement_status: "authorized",
    source: "checkout",
    order_id: orderId,
    pricing: publicListing.listing.pricing,
    role_token_pricing: publicListing.listing.roleTokenPricing,
    authorized_at: new Date(),
  });

  return {
    ok: true,
    value: {
      entitlementId: entitlement.id,
      entitlement,
    },
  };
}
