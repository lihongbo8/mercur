import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieRolePackageDraftReadModel,
  getDijieRolePackageDraftConfirmationStatus,
} from "../../../../../../../lib/dijie/role-package-draft-store";
import {
  actorIdFromRequest,
  resolveRolePackageDraftStore,
  resolveRolePackageStore,
} from "../../../route-utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "提交岗位包草稿需要登录开发者账号。",
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
  const packageStore = resolveRolePackageStore(req);
  if (!draftStore || !packageStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿或正式存储暂未配置。",
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
  if (draft.draft_status !== "ready" || !draft.manifest_summary || draft.blocking_issues.length > 0) {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿未通过验收，不能提交。",
      draft: createDijieRolePackageDraftReadModel(draft),
    });
  }
  const confirmationStatus = getDijieRolePackageDraftConfirmationStatus(draft);
  if (!confirmationStatus.allConfirmed) {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿还没有完成开发者逐文件确认，不能提交。",
      unconfirmedFiles: confirmationStatus.unconfirmedFiles,
      missingFiles: confirmationStatus.missingFiles,
      draft: {
        ...createDijieRolePackageDraftReadModel(draft),
        confirmationStatus,
      },
    });
  }

  const stored = await packageStore.storeDijieRolePackage({
    summary: {
      packageId: draft.package_id ?? draft.manifest_summary.name,
      packageVersion: draft.package_version ?? "1.0.0",
      manifestSummary: draft.manifest_summary,
      files: draft.file_manifest,
    },
    files: draft.package_files,
    ownerId: actorId,
  });
  const marked = await draftStore.markDijieRolePackageDraftSubmitted({
    draftId,
    ownerId: actorId,
    submittedPackageId: stored.rolePackageId ?? stored.packageId,
  });
  if (!marked.ok) {
    return res.status(marked.status).json({
      ok: false,
      error: marked.error,
    });
  }

  return res.status(200).json({
    ok: true,
    rolePackageId: stored.rolePackageId,
    packageId: stored.packageId,
    packageVersion: stored.packageVersion,
    downloadUrl: `/vendor/dijie/role-packages/${encodeURIComponent(
      stored.packageId,
    )}/download?version=${encodeURIComponent(stored.packageVersion)}`,
  });
}
