import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { resolveDijieRoleCategoryReader } from "../../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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

function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "读取岗位品类需要登录开发者账号并选择开发者店铺。",
    });
  }

  const reader = resolveDijieRoleCategoryReader(resolveAuditService(req));
  if (!reader) {
    return res.status(503).json({
      ok: false,
      error: "岗位品类存储暂未配置。",
    });
  }

  const categories = (await reader.listDijieRoleCategories())
    .filter((category) => category.status === "approved")
    .map((category) => ({
      categoryRef: category.categoryRef,
      name: category.name,
      version: category.version,
      description: category.description,
      packBinding: category.packBinding
        ? {
            categoryPackRef: category.packBinding.categoryPackRef,
            skillPackRef: category.packBinding.skillPackRef,
            toolPackRef: category.packBinding.toolPackRef,
            inheritedCatalogRefCount: category.packBinding.catalogRefs.length,
            inheritedCapabilityRefCount: category.packBinding.capabilityRefs.length,
          }
        : null,
    }));

  return res.status(200).json({
    ok: true,
    categories,
  });
}
