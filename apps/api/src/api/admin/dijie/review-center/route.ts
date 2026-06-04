import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDijieReviewCenterReadModel } from "../../../../lib/dijie/role-review-center";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query");
  const adminAccountId = actorIdFromRequest(req);

  try {
    const reviewCenter = await getDijieReviewCenterReadModel((queryInput) =>
      query.graph(queryInput),
      { adminAccountId },
    );

    return res.status(200).json({
      ok: true,
      reviewCenter,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI审核中心暂时无法读取岗位审核数据。",
    });
  }
}
