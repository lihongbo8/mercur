import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
import type { DijieRoleListingStore } from "../../../../../lib/dijie/role-listing-store";

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

function nullableStringField(
  record: UnknownRecord,
  field: string,
): string | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return stringField(record, field);
}

function numberField(record: UnknownRecord, field: string): number | undefined {
  const value = record[field];
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : [];
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord })
    .auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = (
    req as MedusaRequest & { seller_context?: UnknownRecord }
  ).seller_context;
  return sellerContext ? stringField(sellerContext, "seller_id") : undefined;
}

function isRoleListingStore(value: unknown): value is DijieRoleListingStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { updateDijieRoleListingDraft?: unknown })
      .updateDijieRoleListingDraft === "function"
  );
}

function resolveRoleListingStore(
  req: MedusaRequest,
): DijieRoleListingStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRoleListingStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "编辑岗位商品需要登录开发者账号并选择开发者店铺。",
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

  const body = asRecord(req.body);
  try {
    const result = await store.updateDijieRoleListingDraft({
      roleListingId: roleListingId.trim(),
      ownerId: actorId,
      sellerId,
      title: stringField(body, "title"),
      subtitle: nullableStringField(body, "subtitle"),
      description: nullableStringField(body, "description"),
      usageInstructions:
        nullableStringField(body, "usageInstructions") ??
        nullableStringField(body, "usage_instructions"),
      category: nullableStringField(body, "category"),
      capabilities: stringArray(body.capabilities),
      pricing: body.pricing,
      roleTokenPricing: body.roleTokenPricing ?? body.role_token_pricing,
      confirmationPoints: numberField(body, "confirmationPoints"),
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
      error: error instanceof Error ? error.message : "岗位商品草稿更新失败。",
    });
  }
}
