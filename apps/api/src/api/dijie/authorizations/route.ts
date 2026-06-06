import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  type DijieQueryGraph,
  verifyPaidDijieRoleCheckoutFacts,
} from "../../../lib/dijie/entitlement-verifier";
import { DIJIE_AUDIT_MODULE } from "../../../lib/dijie/audit-store";
import type {
  DijieRoleEntitlementStorageRecord,
  DijieRoleEntitlementStore,
} from "../../../lib/dijie/role-entitlement-store";

type UnknownRecord = Record<string, unknown>;

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

function isRoleEntitlementStore(value: unknown): value is DijieRoleEntitlementStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { authorizeDijieRoleListing?: unknown }).authorizeDijieRoleListing ===
      "function"
  );
}

function resolveDijieRoleEntitlements(req: MedusaRequest) {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRoleEntitlementStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

function resolveQueryGraph(req: MedusaRequest): DijieQueryGraph | undefined {
  try {
    const query = req.scope.resolve("query") as unknown;
    if (
      query &&
      typeof query === "object" &&
      typeof (query as { graph?: unknown }).graph === "function"
    ) {
      return (queryInput) =>
        (query as { graph: (input: Parameters<DijieQueryGraph>[0]) => ReturnType<DijieQueryGraph> }).graph(
          queryInput,
        );
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function safeEntitlement(entitlement: DijieRoleEntitlementStorageRecord & { id: string }) {
  return {
    id: entitlement.id,
    roleListingId: entitlement.role_listing_id,
    packageId: entitlement.package_id,
    packageVersion: entitlement.package_version,
    status: entitlement.entitlement_status,
    source: entitlement.source,
    orderId: entitlement.order_id,
    authorizedAt: entitlement.authorized_at.toISOString(),
    pricing: entitlement.pricing,
    roleTokenPricing: entitlement.role_token_pricing,
  };
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "岗位授权需要先登录迭界AI账号。",
    });
  }

  const entitlementStore = resolveDijieRoleEntitlements(req);
  if (!entitlementStore) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位授权存储暂未配置。",
    });
  }

  const body = asRecord(req.body);
  const roleListingId = stringField(body, "roleListingId") ?? stringField(body, "role_listing_id");
  const orderId =
    stringField(body, "orderId") ??
    stringField(body, "order_id") ??
    stringField(body, "entitlementId") ??
    stringField(body, "entitlement_id");
  if (!roleListingId) {
    return res.status(400).json({
      ok: false,
      error: "授权岗位必须选择岗位。",
    });
  }

  const result = orderId
    ? await (async () => {
        if (typeof entitlementStore.authorizeDijiePaidRoleListing !== "function") {
          return {
            ok: false as const,
            status: 503,
            error: "迭界AI付费岗位授权存储暂未配置。",
          };
        }
        const queryGraph = resolveQueryGraph(req);
        if (!queryGraph) {
          return {
            ok: false as const,
            status: 503,
            error: "迭界AI付费订单查询暂未配置。",
          };
        }
        const paidCheckout = await verifyPaidDijieRoleCheckoutFacts(
          {
            actorId,
            roleListingId,
            orderId,
          },
          queryGraph,
        );
        if (!paidCheckout.ok) {
          return paidCheckout;
        }
        return entitlementStore.authorizeDijiePaidRoleListing({
          actorId,
          roleListingId,
          orderId: paidCheckout.orderId,
        });
      })()
    : await entitlementStore.authorizeDijieRoleListing({
        actorId,
        roleListingId,
      });
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      code: result.code,
      error: result.error,
    });
  }

  return res.status(200).json({
    ok: true,
    entitlementId: result.value.entitlementId,
    entitlement: safeEntitlement(result.value.entitlement),
  });
}
