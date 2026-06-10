import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import type { DijieRoleListingStore } from "../../../../../../lib/dijie/role-listing-store";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = (req as MedusaRequest & { seller_context?: UnknownRecord }).seller_context;
  return sellerContext ? stringField(sellerContext, "seller_id") : undefined;
}

function isRoleListingStore(value: unknown): value is DijieRoleListingStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { publishDijieRoleListing?: unknown })
      .publishDijieRoleListing === "function"
  );
}

function resolveRoleListingStore(req: MedusaRequest): DijieRoleListingStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRoleListingStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "上架岗位商品需要登录开发者账号并选择开发者店铺。",
    });
  }

  const roleListingId = req.params?.roleListingId;
  if (typeof roleListingId !== "string" || !roleListingId.trim()) {
    return res.status(400).json({
      ok: false,
      error: "岗位商品编号不能为空。",
    });
  }

  const store = resolveRoleListingStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位商品存储暂未配置。",
    });
  }

  try {
    const result = await store.publishDijieRoleListing({
      roleListingId: roleListingId.trim(),
      ownerId: actorId,
      sellerId,
    });
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      roleListingId: result.value.roleListingId,
      listing: result.value.listing,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "岗位商品上架失败。",
    });
  }
}
