import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieRolePackageDraftDetailReadModel } from "../../../../../../lib/dijie/role-package-draft-store";
import { actorIdFromRequest, resolveRolePackageDraftStore } from "../../route-utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "查看岗位包草稿需要登录开发者账号。",
    });
  }

  const draftId = req.params?.draftId;
  if (!draftId) {
    return res.status(400).json({
      ok: false,
      error: "岗位包草稿编号不能为空。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿存储暂未配置。",
    });
  }

  const draft = await draftStore.retrieveDijieRolePackageDraft({
    draftId,
    ownerId: actorId,
  });
  if (!draft) {
    return res.status(404).json({
      ok: false,
      error: "未找到岗位包草稿。",
    });
  }

  return res.status(200).json({
    ok: true,
    draft: createDijieRolePackageDraftDetailReadModel(draft),
  });
}
