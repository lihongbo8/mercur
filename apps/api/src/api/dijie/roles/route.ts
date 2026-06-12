import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../lib/dijie/audit-store";
import { createDijieRoleCategoryRegistry } from "../../../lib/dijie/role-category-registry";
import { listDijiePublicRoleListingReadModels } from "../../../lib/dijie/role-listings";
import { resolveDijieRoleCategoryReader } from "../../../lib/dijie/service-reader-adapters";

function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE);
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query");

  try {
    const categoryReader = resolveDijieRoleCategoryReader(resolveAuditService(req));
    const categoryRegistry = categoryReader
      ? createDijieRoleCategoryRegistry(await categoryReader.listDijieRoleCategories())
      : undefined;
    const roles = await listDijiePublicRoleListingReadModels(
      (queryInput) => query.graph(queryInput),
      categoryRegistry,
    );
    return res.status(200).json({
      ok: true,
      roles,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位商场暂时无法读取岗位商品。",
    });
  }
}
