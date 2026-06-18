import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../lib/dijie/audit-store";
import { resolveDijieRoleCategoryReader } from "../../../lib/dijie/service-reader-adapters";

function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE);
  } catch {
    return undefined;
  }
}

function slugFromCategoryRef(categoryRef: string): string {
  return categoryRef
    .replace(/^category:/u, "")
    .replace(/@.+$/u, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reader = resolveDijieRoleCategoryReader(resolveAuditService(req));
  if (!reader) {
    return res.status(503).json({
      ok: false,
      error: "岗位品类暂时无法读取。",
    });
  }

  const categories = (await reader.listDijieRoleCategories())
    .filter((category) => category.status === "approved")
    .map((category) => ({
      categoryRef: category.categoryRef,
      slug: slugFromCategoryRef(category.categoryRef),
      name: category.name,
      version: category.version,
      description: category.description,
      reviewedAt: category.reviewedAt ?? null,
      packBinding: category.packBinding
        ? {
            categoryPackRef: category.packBinding.categoryPackRef,
            skillPackRef: category.packBinding.skillPackRef,
            toolPackRef: category.packBinding.toolPackRef,
            catalogRefs: category.packBinding.catalogRefs,
            capabilityRefs: category.packBinding.capabilityRefs,
            permissionSummary: category.packBinding.permissionSummary,
          }
        : null,
    }));

  return res.status(200).json({
    ok: true,
    categories,
  });
}
