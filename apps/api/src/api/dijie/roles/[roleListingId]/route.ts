import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDijieRoleDetailReadModel } from "../../../../lib/dijie/role-listings";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const roleListingId = req.params?.roleListingId;
  if (typeof roleListingId !== "string" || !roleListingId.trim()) {
    return res.status(400).json({
      ok: false,
      error: "岗位编号不能为空。",
    });
  }

  const query = req.scope.resolve("query");

  try {
    const role = await getDijieRoleDetailReadModel({
      roleListingId: roleListingId.trim(),
      queryGraph: (queryInput) => query.graph(queryInput),
    });

    if (!role) {
      return res.status(404).json({
        ok: false,
        error: "未找到可公开展示的岗位。",
      });
    }

    return res.status(200).json({
      ok: true,
      role,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位商场暂时无法读取岗位详情。",
    });
  }
}
