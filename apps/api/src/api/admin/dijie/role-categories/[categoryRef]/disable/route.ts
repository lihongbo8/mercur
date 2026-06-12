import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  asRecord,
  categoryRefFromRequest,
  nullableStringField,
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

  const body = asRecord(req.body);
  const saved = await context.categoryStore.disableDijieRoleCategory({
    categoryRef,
    disabledBy: context.actorId,
    reason: nullableStringField(body, "reason"),
  });
  if (!saved.ok) {
    return res.status(saved.status).json({ ok: false, error: saved.error });
  }

  return res.status(200).json({
    ok: true,
    categoryRef: saved.value.categoryRef,
    category: saved.value.category,
  });
}
