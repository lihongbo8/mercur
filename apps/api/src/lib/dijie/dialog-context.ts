export type DijieDialogAccountType = "buyer" | "developer" | "admin";
export type DijieDialogSurface =
  | "buyer_storefront"
  | "user_center"
  | "developer_center"
  | "admin_review"
  | "openclaw_local";
export type DijieDialogMode = "user" | "developer" | "review";

export type DijieDialogSubject = {
  roleListingId?: string;
  packageId?: string;
  entitlementId?: string;
  executionId?: string;
  reviewId?: string;
};

export type DijieDialogContext = {
  accountId: string;
  accountType: DijieDialogAccountType;
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  subject: DijieDialogSubject;
  billingAccountId: string;
};

type UnknownRecord = Record<string, unknown>;

const ACCOUNT_TYPES = new Set<DijieDialogAccountType>(["buyer", "developer", "admin"]);
const SURFACES = new Set<DijieDialogSurface>([
  "buyer_storefront",
  "user_center",
  "developer_center",
  "admin_review",
  "openclaw_local",
]);
const MODES = new Set<DijieDialogMode>(["user", "developer", "review"]);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function subjectFromInput(value: unknown): DijieDialogSubject {
  const input = asRecord(value);
  return {
    ...(nonEmptyString(input.roleListingId ?? input.role_listing_id)
      ? { roleListingId: nonEmptyString(input.roleListingId ?? input.role_listing_id) }
      : {}),
    ...(nonEmptyString(input.packageId ?? input.package_id)
      ? { packageId: nonEmptyString(input.packageId ?? input.package_id) }
      : {}),
    ...(nonEmptyString(input.entitlementId ?? input.entitlement_id)
      ? { entitlementId: nonEmptyString(input.entitlementId ?? input.entitlement_id) }
      : {}),
    ...(nonEmptyString(input.executionId ?? input.execution_id)
      ? { executionId: nonEmptyString(input.executionId ?? input.execution_id) }
      : {}),
    ...(nonEmptyString(input.reviewId ?? input.review_id)
      ? { reviewId: nonEmptyString(input.reviewId ?? input.review_id) }
      : {}),
  };
}

export function createDijieDialogContext(input: {
  accountId: string;
  accountType: DijieDialogAccountType;
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  subject?: DijieDialogSubject;
  billingAccountId?: string;
}): DijieDialogContext {
  return {
    accountId: input.accountId,
    accountType: input.accountType,
    surface: input.surface,
    mode: input.mode,
    subject: input.subject ?? {},
    billingAccountId: input.billingAccountId ?? input.accountId,
  };
}

export function normalizeDijieDialogContext(value: unknown): DijieDialogContext | null {
  const input = asRecord(value);
  const accountId = nonEmptyString(input.accountId ?? input.account_id);
  const accountType = nonEmptyString(input.accountType ?? input.account_type);
  const surface = nonEmptyString(input.surface);
  const mode = nonEmptyString(input.mode);

  if (
    !accountId ||
    !accountType ||
    !surface ||
    !mode ||
    !ACCOUNT_TYPES.has(accountType as DijieDialogAccountType) ||
    !SURFACES.has(surface as DijieDialogSurface) ||
    !MODES.has(mode as DijieDialogMode)
  ) {
    return null;
  }

  return createDijieDialogContext({
    accountId,
    accountType: accountType as DijieDialogAccountType,
    surface: surface as DijieDialogSurface,
    mode: mode as DijieDialogMode,
    subject: subjectFromInput(input.subject),
    billingAccountId: nonEmptyString(input.billingAccountId ?? input.billing_account_id),
  });
}

export function createDijieAdminReviewDialogContext(params: {
  adminAccountId: string;
  roleListingId?: string;
  packageId?: string;
  reviewId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.adminAccountId,
    accountType: "admin",
    surface: "admin_review",
    mode: "review",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
      ...(params.packageId ? { packageId: params.packageId } : {}),
      ...(params.reviewId ? { reviewId: params.reviewId } : {}),
    },
  });
}

export function createDijieOpenClawUserDialogContext(params: {
  buyerAccountId: string;
  roleListingId?: string;
  entitlementId?: string;
  executionId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.buyerAccountId,
    accountType: "buyer",
    surface: "openclaw_local",
    mode: "user",
    subject: {
      ...(params.roleListingId ? { roleListingId: params.roleListingId } : {}),
      ...(params.entitlementId ? { entitlementId: params.entitlementId } : {}),
      ...(params.executionId ? { executionId: params.executionId } : {}),
    },
  });
}

export function createDijieDeveloperDialogContext(params: {
  developerAccountId: string;
  surface?: Extract<DijieDialogSurface, "developer_center" | "openclaw_local">;
  packageId?: string;
}): DijieDialogContext {
  return createDijieDialogContext({
    accountId: params.developerAccountId,
    accountType: "developer",
    surface: params.surface ?? "developer_center",
    mode: "developer",
    subject: {
      ...(params.packageId ? { packageId: params.packageId } : {}),
    },
  });
}
