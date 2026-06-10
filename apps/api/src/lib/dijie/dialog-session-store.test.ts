import { describe, expect, it } from "bun:test";
import { getDijieDialogCapabilityPolicy } from "./dialog-capability-policy";
import {
  createDijieBuyerStorefrontDialogContext,
  createDijieDeveloperDialogContext,
  getDijieDialogBillingPolicy,
} from "./dialog-context";
import {
  recordDijieDialogTurnWithRepository,
  retrieveDijieDialogSessionWithMessagesWithRepository,
  sanitizeSensitiveText,
  type DijieDialogMessageStorageRecord,
  type DijieDialogSessionStorageRecord,
} from "./dialog-session-store";
import type { DijieLedgerEntryStorageRecord } from "./ledger-store";
import { testDijieDialogMessageResponse } from "./test-fixtures.test";

function repository() {
  const sessions: Array<DijieDialogSessionStorageRecord & { id: string }> = [];
  const messages: Array<DijieDialogMessageStorageRecord & { id: string }> = [];
  const ledgers: Array<DijieLedgerEntryStorageRecord & { id: string }> = [];

  return {
    sessions,
    messages,
    ledgers,
    async createDijieDialogSessions(data: DijieDialogSessionStorageRecord) {
      const session = { ...data, id: `djdlg_${sessions.length + 1}` };
      sessions.push(session);
      return session;
    },
    async listDijieDialogSessions(filters?: Record<string, unknown>) {
      return sessions.filter((session) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => session[key as keyof typeof session] === value,
        ),
      );
    },
    async updateDijieDialogSessions(
      data: Partial<DijieDialogSessionStorageRecord> & { id: string },
    ) {
      const index = sessions.findIndex((session) => session.id === data.id);
      sessions[index] = { ...sessions[index], ...data };
      return sessions[index];
    },
    async createDijieDialogMessages(data: DijieDialogMessageStorageRecord) {
      const message = { ...data, id: `djmsg_${messages.length + 1}` };
      messages.push(message);
      return message;
    },
    async listDijieDialogMessages(filters?: Record<string, unknown>) {
      return messages.filter((message) =>
        Object.entries(filters ?? {}).every(
          ([key, value]) => message[key as keyof typeof message] === value,
        ),
      );
    },
    async createDijieLedgerEntries(data: DijieLedgerEntryStorageRecord) {
      const ledger = { ...data, id: `djledger_${ledgers.length + 1}` };
      ledgers.push(ledger);
      return ledger;
    },
  };
}

describe("Dijie dialog session store", () => {
  it("records a metered dialog turn with sanitized message content", async () => {
    const repo = repository();
    const context = createDijieDeveloperDialogContext({
      developerAccountId: "acct_dev",
      packageId: "pkg_001",
    });

    const result = await recordDijieDialogTurnWithRepository(repo, {
      context,
      capabilityPolicy: getDijieDialogCapabilityPolicy(context),
      userMessage:
        "帮我上传岗位包，Authorization: Bearer abc.def.ghi，路径 /Users/test/secret.txt",
      assistantReply: testDijieDialogMessageResponse({
        context,
        reply: "可以引导上传，provider_auth=secret-value",
        grounding: { roles: [], source: "dialog_context" },
        billingPolicy: {
          billingAccountId: "acct_dev",
          payerAccountId: "acct_dev",
          metered: true,
          modelAllowed: false,
          chargedBy: "system_platform",
          billableModelUsage: false,
          ledgerSource: "developer_assist",
          requiresEntitlement: false,
          note: "test",
        },
        modelCalled: false,
        modelUsage: null,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        session: {
          id: "djdlg_1",
          account_id: "acct_dev",
          surface: "developer_center",
        },
        assistantMessage: {
          ledger_entry_id: "djledger_1",
          model_called: false,
        },
        ledgerEntry: {
          source: "dialog_usage",
          meters: [{ name: "dialog_message", quantity: 1, unit: "message" }],
        },
      },
    });
    expect(repo.messages[0].content).toContain("Bearer [redacted-token]");
    expect(repo.messages[0].content).toContain("[redacted-local-path]");
    expect(repo.messages[1].content).toContain("provider_auth=[redacted-secret]");
  });

  it("appends to an existing session owned by the same account", async () => {
    const repo = repository();
    const context = createDijieDeveloperDialogContext({ developerAccountId: "acct_dev" });
    const first = await recordDijieDialogTurnWithRepository(repo, {
      context,
      capabilityPolicy: getDijieDialogCapabilityPolicy(context),
      userMessage: "第一条",
      assistantReply: testDijieDialogMessageResponse({
        context,
        reply: "第一条回复",
        grounding: { roles: [], source: "dialog_context" },
        billingPolicy: getDijieDialogBillingPolicy(context),
        modelCalled: false,
        modelUsage: null,
      }),
    });
    expect(first.ok).toBe(true);

    const second = await recordDijieDialogTurnWithRepository(repo, {
      sessionId: first.ok ? first.value.session.id : undefined,
      context,
      capabilityPolicy: getDijieDialogCapabilityPolicy(context),
      userMessage: "第二条",
      assistantReply: testDijieDialogMessageResponse({
        context,
        reply: "第二条回复",
        grounding: { roles: [], source: "dialog_context" },
        billingPolicy: getDijieDialogBillingPolicy(context),
        modelCalled: false,
        modelUsage: null,
      }),
    });

    expect(second).toMatchObject({
      ok: true,
      value: {
        session: { id: "djdlg_1" },
      },
    });
    const stored = await retrieveDijieDialogSessionWithMessagesWithRepository(repo, {
      sessionId: "djdlg_1",
      accountId: "acct_dev",
    });
    expect(stored?.messages).toHaveLength(4);
  });

  it("records OpenClaw model usage meters and platform billing snapshots", async () => {
    const repo = repository();
    const context = createDijieBuyerStorefrontDialogContext({ buyerAccountId: "acct_user" });

    const result = await recordDijieDialogTurnWithRepository(repo, {
      context,
      capabilityPolicy: getDijieDialogCapabilityPolicy(context),
      userMessage: "有没有美工岗位？",
      assistantReply: testDijieDialogMessageResponse({
        context,
        reply: "模型根据真实岗位库补充：商品图检查岗位适合美工初审。",
        grounding: { roles: [], source: "role_listings" },
        billingPolicy: getDijieDialogBillingPolicy(context),
        modelCalled: true,
        modelUsage: {
          provider: "openai",
          model: "gpt-5.4",
          requestCount: 1,
          promptTokens: 1200,
          completionTokens: 300,
          cacheReadTokens: 50,
          cacheWriteTokens: 0,
          totalTokens: 1550,
          pricing: {
            pricingKnown: true,
            pricingSource: "platform_review_config",
            providerCostCents: 2,
            providerCostCurrency: "CNY",
            grossAmountCents: 3,
            platformReceivableCents: 3,
            developerReceivableCents: 0,
          },
        },
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        assistantMessage: {
          model_called: true,
          model_usage: {
            provider: "openai",
            model: "gpt-5.4",
            promptTokens: 1200,
            completionTokens: 300,
          },
        },
        ledgerEntry: {
          usage_kind: "model_tokens",
          meters: [
            { name: "dialog_message", quantity: 1, unit: "message" },
            { name: "request_count", quantity: 1, unit: "request" },
            { name: "input_tokens", quantity: 1200, unit: "token" },
            { name: "output_tokens", quantity: 300, unit: "token" },
            { name: "cache_read_tokens", quantity: 50, unit: "token" },
            { name: "cache_write_tokens", quantity: 0, unit: "token" },
            { name: "total_tokens", quantity: 1550, unit: "token" },
          ],
          gross_amount_cents: 3,
          platform_receivable_cents: 3,
          developer_receivable_cents: 0,
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

  it("redacts common sensitive text patterns", () => {
    expect(
      sanitizeSensitiveText(
        "Bearer abc.def secret=top sk-local-secret-token /private/tmp/local.txt",
      ),
    ).toContain("[redacted");
  });
});
