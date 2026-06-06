import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieRolePackageDraftReadModel } from "../../../../../../lib/dijie/role-package-draft-store";
import { actorIdFromRequest, resolveRolePackageDraftStore } from "../../route-utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "读取岗位包草稿需要登录开发者账号。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿存储暂未配置。",
    });
  }

  const draft = await draftStore.retrieveLatestDijieRolePackageDraft({ ownerId: actorId });
  return res.status(200).json({
    ok: true,
    draft: draft ? createDijieRolePackageDraftReadModel(draft) : null,
  });
}
