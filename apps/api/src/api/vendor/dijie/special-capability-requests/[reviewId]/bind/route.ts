import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import type { DijieCatalogReviewStore } from "../../../../../../lib/dijie/catalog-store";

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

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = (req as MedusaRequest & { seller_context?: UnknownRecord }).seller_context;
  return sellerContext ? stringField(sellerContext, "seller_id") : undefined;
}

function isSpecialCapabilityBindingStore(value: unknown): value is DijieCatalogReviewStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { bindDijieSpecialCapabilityToRole?: unknown })
      .bindDijieSpecialCapabilityToRole === "function"
  );
}

function resolveBindingStore(req: MedusaRequest): DijieCatalogReviewStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isSpecialCapabilityBindingStore(service) ? service : undefined;
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
      error: "绑定特殊能力包需要登录开发者账号并选择开发者店铺。",
    });
  }

  const reviewId = stringField(asRecord(req.params), "reviewId");
  if (!reviewId) {
    return res.status(400).json({
      ok: false,
      error: "特殊能力包申请编号不能为空。",
    });
  }

  const roleListingId =
    stringField(asRecord(req.body), "roleListingId") ??
    stringField(asRecord(req.body), "role_listing_id");
  if (!roleListingId) {
    return res.status(400).json({
      ok: false,
      error: "绑定特殊能力包必须指定岗位商品。",
      issues: ["roleListingId_required"],
    });
  }

  const store = resolveBindingStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      error: "特殊能力包绑定存储暂未配置。",
    });
  }

  const result = await store.bindDijieSpecialCapabilityToRole({
    reviewId,
    roleListingId,
    boundBy: actorId,
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
    binding: result.binding,
  });
}
