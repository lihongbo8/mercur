import type {
  DijieDialogMode,
  DijieDialogSurface,
  DijieDialogSubject,
} from "./dialog-context";
import type { DijieUsageKind, DijieUsageMeter } from "./ledgers";

export type DijieLedgerSource =
  | "dialog_usage"
  | "main_system_usage"
  | "role_usage"
  | "role_marketplace";

export type DijieLedgerEntryStorageRecord = {
  account_id: string;
  billing_account_id: string;
  source: DijieLedgerSource;
  usage_kind: DijieUsageKind;
  surface: DijieDialogSurface | null;
  mode: DijieDialogMode | null;
  subject: DijieDialogSubject;
  meters: DijieUsageMeter[];
  currency: "CNY";
  gross_amount_cents: number;
  platform_receivable_cents: number;
  developer_receivable_cents: number;
  model_provider?: string | null;
  model_id?: string | null;
  model_pricing_known?: boolean;
  model_pricing_source?: string | null;
  provider_cost_cents?: number | null;
  provider_cost_currency?: string | null;
  role_listing_id: string | null;
  package_id: string | null;
  execution_id: string | null;
  entitlement_id: string | null;
  developer_ref: string | null;
  occurred_at: Date;
};

export type DijieLedgerEntryRepository = {
  createDijieLedgerEntries: (
    data: DijieLedgerEntryStorageRecord,
  ) => Promise<DijieLedgerEntryStorageRecord & { id: string }>;
};

export type DijieLedgerEntryLookupRepository = {
  listDijieLedgerEntries: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieLedgerEntryStorageRecord & { id: string }>>;
};

export type DijieLedgerEntryStore = DijieLedgerEntryReader & {
  createDijieLedgerEntry: (
    input: CreateDijieLedgerEntryInput,
  ) => Promise<DijieLedgerEntryMutationResult>;
};

export type DijieLedgerEntryReader = {
  listDijieLedgerEntriesForAccount: (input: {
    accountId?: string;
    take?: number;
  }) => Promise<Array<DijieLedgerEntryStorageRecord & { id: string }>>;
};

export type CreateDijieLedgerEntryInput = {
  accountId: string;
  billingAccountId?: string;
  source: DijieLedgerSource;
  usageKind: DijieUsageKind;
  surface?: DijieDialogSurface | null;
  mode?: DijieDialogMode | null;
  subject?: DijieDialogSubject;
  meters: DijieUsageMeter[];
  currency?: "CNY";
  grossAmountCents?: number;
  platformReceivableCents?: number;
  developerReceivableCents?: number;
  modelProvider?: string | null;
  modelId?: string | null;
  modelPricingKnown?: boolean;
  modelPricingSource?: string | null;
  providerCostCents?: number | null;
  providerCostCurrency?: string | null;
  roleListingId?: string | null;
  packageId?: string | null;
  executionId?: string | null;
  entitlementId?: string | null;
  developerRef?: string | null;
  occurredAt?: Date;
};

export type DijieLedgerEntryMutationResult =
  | {
      ok: true;
      value: {
        ledgerEntry: DijieLedgerEntryStorageRecord & { id: string };
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const LEDGER_SOURCES = new Set<DijieLedgerSource>([
  "dialog_usage",
  "main_system_usage",
  "role_usage",
  "role_marketplace",
]);

const USAGE_KINDS = new Set<DijieUsageKind>([
  "model_tokens",
  "tool_execution",
  "runtime_resource",
  "download",
  "install",
  "other",
]);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function nonNegativeFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value) && (value as number) >= 0;
}

function normalizeNullableString(value: unknown): string | null {
  return nonEmptyString(value) ?? null;
}

function normalizeMeters(value: DijieUsageMeter[]): DijieUsageMeter[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const meters = value.map((meter) => ({
    name: meter.name?.trim(),
    quantity: meter.quantity,
    unit: meter.unit?.trim(),
  }));
  return meters.every(
    (meter) =>
      nonEmptyString(meter.name) &&
      nonNegativeFiniteNumber(meter.quantity) &&
      nonEmptyString(meter.unit),
  )
    ? (meters as DijieUsageMeter[])
    : undefined;
}

export function createDijieLedgerEntryReadModel(
  entry: DijieLedgerEntryStorageRecord & { id: string },
) {
  return {
    id: entry.id,
    accountId: entry.account_id,
    billingAccountId: entry.billing_account_id,
    source: entry.source,
    usageKind: entry.usage_kind,
    surface: entry.surface,
    mode: entry.mode,
    subject: entry.subject,
    meters: entry.meters,
    currency: entry.currency,
    grossAmountCents: entry.gross_amount_cents,
    platformReceivableCents: entry.platform_receivable_cents,
    developerReceivableCents: entry.developer_receivable_cents,
    modelProvider: entry.model_provider ?? null,
    modelId: entry.model_id ?? null,
    modelPricingKnown: entry.model_pricing_known ?? false,
    modelPricingSource: entry.model_pricing_source ?? null,
    providerCostCents: entry.provider_cost_cents ?? null,
    providerCostCurrency: entry.provider_cost_currency ?? null,
    roleListingId: entry.role_listing_id,
    packageId: entry.package_id,
    executionId: entry.execution_id,
    entitlementId: entry.entitlement_id,
    developerRef: entry.developer_ref,
    occurredAt:
      entry.occurred_at instanceof Date ? entry.occurred_at.toISOString() : entry.occurred_at,
  };
}

export async function createDijieLedgerEntryWithRepository(
  repository: DijieLedgerEntryRepository,
  input: CreateDijieLedgerEntryInput,
): Promise<DijieLedgerEntryMutationResult> {
  const accountId = nonEmptyString(input.accountId);
  if (!accountId) {
    return { ok: false, status: 400, error: "账本记录需要账号。" };
  }

  if (!LEDGER_SOURCES.has(input.source)) {
    return { ok: false, status: 400, error: "账本来源不合法。" };
  }

  if (!USAGE_KINDS.has(input.usageKind)) {
    return { ok: false, status: 400, error: "账本用量类型不合法。" };
  }

  const meters = normalizeMeters(input.meters);
  if (!meters) {
    return { ok: false, status: 400, error: "账本记录需要至少一个有效 meter。" };
  }

  const grossAmountCents = input.grossAmountCents ?? 0;
  const platformReceivableCents = input.platformReceivableCents ?? grossAmountCents;
  const developerReceivableCents = input.developerReceivableCents ?? 0;
  const providerCostCents =
    input.providerCostCents === null || input.providerCostCents === undefined
      ? null
      : input.providerCostCents;
  if (
    !nonNegativeInteger(grossAmountCents) ||
    !nonNegativeInteger(platformReceivableCents) ||
    !nonNegativeInteger(developerReceivableCents) ||
    (providerCostCents !== null && !nonNegativeInteger(providerCostCents))
  ) {
    return { ok: false, status: 400, error: "账本金额必须是非负整数分值。" };
  }

  const ledgerEntry = await repository.createDijieLedgerEntries({
    account_id: accountId,
    billing_account_id: nonEmptyString(input.billingAccountId) ?? accountId,
    source: input.source,
    usage_kind: input.usageKind,
    surface: input.surface ?? null,
    mode: input.mode ?? null,
    subject: input.subject ?? {},
    meters,
    currency: input.currency ?? "CNY",
    gross_amount_cents: grossAmountCents,
    platform_receivable_cents: platformReceivableCents,
    developer_receivable_cents: developerReceivableCents,
    model_provider: normalizeNullableString(input.modelProvider),
    model_id: normalizeNullableString(input.modelId),
    model_pricing_known: input.modelPricingKnown ?? false,
    model_pricing_source: normalizeNullableString(input.modelPricingSource),
    provider_cost_cents: providerCostCents,
    provider_cost_currency: normalizeNullableString(input.providerCostCurrency),
    role_listing_id: normalizeNullableString(input.roleListingId),
    package_id: normalizeNullableString(input.packageId),
    execution_id: normalizeNullableString(input.executionId),
    entitlement_id: normalizeNullableString(input.entitlementId),
    developer_ref: normalizeNullableString(input.developerRef),
    occurred_at: input.occurredAt ?? new Date(),
  });

  return {
    ok: true,
    value: { ledgerEntry },
  };
}

export async function listDijieLedgerEntriesForAccountWithRepository(
  repository: DijieLedgerEntryLookupRepository,
  input: {
    accountId?: string;
    take?: number;
  },
): Promise<Array<DijieLedgerEntryStorageRecord & { id: string }>> {
  const accountId = nonEmptyString(input.accountId);
  return repository.listDijieLedgerEntries(
    accountId ? { account_id: accountId } : {},
    {
      take: input.take ?? 100,
      order: { occurred_at: "DESC" },
    },
  );
}
