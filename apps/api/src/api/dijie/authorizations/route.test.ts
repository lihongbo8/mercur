import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../lib/dijie/audit-store";
import { POST } from "./route";

const pricing = {
  kind: "one_time_authorization",
  authorizationFeeCents: 0,
  currency: "CNY",
  platformFeeBps: 0,
  developerReceivableCents: 0,
};
const paidPricing = {
  kind: "one_time_authorization",
  authorizationFeeCents: 29900,
  currency: "CNY",
  platformFeeBps: 0,
  developerReceivableCents: 29900,
};
const roleTokenPricing = {
  inputTokenCentsPerMillion: 120,
  outputTokenCentsPerMillion: 360,
  currency: "CNY",
  developerReceivableBps: 10000,
  platformFeeBps: 0,
};

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

function request(options: {
  actorId?: string;
  roleListingId?: string;
  orderId?: string;
  service?: unknown;
  queryGraph?: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data?: unknown[] }>;
  queryAsFunction?: boolean;
} = {}) {
  return {
    body:
      options.roleListingId === undefined
        ? {}
        : { roleListingId: options.roleListingId, orderId: options.orderId },
    auth_context: options.actorId ? { actor_id: options.actorId } : undefined,
    scope: {
      resolve(name: string) {
        if (name === "query" && options.queryGraph) {
          if (options.queryAsFunction) {
            const query = (() => undefined) as unknown as {
              graph: NonNullable<typeof options.queryGraph>;
            };
            query.graph = options.queryGraph;
            return query;
          }
          return { graph: options.queryGraph };
        }
        if (name !== DIJIE_AUDIT_MODULE || !options.service) {
          throw new Error("missing service");
        }
        return options.service;
      },
    },
  };
}

function service(result: unknown) {
  return {
    async authorizeDijieRoleListing() {
      return result;
    },
  };
}

function paidService(result: unknown, calls: unknown[] = []) {
  return {
    async authorizeDijieRoleListing() {
      throw new Error("paid route should not use zero-price authorization");
    },
    async authorizeDijiePaidRoleListing(input: unknown) {
      calls.push(input);
      return result;
    },
  };
}

function paidLedgerService(options: {
  authorizationResult: unknown;
  authorizationCalls?: unknown[];
  existingLedgerEntries?: unknown[];
  ledgerCalls?: unknown[];
}) {
  const authorizationCalls = options.authorizationCalls ?? [];
  const ledgerCalls = options.ledgerCalls ?? [];
  return {
    async authorizeDijieRoleListing() {
      throw new Error("paid route should not use zero-price authorization");
    },
    async authorizeDijiePaidRoleListing(input: unknown) {
      authorizationCalls.push(input);
      return options.authorizationResult;
    },
    async listDijieLedgerEntriesForAccount() {
      return options.existingLedgerEntries ?? [];
    },
    async createDijieLedgerEntry(input: unknown) {
      ledgerCalls.push(input);
      return {
        ok: true,
        value: {
          ledgerEntry: {
            id: "djledger_auth_1",
            account_id: "cus_001",
            billing_account_id: "cus_001",
            source: "role_marketplace",
            usage_kind: "install",
            surface: "buyer_storefront",
            mode: "user",
            subject: {
              eventKind: "role_authorization",
              orderId: "ordgrp_paid_1",
              roleListingId: "djrole_paid",
              packageId: "pkg_paid_role",
              entitlementId: "djent_paid_1",
            },
            meters: [{ name: "role_authorization", quantity: 1, unit: "authorization" }],
            currency: "CNY",
            gross_amount_cents: 29900,
            platform_receivable_cents: 0,
            developer_receivable_cents: 29900,
            model_provider: null,
            model_id: null,
            model_pricing_known: false,
            model_pricing_source: null,
            provider_cost_cents: null,
            provider_cost_currency: null,
            role_listing_id: "djrole_paid",
            package_id: "pkg_paid_role",
            execution_id: null,
            entitlement_id: "djent_paid_1",
            developer_ref: "member_paid",
            occurred_at: new Date("2026-06-04T01:00:00.000Z"),
          },
        },
      };
    },
  };
}

function paidOrderQueryGraph(options: { paid?: boolean; customerId?: string } = {}) {
  return async ({ entity, filters }: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => {
    const expectedCustomerId = options.customerId ?? "cus_001";
    if (filters?.customer_id !== expectedCustomerId) {
      return { data: [] };
    }
    if (entity === "order_group") {
      return {
        data: [
          {
            id: "ordgrp_paid_1",
            customer_id: expectedCustomerId,
            orders: [
              {
                id: "order_paid_1",
                status: options.paid === false ? "pending" : "completed",
                payment_collections:
                  options.paid === false
                    ? []
                    : [{ status: "captured", amount: 29900, captured_amount: 29900 }],
                items: [{ product_id: "djrole_paid" }],
              },
            ],
          },
        ],
      };
    }
    if (entity === "order") {
      return { data: [] };
    }
    return { data: [] };
  };
}

describe("POST /dijie/authorizations", () => {
  it("requires an authenticated local account", async () => {
    const res = response();
    await POST(request({ roleListingId: "djrole_image_qc" }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("returns a safe local entitlement projection for zero-price roles", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_image_qc",
        service: service({
          ok: true,
          value: {
            entitlementId: "djent_1",
            entitlement: {
              id: "djent_1",
              actor_id: "cus_001",
              role_listing_id: "djrole_image_qc",
              package_id: "pkg_product_image_qc",
              package_version: "0.1.0",
              developer_ref: "member_123",
              listing_owner_ref: "seller_123",
              billing_beneficiary_ref: "member_123",
              entitlement_status: "authorized",
              source: "zero_price",
              order_id: null,
              pricing,
              role_token_pricing: roleTokenPricing,
              authorized_at: new Date("2026-06-04T00:00:00.000Z"),
            },
          },
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      entitlementId: "djent_1",
      entitlement: {
        id: "djent_1",
        roleListingId: "djrole_image_qc",
        packageId: "pkg_product_image_qc",
        packageVersion: "0.1.0",
        status: "authorized",
        source: "zero_price",
        orderId: null,
        authorizedAt: "2026-06-04T00:00:00.000Z",
        pricing,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain("roleTokenPricing");
  });

  it("does not create local entitlements for paid roles before checkout", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        service: service({
          ok: false,
          status: 402,
          code: "checkout_required",
          error: "该岗位需要完成结算后才能生成授权。",
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual({
      ok: false,
      code: "checkout_required",
      error: "该岗位需要完成结算后才能生成授权。",
    });
  });

  it("materializes a paid checkout entitlement after verifying order facts", async () => {
    const calls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
        queryGraph: paidOrderQueryGraph(),
        service: paidService(
          {
            ok: true,
            value: {
              entitlementId: "djent_paid_1",
              entitlement: {
                id: "djent_paid_1",
                actor_id: "cus_001",
                role_listing_id: "djrole_paid",
                package_id: "pkg_paid_role",
                package_version: "1.2.0",
                developer_ref: "member_paid",
                listing_owner_ref: "seller_paid",
                billing_beneficiary_ref: "member_paid",
                entitlement_status: "authorized",
                source: "checkout",
                order_id: "ordgrp_paid_1",
                pricing: paidPricing,
                role_token_pricing: roleTokenPricing,
                authorized_at: new Date("2026-06-04T01:00:00.000Z"),
              },
            },
          },
          calls,
        ),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
      },
    ]);
    expect(res.body).toMatchObject({
      ok: true,
      entitlementId: "djent_paid_1",
      entitlement: {
        id: "djent_paid_1",
        roleListingId: "djrole_paid",
        source: "checkout",
        orderId: "ordgrp_paid_1",
        pricing: paidPricing,
      },
    });
  });

  it("accepts Medusa query as a callable service with a graph method", async () => {
    const calls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
        queryGraph: paidOrderQueryGraph(),
        queryAsFunction: true,
        service: paidService(
          {
            ok: true,
            value: {
              entitlementId: "djent_paid_1",
              entitlement: {
                id: "djent_paid_1",
                actor_id: "cus_001",
                role_listing_id: "djrole_paid",
                package_id: "pkg_paid_role",
                package_version: "1.2.0",
                developer_ref: "member_paid",
                listing_owner_ref: "seller_paid",
                billing_beneficiary_ref: "member_paid",
                entitlement_status: "authorized",
                source: "checkout",
                order_id: "ordgrp_paid_1",
                pricing: paidPricing,
                role_token_pricing: roleTokenPricing,
                authorized_at: new Date("2026-06-04T01:00:00.000Z"),
              },
            },
          },
          calls,
        ),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
      },
    ]);
  });

  it("does not materialize paid entitlements for wrong-account order facts", async () => {
    const calls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_other",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
        queryGraph: paidOrderQueryGraph({ customerId: "cus_001" }),
        service: paidService(
          {
            ok: true,
            value: {},
          },
          calls,
        ),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(calls).toHaveLength(0);
    expect(res.body).toEqual({
      ok: false,
      code: undefined,
      error: "No paid one-time role authorization was found for this customer.",
    });
  });

  it("writes a marketplace authorization ledger after paid checkout entitlement materializes", async () => {
    const authorizationCalls: unknown[] = [];
    const ledgerCalls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
        queryGraph: paidOrderQueryGraph(),
        service: paidLedgerService({
          authorizationCalls,
          ledgerCalls,
          authorizationResult: {
            ok: true,
            value: {
              entitlementId: "djent_paid_1",
              entitlement: {
                id: "djent_paid_1",
                actor_id: "cus_001",
                role_listing_id: "djrole_paid",
                package_id: "pkg_paid_role",
                package_version: "1.2.0",
                developer_ref: "member_paid",
                listing_owner_ref: "seller_paid",
                billing_beneficiary_ref: "member_paid",
                entitlement_status: "authorized",
                source: "checkout",
                order_id: "ordgrp_paid_1",
                pricing: paidPricing,
                role_token_pricing: roleTokenPricing,
                authorized_at: new Date("2026-06-04T01:00:00.000Z"),
              },
            },
          },
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(authorizationCalls).toHaveLength(1);
    expect(ledgerCalls).toEqual([
      {
        accountId: "cus_001",
        billingAccountId: "cus_001",
        source: "role_marketplace",
        usageKind: "install",
        surface: "buyer_storefront",
        mode: "user",
        subject: {
          eventKind: "role_authorization",
          orderId: "ordgrp_paid_1",
          roleListingId: "djrole_paid",
          packageId: "pkg_paid_role",
          entitlementId: "djent_paid_1",
        },
        meters: [{ name: "role_authorization", quantity: 1, unit: "authorization" }],
        currency: "CNY",
        grossAmountCents: 29900,
        platformReceivableCents: 0,
        developerReceivableCents: 29900,
        roleListingId: "djrole_paid",
        packageId: "pkg_paid_role",
        entitlementId: "djent_paid_1",
        developerRef: "member_paid",
        occurredAt: new Date("2026-06-04T01:00:00.000Z"),
      },
    ]);
    expect(res.body).toMatchObject({
      ok: true,
      ledgerEntry: {
        id: "djledger_auth_1",
        source: "role_marketplace",
        usageKind: "install",
        roleListingId: "djrole_paid",
        entitlementId: "djent_paid_1",
        grossAmountCents: 29900,
        developerReceivableCents: 29900,
      },
    });
  });

  it("does not duplicate marketplace authorization ledger entries for repeated paid callbacks", async () => {
    const ledgerCalls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        orderId: "ordgrp_paid_1",
        queryGraph: paidOrderQueryGraph(),
        service: paidLedgerService({
          ledgerCalls,
          existingLedgerEntries: [
            {
              id: "djledger_existing",
              account_id: "cus_001",
              billing_account_id: "cus_001",
              source: "role_marketplace",
              usage_kind: "install",
              role_listing_id: "djrole_paid",
              entitlement_id: "djent_paid_1",
            },
          ],
          authorizationResult: {
            ok: true,
            value: {
              entitlementId: "djent_paid_1",
              entitlement: {
                id: "djent_paid_1",
                actor_id: "cus_001",
                role_listing_id: "djrole_paid",
                package_id: "pkg_paid_role",
                package_version: "1.2.0",
                developer_ref: "member_paid",
                listing_owner_ref: "seller_paid",
                billing_beneficiary_ref: "member_paid",
                entitlement_status: "authorized",
                source: "checkout",
                order_id: "ordgrp_paid_1",
                pricing: paidPricing,
                role_token_pricing: roleTokenPricing,
                authorized_at: new Date("2026-06-04T01:00:00.000Z"),
              },
            },
          },
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(ledgerCalls).toHaveLength(0);
    expect(res.body).toMatchObject({
      ok: true,
      entitlementId: "djent_paid_1",
    });
  });
});
