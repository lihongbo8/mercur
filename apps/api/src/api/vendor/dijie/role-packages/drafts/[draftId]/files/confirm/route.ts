import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieRolePackageDraftDetailReadModel,
} from "../../../../../../../../lib/dijie/role-package-draft-store";
import { actorIdFromRequest, asRecord, resolveRolePackageDraftStore, stringField } from "../../../../route-utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "确认岗位包草稿文件需要登录开发者账号。",
    });
  }

  const draftId = req.params?.draftId;
  if (!draftId) {
    return res.status(400).json({
      ok: false,
      error: "岗位包草稿编号不能为空。",
    });
  }

  const path = stringField(asRecord(req.body), "path");
  if (!path) {
    return res.status(400).json({
      ok: false,
      error: "草稿文件路径不能为空。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore || typeof draftStore.confirmDijieRolePackageDraftFile !== "function") {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿确认服务暂未配置。",
    });
  }

  const confirmed = await draftStore.confirmDijieRolePackageDraftFile({
    draftId,
    ownerId: actorId,
    path,
  });
  if (!confirmed.ok) {
    return res.status(confirmed.status).json({
      ok: false,
      error: confirmed.error,
    });
  }

  const draft = await draftStore.retrieveDijieRolePackageDraft({
    draftId,
    ownerId: actorId,
  });

  return res.status(200).json({
    ok: true,
    confirmation: confirmed.confirmation,
    draft: draft ? createDijieRolePackageDraftDetailReadModel(draft) : undefined,
  });
}
