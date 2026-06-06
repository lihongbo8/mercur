import { describe, expect, it } from "bun:test";
import {
  createDijieLedgerEntryWithRepository,
  listDijieLedgerEntriesForAccountWithRepository,
  type DijieLedgerEntryStorageRecord,
} from "./ledger-store";

function repository() {
  const entries: Array<DijieLedgerEntryStorageRecord & { id: string }> = [];
  return {
    entries,
    async createDijieLedgerEntries(data: DijieLedgerEntryStorageRecord) {
      const entry = { ...data, id: `djledger_${entries.length + 1}` };
      entries.push(entry);
      return entry;
    },
    async listDijieLedgerEntries(filters?: Record<string, unknown>) {
      return entries.filter((entry) =>
        Object.entries(filters ?? {}).every(([key, value]) => entry[key as keyof typeof entry] === value),
      );
    },
  };
}

describe("Dijie ledger store", () => {
  it("creates dialog usage records for metered assistant interactions", async () => {
    const repo = repository();

    const result = await createDijieLedgerEntryWithRepository(repo, {
      accountId: "acct_user",
      billingAccountId: "company_001",
      source: "dialog_usage",
      usageKind: "other",
      surface: "developer_center",
      mode: "developer",
      meters: [{ name: "dialog_message", quantity: 1, unit: "message" }],
      grossAmountCents: 0,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        ledgerEntry: {
          id: "djledger_1",
          account_id: "acct_user",
          billing_account_id: "company_001",
          source: "dialog_usage",
          platform_receivable_cents: 0,
          developer_receivable_cents: 0,
        },
      },
    });
  });

  it("keeps safe model pricing snapshots on model token ledger entries", async () => {
    const repo = repository();

    const result = await createDijieLedgerEntryWithRepository(repo, {
      accountId: "acct_user",
      billingAccountId: "company_001",
      source: "dialog_usage",
      usageKind: "model_tokens",
      surface: "buyer_storefront",
      mode: "user",
      meters: [
        { name: "input_tokens", quantity: 1200, unit: "token" },
        { name: "output_tokens", quantity: 300, unit: "token" },
      ],
      grossAmountCents: 3,
      platformReceivableCents: 3,
      developerReceivableCents: 0,
      modelProvider: "openai",
      modelId: "gpt-5.4",
      modelPricingKnown: true,
      modelPricingSource: "platform_review_config",
      providerCostCents: 2,
      providerCostCurrency: "CNY",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        ledgerEntry: {
          model_provider: "openai",
          model_id: "gpt-5.4",
          model_pricing_known: true,
          model_pricing_source: "platform_review_config",
          provider_cost_cents: 2,
          provider_cost_currency: "CNY",
        },
      },
    });
  });

  it("rejects ledger entries without real meters", async () => {
    const result = await createDijieLedgerEntryWithRepository(repository(), {
      accountId: "acct_user",
      source: "dialog_usage",
      usageKind: "other",
      meters: [],
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "账本记录需要至少一个有效 meter。",
    });
  });

  it("lists entries by account when a user reads their own ledger", async () => {
    const repo = repository();
    await createDijieLedgerEntryWithRepository(repo, {
      accountId: "acct_user",
      source: "dialog_usage",
      usageKind: "other",
      meters: [{ name: "dialog_message", quantity: 1, unit: "message" }],
    });
    await createDijieLedgerEntryWithRepository(repo, {
      accountId: "acct_other",
      source: "dialog_usage",
      usageKind: "other",
      meters: [{ name: "dialog_message", quantity: 1, unit: "message" }],
    });

    const entries = await listDijieLedgerEntriesForAccountWithRepository(repo, {
      accountId: "acct_user",
    });

    expect(entries.map((entry) => entry.account_id)).toEqual(["acct_user"]);
  });
});
