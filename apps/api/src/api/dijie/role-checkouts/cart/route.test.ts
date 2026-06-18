import { describe, expect, it } from "bun:test";
import { Modules } from "@medusajs/framework/utils";
import { POST } from "./route";

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

function roleListing(overrides: Record<string, unknown> = {}) {
  return {
    id: "djrole_paid",
    title: "智能门锁电商美工岗位",
    subtitle: "主图和详情页设计",
    description: "为智能门锁商品生成电商视觉方案。",
    package_id: "pkg_paid_role",
    package_version: "1.2.0",
    developer_ref: "mem_paid",
    listing_owner_ref: "sel_paid",
    billing_beneficiary_ref: "mem_paid",
    listing_status: "published",
    review_state: "approved",
    capabilities: ["image.inspect", "copy.review"],
    manifest_summary: {
      requiredCapabilities: ["image.inspect", "copy.review"],
    },
    pricing: paidPricing,
    role_token_pricing: roleTokenPricing,
    scopes: ["role.execute", "audit.write"],
    ...overrides,
  };
}

function checkoutProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod_checkout_djrole_paid",
    status: "published",
    variants: [{ id: "variant_checkout_djrole_paid" }],
    metadata: {
      dijieRole: {
        kind: "role_product",
        protocolVersion: "2026-05",
        roleListingId: "djrole_paid",
        packageId: "pkg_paid_role",
        packageVersion: "1.2.0",
        developerRef: "mem_paid",
        listingOwnerRef: "sel_paid",
        billingBeneficiaryRef: "mem_paid",
        listingStatus: "published",
        reviewState: "approved",
        title: "智能门锁电商美工岗位",
        capabilities: ["image.inspect", "copy.review"],
        manifestSummary: {
          requiredCapabilities: ["image.inspect", "copy.review"],
        },
        pricing: paidPricing,
        roleTokenPricing,
        scopes: ["role.execute", "audit.write"],
      },
    },
    ...overrides,
  };
}

function cart(overrides: Record<string, unknown> = {}) {
  return {
    id: "cart_paid",
    customer_id: "cus_001",
    completed_at: null,
    items: [],
    ...overrides,
  };
}

function queryGraph(options: {
  listings?: unknown[];
  product?: unknown;
  cart?: unknown;
} = {}) {
  const listings = options.listings ?? [roleListing()];
  const product = options.product ?? checkoutProduct();
  const cartRecord = options.cart ?? cart();

  return async ({ entity, filters }: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => {
    if (entity === "dijie_role_listing") {
      return { data: listings };
    }
    if (entity === "product") {
      if (filters?.id && filters.id !== (product as { id?: string }).id) {
        return { data: [] };
      }
      return { data: product ? [product] : [] };
    }
    if (entity === "cart") {
      if (filters?.id && filters.id !== (cartRecord as { id?: string }).id) {
        return { data: [] };
      }
      return { data: cartRecord ? [cartRecord] : [] };
    }
    return { data: [] };
  };
}

function request(options: {
  actorId?: string;
  roleListingId?: string;
  cartId?: string;
  query?: ReturnType<typeof queryGraph>;
  deletedLineItemIds?: unknown[];
  workflowCalls?: unknown[];
} = {}) {
  const deletedLineItemIds = options.deletedLineItemIds ?? [];
  const workflowCalls = options.workflowCalls ?? [];
  return {
    body: {
      ...(options.roleListingId === undefined ? {} : { roleListingId: options.roleListingId }),
      ...(options.cartId === undefined ? {} : { cartId: options.cartId }),
    },
    auth_context: options.actorId ? { actor_id: options.actorId } : undefined,
    scope: {
      resolve(name: string) {
        if (name === "query") {
          return { graph: options.query ?? queryGraph() };
        }
        if (name === Modules.CART) {
          return {
            async deleteLineItems(ids: string[]) {
              deletedLineItemIds.push(ids);
            },
          };
        }
        if (name === Modules.WORKFLOW_ENGINE) {
          return {
            async run(workflowId: string, input: unknown) {
              workflowCalls.push({ workflowId, input });
              return {};
            },
          };
        }
        throw new Error(`unexpected resolve: ${name}`);
      },
    },
  };
}

describe("POST /dijie/role-checkouts/cart", () => {
  it("requires an authenticated customer", async () => {
    const res = response();
    await POST(
      request({ roleListingId: "djrole_paid", cartId: "cart_paid" }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("requires role listing and cart ids", async () => {
    const res = response();
    await POST(request({ actorId: "cus_001" }) as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rejects missing or non-public role listings", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        cartId: "cart_paid",
        query: queryGraph({ listings: [], product: null }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rejects paid listings without checkout product and variant", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        cartId: "cart_paid",
        query: queryGraph({ product: checkoutProduct({ variants: [] }) }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ ok: false, code: "checkout_not_configured" });
  });

  it("rejects completed carts", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        cartId: "cart_paid",
        query: queryGraph({ cart: cart({ completed_at: "2026-06-10T00:00:00.000Z" }) }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ ok: false, code: "cart_completed" });
  });

  it("rejects carts owned by another customer", async () => {
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        cartId: "cart_paid",
        query: queryGraph({ cart: cart({ customer_id: "cus_other" }) }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("rebuilds the role line item as a non-shipping digital authorization item", async () => {
    const deletedLineItemIds: unknown[] = [];
    const workflowCalls: unknown[] = [];
    const res = response();
    await POST(
      request({
        actorId: "cus_001",
        roleListingId: "djrole_paid",
        cartId: "cart_paid",
        deletedLineItemIds,
        workflowCalls,
        query: queryGraph({
          cart: cart({
            items: [
              {
                id: "cali_old",
                variant_id: "variant_checkout_djrole_paid",
                metadata: {
                  dijieRoleCheckout: true,
                  dijieRoleListingId: "djrole_paid",
                },
              },
            ],
          }),
        }),
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      cartId: "cart_paid",
      roleListingId: "djrole_paid",
      productId: "prod_checkout_djrole_paid",
      variantId: "variant_checkout_djrole_paid",
    });
    expect(deletedLineItemIds).toEqual([["cali_old"]]);
    expect(workflowCalls).toEqual([
      {
        workflowId: "add-to-cart",
        input: {
          input: {
            cart_id: "cart_paid",
            items: [
              {
                variant_id: "variant_checkout_djrole_paid",
                quantity: 1,
                metadata: {
                  dijieRoleCheckout: true,
                  dijieRoleListingId: "djrole_paid",
                  dijie_role_listing_id: "djrole_paid",
                },
                requires_shipping: false,
              },
            ],
            additional_data: {
              dijieRoleCheckout: true,
              roleListingId: "djrole_paid",
            },
          },
        },
      },
    ]);
  });
});
