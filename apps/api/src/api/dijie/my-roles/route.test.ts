import { describe, expect, it } from "bun:test";
import { GET } from "./route";

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

function request(actorId?: string) {
  return {
    auth_context: actorId ? { actor_id: actorId } : undefined,
    scope: {
      resolve() {
        return {
          graph: async ({ entity }: { entity: string }) => {
            if (entity === "product") {
              return {
                data: [
                  {
                    id: "prod_role_developer",
                    title: "开发岗位",
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
                        capabilities: ["代码生成"],
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
                    id: "ordgrp_001",
                    customer_id: actorId,
                    orders: [
                      {
                        id: "order_001",
                        status: "completed",
                        payment_collections: [
                          { status: "captured", amount: 29900, captured_amount: 29900 },
                        ],
                        items: [{ product_id: "prod_role_developer" }],
                      },
                    ],
                  },
                ],
              };
            }
            return { data: [] };
          },
        };
      },
    },
  };
}

function storedListingRequest(actorId?: string) {
  return {
    auth_context: actorId ? { actor_id: actorId } : undefined,
    scope: {
      resolve() {
        return {
          graph: async ({ entity }: { entity: string }) => {
            if (entity === "dijie_role_listing") {
              return {
                data: [
                  {
                    id: "djrole_image_qc",
                    package_id: "pkg_product_image_qc",
                    package_version: "0.1.0",
                    developer_ref: "member_123",
                    listing_owner_ref: "seller_123",
                    billing_beneficiary_ref: "member_123",
                    title: "商品图检查岗位",
                    subtitle: "检查商品图片质量",
                    description: "输出图片质量问题和修改建议。",
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
            if (entity === "product") {
              return { data: [] };
            }
            if (entity === "order_group") {
              return {
                data: [
                  {
                    id: "ordgrp_zero",
                    customer_id: actorId,
                    orders: [
                      {
                        id: "order_zero",
                        status: "completed",
                        payment_collections: [],
                        items: [{ product_id: "djrole_image_qc" }],
                      },
                    ],
                  },
                ],
              };
            }
            return { data: [] };
          },
        };
      },
    },
  };
}

function localEntitlementRequest(actorId?: string) {
  return {
    auth_context: actorId ? { actor_id: actorId } : undefined,
    scope: {
      resolve() {
        return {
          graph: async ({ entity }: { entity: string }) => {
            if (entity === "dijie_role_listing") {
              return {
                data: [
                  {
                    id: "djrole_image_qc",
                    package_id: "pkg_product_image_qc",
                    package_version: "0.1.0",
                    developer_ref: "member_123",
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
                    id: "djent_1",
                    actor_id: actorId,
                    role_listing_id: "djrole_image_qc",
                    entitlement_status: "authorized",
                    source: "zero_price",
                    order_id: null,
                    authorized_at: new Date("2026-06-04T00:00:00.000Z"),
                  },
                ],
              };
            }
            return { data: [] };
          },
        };
      },
    },
  };
}

describe("GET /dijie/my-roles", () => {
  it("requires an authenticated Dijie customer actor", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("returns roles installed through paid marketplace orders", async () => {
    const res = response();
    await GET(request("cus_001") as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roles: [
        {
          entitlementId: "ordgrp_001",
          entitlementSource: "order_group",
          orderId: "order_001",
          role: {
            id: "prod_role_developer",
            title: "开发岗位",
            packageId: "pkg_developer",
            packageVersion: "1.0.0",
          },
        },
      ],
    });
  });

  it("returns authorized roles from stored RoleListing records", async () => {
    const res = response();
    await GET(storedListingRequest("cus_001") as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roles: [
        {
          entitlementId: "ordgrp_zero",
          entitlementSource: "order_group",
          orderId: "order_zero",
          role: {
            id: "djrole_image_qc",
            title: "商品图检查岗位",
            packageId: "pkg_product_image_qc",
            packageVersion: "0.1.0",
            capabilities: ["workspace.read", "image.inspect"],
          },
        },
      ],
    });
  });

  it("returns roles authorized through local entitlements", async () => {
    const res = response();
    await GET(localEntitlementRequest("cus_001") as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      roles: [
        {
          entitlementId: "djent_1",
          entitlementSource: "local_entitlement",
          orderId: null,
          authorizedAt: "2026-06-04T00:00:00.000Z",
          role: {
            id: "djrole_image_qc",
            packageId: "pkg_product_image_qc",
          },
        },
      ],
    });
  });
});
