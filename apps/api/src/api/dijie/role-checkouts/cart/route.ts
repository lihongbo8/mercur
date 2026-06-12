import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  getDijieRoleDetailReadModel,
  type DijieQueryGraph,
} from "../../../../lib/dijie/role-listings";
import {
  isPublicDijieRoleProduct,
  normalizeDijieRoleProductMetadataFromProduct,
} from "../../../../lib/dijie/role-product-metadata";

type UnknownRecord = Record<string, unknown>;
const ADD_TO_CART_WORKFLOW_ID = "add-to-cart";

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function resolveQueryGraph(req: MedusaRequest): DijieQueryGraph | undefined {
  try {
    const query = req.scope.resolve("query") as unknown;
    if (
      query &&
      (typeof query === "object" || typeof query === "function") &&
      typeof (query as { graph?: unknown }).graph === "function"
    ) {
      return (queryInput) =>
        (query as {
          graph: (input: Parameters<DijieQueryGraph>[0]) => ReturnType<DijieQueryGraph>;
        }).graph(queryInput);
    }
  } catch {
    // Handled by caller.
  }
  return undefined;
}

function cartCompleted(cart: UnknownRecord) {
  return Boolean(cart.completed_at ?? cart.completedAt);
}

function roleListingIdFromMetadata(metadata: unknown): string | undefined {
  const record = asRecord(metadata);
  return stringField(record, "dijieRoleListingId") ?? stringField(record, "dijie_role_listing_id");
}

function cartRoleLineItemIds(cart: UnknownRecord, params: {
  roleListingId: string;
  variantId: string;
}) {
  const items = Array.isArray(cart.items) ? cart.items.map(asRecord) : [];
  return items
    .filter((item) => {
      const itemRoleListingId = roleListingIdFromMetadata(item.metadata);
      return item.variant_id === params.variantId || itemRoleListingId === params.roleListingId;
    })
    .map((item) => stringField(item, "id"))
    .filter((id): id is string => Boolean(id));
}

async function readCheckoutProduct(params: {
  queryGraph: DijieQueryGraph;
  productId: string;
}) {
  const { data = [] } = await params.queryGraph({
    entity: "product",
    fields: ["id", "status", "metadata", "variants.id"],
    filters: { id: params.productId },
  });
  return asRecord(data[0]);
}

function checkoutProductMatchesRole(product: UnknownRecord, params: {
  roleListingId: string;
  variantId: string;
}) {
  const roleResult = normalizeDijieRoleProductMetadataFromProduct(product);
  if (!roleResult.ok || !isPublicDijieRoleProduct(roleResult.value)) {
    return false;
  }
  if (roleResult.value.roleListingId !== params.roleListingId) {
    return false;
  }
  const variantIds = Array.isArray(product.variants)
    ? product.variants.map(asRecord).map((variant) => stringField(variant, "id"))
    : [];
  return variantIds.includes(params.variantId);
}

async function readCart(params: {
  queryGraph: DijieQueryGraph;
  cartId: string;
}) {
  const { data = [] } = await params.queryGraph({
    entity: "cart",
    fields: [
      "id",
      "customer_id",
      "completed_at",
      "items.id",
      "items.variant_id",
      "items.metadata",
    ],
    filters: { id: params.cartId },
  });
  return asRecord(data[0]);
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "岗位授权结算需要先登录迭界AI账号。",
    });
  }

  const body = asRecord(req.body);
  const roleListingId = stringField(body, "roleListingId") ?? stringField(body, "role_listing_id");
  const cartId = stringField(body, "cartId") ?? stringField(body, "cart_id");
  if (!roleListingId || !cartId) {
    return res.status(400).json({
      ok: false,
      error: "岗位授权结算必须提供岗位和授权清单。",
    });
  }

  const queryGraph = resolveQueryGraph(req);
  if (!queryGraph) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位结算查询暂未配置。",
    });
  }

  try {
    const role = await getDijieRoleDetailReadModel({ roleListingId, queryGraph });
    if (!role) {
      return res.status(404).json({
        ok: false,
        error: "未找到可购买的岗位。",
      });
    }

    const checkout = role.checkout;
    if (!checkout.requiresCheckout || !checkout.productId || !checkout.variantId) {
      return res.status(409).json({
        ok: false,
        code: "checkout_not_configured",
        error: "该岗位暂未配置付费授权结算商品。",
      });
    }

    const product = await readCheckoutProduct({
      queryGraph,
      productId: checkout.productId,
    });
    if (
      !stringField(product, "id") ||
      !checkoutProductMatchesRole(product, {
        roleListingId,
        variantId: checkout.variantId,
      })
    ) {
      return res.status(409).json({
        ok: false,
        code: "checkout_product_mismatch",
        error: "岗位授权结算商品与岗位不匹配。",
      });
    }

    const cart = await readCart({ queryGraph, cartId });
    if (!stringField(cart, "id")) {
      return res.status(404).json({
        ok: false,
        error: "未找到岗位授权清单。",
      });
    }
    if (cartCompleted(cart)) {
      return res.status(409).json({
        ok: false,
        code: "cart_completed",
        error: "该授权清单已经完成结算，请重新开始授权。",
      });
    }
    const cartCustomerId = stringField(cart, "customer_id");
    if (cartCustomerId && cartCustomerId !== actorId) {
      return res.status(403).json({
        ok: false,
        error: "不能使用其他账号的授权清单。",
      });
    }

    const cartModule = req.scope.resolve(Modules.CART) as {
      deleteLineItems: (ids: string[] | string) => Promise<void>;
    };
    const oldLineItemIds = cartRoleLineItemIds(cart, {
      roleListingId,
      variantId: checkout.variantId,
    });
    if (oldLineItemIds.length > 0) {
      await cartModule.deleteLineItems(oldLineItemIds);
    }

    const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE) as {
      run: (workflowId: string, input: unknown) => Promise<unknown>;
    };
    await workflowEngine.run(ADD_TO_CART_WORKFLOW_ID, {
      input: {
        cart_id: cartId,
        items: [
          {
            variant_id: checkout.variantId,
            quantity: 1,
            metadata: {
              dijieRoleCheckout: true,
              dijieRoleListingId: role.id,
              dijie_role_listing_id: role.id,
            },
            requires_shipping: false,
          },
        ],
        additional_data: {
          dijieRoleCheckout: true,
          roleListingId: role.id,
        },
      },
    });

    return res.status(200).json({
      ok: true,
      cartId,
      roleListingId: role.id,
      productId: checkout.productId,
      variantId: checkout.variantId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位授权结算暂时不可用。",
    });
  }
}
