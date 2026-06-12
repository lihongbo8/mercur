import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  categoryRefFromRequest,
  resolveRoleCategoryAdminContext,
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

  const result = await context.categoryStore.submitDijieRoleCategoryReview({
    categoryRef,
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
