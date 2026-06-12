import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  asRecord,
  categoryRefFromRequest,
  nullableStringField,
  resolveRoleCategoryAdminContext,
  stringArray,
  stringField,
} from "../../shared";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await resolveRoleCategoryAdminContext(req);
  if (!context.ok) {
    return res.status(context.status).json({ ok: false, error: context.error });
  }

  const categoryRef = categoryRefFromRequest(req);
  if (!categoryRef) {
    return res.status(400).json({ ok: false, error: "品类引用不能为空。" });
  }

  const body = asRecord(req.body);
  const categoryPackRef =
    stringField(body, "categoryPackRef") ?? stringField(body, "category_pack_ref");
  const skillPackRef =
    stringField(body, "skillPackRef") ?? stringField(body, "skill_pack_ref");
  const toolPackRef =
    stringField(body, "toolPackRef") ?? stringField(body, "tool_pack_ref");
  const catalogRefs = stringArray(body.catalogRefs ?? body.catalog_refs);
  if (!categoryPackRef || !skillPackRef || !toolPackRef) {
    return res.status(400).json({
      ok: false,
      error: "绑定品类包必须填写 categoryPackRef、skillPackRef 和 toolPackRef。",
    });
  }

  const catalogItems = await context.catalogReader.listDijieEffectiveCatalogItems();
  const result = await context.categoryStore.bindDijieRoleCategoryPack({
    categoryRef,
    categoryPackRef,
    skillPackRef,
    toolPackRef,
    catalogRefs,
    catalogItems,
    riskPolicyRef:
      nullableStringField(body, "riskPolicyRef") ??
      nullableStringField(body, "risk_policy_ref"),
    reviewPolicyRef:
      nullableStringField(body, "reviewPolicyRef") ??
      nullableStringField(body, "review_policy_ref"),
  });
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  return res.status(200).json({
    ok: true,
    categoryRef: result.value.categoryRef,
    category: result.value.category,
  });
}
