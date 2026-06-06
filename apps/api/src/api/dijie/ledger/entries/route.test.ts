import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { GET } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function ledgerEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "djledger_1",
    account_id: "acct_user",
    billing_account_id: "company_001",
    source: "dialog_usage",
    usage_kind: "other",
    surface: "buyer_storefront",
    mode: "user",
    subject: {},
    meters: [{ name: "dialog_message", quantity: 1, unit: "message" }],
    currency: "CNY",
    gross_amount_cents: 0,
    platform_receivable_cents: 0,
    developer_receivable_cents: 0,
    role_listing_id: "djrole_image_review",
    package_id: "djpkg_image_review",
    execution_id: "exec_001",
    entitlement_id: "djent_001",
    developer_ref: "acct_dev",
    occurred_at: new Date("2026-06-05T01:00:00.000Z"),
    ...overrides,
  };
}

function request(authContext: Record<string, unknown>) {
  return {
    auth_context: authContext,
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return {
          listDijieLedgerEntriesForAccount: async (input: { accountId?: string }) => {
            const entries = [
              ledgerEntry(),
              ledgerEntry({
                id: "djledger_other",
                account_id: "acct_other",
                billing_account_id: "company_other",
                role_listing_id: "djrole_other",
              }),
            ];
            return input.accountId
              ? entries.filter((entry) => entry.account_id === input.accountId)
              : entries;
          },
        };
      },
    },
  };
}

describe("GET /dijie/ledger/entries", () => {
  it("returns the current account ledger entries", async () => {
    const res = response();

    await GET(request({ actor_id: "acct_user" }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      entries: [
        {
          id: "djledger_1",
          accountId: "acct_user",
          billingAccountId: "company_001",
          source: "dialog_usage",
        },
      ],
    });
  });

  it("allows local role-scoped staff to read only assigned role ledger entries", async () => {
    const res = response();

    await GET(
      request({
        actor_id: "local_operator",
        actor_type: "member",
        metadata: {
          accountLevel: "operator",
          localSystemAccess: true,
          dataScopes: ["role:djrole_image_review"],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      entries: [
        {
          id: "djledger_1",
          roleListingId: "djrole_image_review",
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("djrole_other");
  });

  it("requires an authenticated account", async () => {
    const res = response();

    await GET(request({}) as never, res as never);

    expect(res.statusCode).toBe(401);
  });
});
