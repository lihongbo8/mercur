export type DijieAccountLevel =
  | "super_admin"
  | "admin"
  | "operator"
  | "viewer"
  | "member";

export type DijieAccessContext = {
  accountId: string;
  actorType: string | null;
  billingAccountId: string;
  accountLevel: DijieAccountLevel;
  dataScopes: string[];
  localSystemAccess: boolean;
  marketplaceOwnerAccess: boolean;
};

export type DijieAccessProfile = {
  accountId?: string | null;
  account_id?: string | null;
  accountLevel?: string | null;
  account_level?: string | null;
  dataScopes?: unknown;
  data_scopes?: unknown;
  localSystemAccess?: unknown;
  local_system_access?: unknown;
  billingAccountId?: string | null;
  billing_account_id?: string | null;
};

type UnknownRecord = Record<string, unknown>;

const LEVELS = new Set<DijieAccountLevel>([
  "super_admin",
  "admin",
  "operator",
  "viewer",
  "member",
]);

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

function metadataFromAuthContext(authContext: UnknownRecord): UnknownRecord {
  return {
    ...asRecord(authContext.metadata),
    ...asRecord(authContext.dijieAccess),
    ...asRecord(authContext.dijie_access),
  };
}

function levelFromAuthContext(authContext: UnknownRecord): DijieAccountLevel {
  const metadata = metadataFromAuthContext(authContext);
  const explicitLevel =
    nonEmptyString(metadata.accountLevel) ??
    nonEmptyString(metadata.account_level) ??
    nonEmptyString(authContext.accountLevel) ??
    nonEmptyString(authContext.account_level);
  if (explicitLevel && LEVELS.has(explicitLevel as DijieAccountLevel)) {
    return explicitLevel as DijieAccountLevel;
  }

  const actorType = nonEmptyString(authContext.actor_type);
  if (actorType === "user" || actorType === "admin") {
    return "super_admin";
  }
  return "member";
}

function scopesFromAuthContext(authContext: UnknownRecord): string[] {
  const metadata = metadataFromAuthContext(authContext);
  return stringArray(
    metadata.dataScopes ??
      metadata.data_scopes ??
      authContext.dataScopes ??
      authContext.data_scopes,
  );
}

function billingAccountIdFromAuthContext(authContext: UnknownRecord): string | undefined {
  const metadata = metadataFromAuthContext(authContext);
  return (
    nonEmptyString(metadata.billingAccountId) ??
    nonEmptyString(metadata.billing_account_id) ??
    nonEmptyString(authContext.billingAccountId) ??
    nonEmptyString(authContext.billing_account_id)
  );
}

function levelFromProfile(profile: UnknownRecord): DijieAccountLevel | undefined {
  const explicitLevel =
    nonEmptyString(profile.accountLevel) ?? nonEmptyString(profile.account_level);
  return explicitLevel && LEVELS.has(explicitLevel as DijieAccountLevel)
    ? (explicitLevel as DijieAccountLevel)
    : undefined;
}

function profileAppliesToAccount(profile: UnknownRecord, accountId: string): boolean {
  const profileAccountId =
    nonEmptyString(profile.accountId) ?? nonEmptyString(profile.account_id);
  return Boolean(profileAccountId && profileAccountId === accountId);
}

function booleanField(
  record: UnknownRecord,
  camelName: string,
  snakeName: string,
): boolean | undefined {
  if (typeof record[camelName] === "boolean") {
    return record[camelName] as boolean;
  }
  if (typeof record[snakeName] === "boolean") {
    return record[snakeName] as boolean;
  }
  return undefined;
}

export function createDijieAccessContext(
  authContextInput: unknown,
  profileInput?: DijieAccessProfile | null,
): DijieAccessContext | null {
  const authContext = asRecord(authContextInput);
  const accountId = nonEmptyString(authContext.actor_id);
  if (!accountId) {
    return null;
  }

  const profile = asRecord(profileInput);
  const hasProfile = profileAppliesToAccount(profile, accountId);
  const accountLevel = hasProfile
    ? levelFromProfile(profile) ?? levelFromAuthContext(authContext)
    : levelFromAuthContext(authContext);
  const dataScopes = hasProfile
    ? stringArray(profile.dataScopes ?? profile.data_scopes)
    : scopesFromAuthContext(authContext);
  const billingAccountId =
    (hasProfile
      ? nonEmptyString(profile.billingAccountId) ?? nonEmptyString(profile.billing_account_id)
      : undefined) ??
    billingAccountIdFromAuthContext(authContext) ??
    accountId;
  const metadata = metadataFromAuthContext(authContext);
  const explicitLocalAccess =
    (hasProfile
      ? booleanField(profile, "localSystemAccess", "local_system_access")
      : undefined) ??
    booleanField(metadata, "localSystemAccess", "local_system_access");
  const explicitMarketplaceOwnerAccess =
    booleanField(metadata, "marketplaceOwnerAccess", "marketplace_owner_access");
  const actorType = nonEmptyString(authContext.actor_type) ?? null;

  return {
    accountId,
    actorType,
    billingAccountId,
    accountLevel,
    dataScopes,
    localSystemAccess:
      explicitLocalAccess ?? (accountLevel === "super_admin" || accountLevel === "admin"),
    marketplaceOwnerAccess:
      explicitMarketplaceOwnerAccess ??
      (actorType === "marketplace_owner" || actorType === "marketplace_admin"),
  };
}

export function hasDijieGlobalDataAccess(context: DijieAccessContext): boolean {
  return context.accountLevel === "super_admin" || context.dataScopes.includes("*");
}

export function canUseDijieLocalSystem(context: DijieAccessContext): boolean {
  return context.localSystemAccess || hasDijieGlobalDataAccess(context);
}

export function canReviewDijieRoles(
  context: DijieAccessContext,
  roleListingId?: string,
): boolean {
  return (
    hasDijieGlobalDataAccess(context) ||
    context.marketplaceOwnerAccess ||
    context.dataScopes.includes("marketplace:review:*") ||
    context.dataScopes.includes("review:*") ||
    Boolean(roleListingId && context.dataScopes.includes(`review:role:${roleListingId}`))
  );
}

export function canAccessDijieRoleData(
  context: DijieAccessContext,
  roleListingId?: string | null,
): boolean {
  return (
    hasDijieGlobalDataAccess(context) ||
    Boolean(roleListingId && context.dataScopes.includes(`role:${roleListingId}`))
  );
}

export function canAccessDijiePackageData(
  context: DijieAccessContext,
  packageId?: string | null,
  ownerId?: string | null,
): boolean {
  return (
    context.marketplaceOwnerAccess ||
    hasDijieGlobalDataAccess(context) ||
    Boolean(ownerId && ownerId === context.accountId) ||
    Boolean(packageId && context.dataScopes.includes(`package:${packageId}`)) ||
    Boolean(ownerId && context.dataScopes.includes(`developer:${ownerId}`))
  );
}

export function canAccessDijieExecutionData(
  context: DijieAccessContext,
  record: {
    execution_id?: string | null;
    actor_id?: string | null;
    role_listing_id?: string | null;
    entitlement_id?: string | null;
  },
): boolean {
  return (
    record.actor_id === context.accountId ||
    hasDijieGlobalDataAccess(context) ||
    Boolean(record.execution_id && context.dataScopes.includes(`execution:${record.execution_id}`)) ||
    Boolean(record.role_listing_id && context.dataScopes.includes(`role:${record.role_listing_id}`)) ||
    Boolean(record.entitlement_id && context.dataScopes.includes(`entitlement:${record.entitlement_id}`))
  );
}

export function canAccessDijieDialogSessionData(
  context: DijieAccessContext,
  session: {
    account_id?: string | null;
    billing_account_id?: string | null;
    subject?: {
      roleListingId?: string;
      packageId?: string;
      executionId?: string;
      entitlementId?: string;
    } | null;
  },
): boolean {
  if (session.account_id === context.accountId || session.billing_account_id === context.accountId) {
    return true;
  }
  if (hasDijieGlobalDataAccess(context)) {
    return true;
  }
  if (!canUseDijieLocalSystem(context)) {
    return false;
  }

  return (
    canAccessDijieRoleData(context, session.subject?.roleListingId) ||
    canAccessDijiePackageData(context, session.subject?.packageId) ||
    canAccessDijieExecutionData(context, {
      execution_id: session.subject?.executionId,
      actor_id: session.account_id,
      role_listing_id: session.subject?.roleListingId,
      entitlement_id: session.subject?.entitlementId,
    })
  );
}
