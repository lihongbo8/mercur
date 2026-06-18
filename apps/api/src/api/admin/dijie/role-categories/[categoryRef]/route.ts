import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  asRecord,
  categoryRefFromRequest,
  resolveRoleCategoryAdminContext,
  stringField,
} from "../shared";

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const context = await resolveRoleCategoryAdminContext(req);
  if (!context.ok) {
    return res.status(context.status).json({ ok: false, error: context.error });
  }

  const categoryRef = categoryRefFromRequest(req);
  if (!categoryRef) {
    return res.status(400).json({ ok: false, error: "品类引用不能为空。" });
  }

  const body = asRecord(req.body);
  const riskPolicy =
    "riskPolicy" in body || "risk_policy" in body
      ? asRecord(body.riskPolicy ?? body.risk_policy)
      : undefined;
  const reviewPolicy =
    "reviewPolicy" in body || "review_policy" in body
      ? asRecord(body.reviewPolicy ?? body.review_policy)
      : undefined;
  const result = await context.categoryStore.updateDijieRoleCategoryRecord({
    categoryRef,
    name: stringField(body, "name"),
    version: stringField(body, "version"),
    description: stringField(body, "description"),
    riskPolicy,
    reviewPolicy,
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
