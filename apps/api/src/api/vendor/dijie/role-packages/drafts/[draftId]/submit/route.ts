import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieCapabilityMatchReport } from "../../../../../../../lib/dijie/capability-bridge";
import { createDijieRolePackageDraftReadModel } from "../../../../../../../lib/dijie/role-package-draft-store";
import {
  actorIdFromRequest,
  resolveCatalogReader,
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
  const catalogReader = resolveCatalogReader(req);
  const catalogItems = catalogReader
    ? await catalogReader.listDijieEffectiveCatalogItems()
    : undefined;
  const capabilityReport = createDijieCapabilityMatchReport(
    {
      files: draft.package_files,
      message: draft.source_message,
    },
    { catalogItems },
  );
  const capabilityPlan = capabilityReport.capabilityPlan;
  if (!capabilityReport.ok || !capabilityPlan || capabilityPlan.status !== "platform_ready") {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿存在未通过审核的 Skill/Tool 绑定，不能提交。",
      draft: createDijieRolePackageDraftReadModel({
        ...draft,
        capability_report: capabilityReport,
      }),
      roleCapabilityPlan: capabilityPlan,
      blockedReasons: capabilityReport.reviewBlockers ?? capabilityReport.blockedReasons,
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
