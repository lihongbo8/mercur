import { afterEach, describe, expect, it } from "bun:test";
import { POST } from "./route";

const validBody = {
  actorId: "cus_123",
  roleListingId: "prod_role_developer_agent",
  entitlementId: "ordgrp_123",
  deviceId: "device_123",
  workspaceRef: "workspace_123",
  localGatewayId: "gateway_123",
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
  body?: Record<string, unknown>;
  authorization?: string;
  queryGraph?: (query: { entity: string }) => Promise<{ data: unknown[] }>;
}) {
  return {
    body: options.body ?? validBody,
    headers: {
      authorization: options.authorization,
    },
    scope: {
      resolve() {
        return {
          graph: options.queryGraph ?? (async ({ entity }) => {
            if (entity === "product") {
              return {
                data: [
                  {
                    id: validBody.roleListingId,
                    status: "published",
                    metadata: {
                      dijieRole: {
                        kind: "role_product",
                        protocolVersion: "2026-05",
                        packageId: "pkg_developer",
                        packageVersion: "1.0.0",
                        developerRef: "dev_001",
                        listingStatus: "published",
                        reviewState: "approved",
                        pricing: {
                          kind: "one_time_authorization",
                          authorizationFeeCents: 29900,
                          currency: "CNY",
                          platformFeeBps: 0,
                          developerReceivableCents: 29900,
                        },
                        roleTokenPricing,
                      },
                    },
                  },
                ],
              };
            }
            if (entity === "order_group") {
              return {
                data: [
                  {
                    id: validBody.entitlementId,
                    customer_id: validBody.actorId,
                    orders: [
                      {
                        id: "order_123",
                        status: "completed",
                        payment_collections: [
                          { status: "captured", amount: 29900, captured_amount: 29900 },
                        ],
                        items: [{ product_id: validBody.roleListingId }],
                      },
                    ],
                  },
                ],
              };
            }
            return { data: [] };
          }),
        };
      },
    },
  };
}

describe("POST /dijie/entitlements/verify", () => {
  afterEach(() => {
    delete process.env.DIJIE_INTERNAL_BRIDGE_BEARER;
  });

  it("fails closed when the internal bearer is not configured", async () => {
    const res = response();
    await POST(request({ authorization: "Bearer bridge-secret" }) as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rejects callers without the internal bearer", async () => {
    process.env.DIJIE_INTERNAL_BRIDGE_BEARER = "bridge-secret";

    const res = response();
    await POST(request({ authorization: "Bearer wrong" }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("approves paid one-time role entitlements", async () => {
    process.env.DIJIE_INTERNAL_BRIDGE_BEARER = "bridge-secret";

    const res = response();
    await POST(request({ authorization: "Bearer bridge-secret" }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      pricing: {
        kind: "one_time_authorization",
        authorizationFeeCents: 29900,
        currency: "CNY",
        platformFeeBps: 0,
        developerReceivableCents: 29900,
      },
      roleTokenPricing,
      scopes: ["role.execute", "audit.write"],
    });
  });

  it("approves stored local entitlements before checking paid order facts", async () => {
    process.env.DIJIE_INTERNAL_BRIDGE_BEARER = "bridge-secret";
    const body = {
      ...validBody,
      roleListingId: "djrole_image_qc",
      entitlementId: "djent_1",
    };

    const res = response();
    await POST(
      request({
        body,
        authorization: "Bearer bridge-secret",
        queryGraph: async ({ entity }) => {
          if (entity === "dijie_role_listing") {
            return {
              data: [
                {
                  id: body.roleListingId,
                  package_id: "pkg_product_image_qc",
                  package_version: "0.1.0",
                  developer_ref: "member_123",
                  listing_owner_ref: "seller_123",
                  billing_beneficiary_ref: "member_123",
                  title: "商品图检查岗位",
                  listing_status: "published",
                  review_state: "approved",
                  capabilities: ["workspace.read", "image.inspect"],
                  manifest_summary: {
                    requiredCapabilities: ["workspace.read", "image.inspect"],
                  },
                  pricing: {
                    kind: "one_time_authorization",
                    authorizationFeeCents: 0,
                    currency: "CNY",
                    platformFeeBps: 0,
                    developerReceivableCents: 0,
                  },
                  role_token_pricing: roleTokenPricing,
                  scopes: ["role.execute", "audit.write"],
                },
              ],
            };
          }
          if (entity === "dijie_role_entitlement") {
            return {
              data: [
                {
                  id: body.entitlementId,
                  actor_id: body.actorId,
                  role_listing_id: body.roleListingId,
                  entitlement_status: "authorized",
                  source: "zero_price",
                  authorized_at: new Date("2026-06-04T00:00:00.000Z"),
                },
              ],
            };
          }
          throw new Error("paid order fallback should not be used");
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      packageId: "pkg_product_image_qc",
      packageVersion: "0.1.0",
      developerRef: "member_123",
      billingBeneficiaryRef: "member_123",
      pricing: {
        authorizationFeeCents: 0,
      },
      roleTokenPricing,
    });
  });
});
