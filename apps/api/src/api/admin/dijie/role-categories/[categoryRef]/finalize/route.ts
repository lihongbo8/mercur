import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  asRecord,
  categoryRefFromRequest,
  nullableStringField,
  resolveRoleCategoryAdminContext,
} from "../../shared";

function finalResult(value: unknown): "approved" | "request_changes" | undefined {
  return value === "approved" || value === "request_changes" ? value : undefined;
}

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
  const result = finalResult(body.result ?? body.finalResult ?? body.final_result);
  if (!result) {
    return res.status(400).json({
      ok: false,
      error: "品类审核动作必须是 approved 或 request_changes。",
    });
  }

  const saved = await context.categoryStore.finalizeDijieRoleCategoryReview({
    categoryRef,
    result,
    reviewedBy: context.actorId,
    reviewNote:
      nullableStringField(body, "reviewNote") ??
      nullableStringField(body, "review_note"),
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
