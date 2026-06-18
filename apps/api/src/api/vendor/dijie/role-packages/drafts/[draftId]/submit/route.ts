import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieCapabilityMatchReport } from "../../../../../../../lib/dijie/capability-bridge";
import {
  createDijieRoleCategoryRegistry,
  validateDijieRoleCategoryIntegration,
} from "../../../../../../../lib/dijie/role-category-registry";
import { createDijieRolePackageDraftReadModel } from "../../../../../../../lib/dijie/role-package-draft-store";
import {
  actorIdFromRequest,
  resolveCatalogReader,
  resolveRoleCategoryReader,
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
  const roleCategoryReader = resolveRoleCategoryReader(req);
  if (!roleCategoryReader) {
    return res.status(503).json({
      ok: false,
      error: "平台岗位品类存储暂未配置，不能提交岗位包。",
    });
  }
  const categoryRegistry = createDijieRoleCategoryRegistry(
    await roleCategoryReader.listDijieRoleCategories(),
  );
  const categoryCheck = validateDijieRoleCategoryIntegration({
    manifestSummary: draft.manifest_summary,
    registry: categoryRegistry,
  });
  if (!categoryCheck.ok) {
    return res.status(409).json({
      ok: false,
      error: categoryCheck.error ?? "岗位包草稿的平台品类和能力门禁未通过，不能提交。",
      draft: createDijieRolePackageDraftReadModel({
        ...draft,
        capability_report: capabilityReport,
      }),
      roleCapabilityPlan: capabilityReport.capabilityPlan,
      blockedReasons: [
        ...categoryCheck.missing,
        ...categoryCheck.blocked,
        ...(capabilityReport.reviewBlockers ?? capabilityReport.blockedReasons ?? []),
      ],
    });
  }
  const hardReviewBlockers = capabilityReport.reviewBlockers ?? [];
  if (hardReviewBlockers.length > 0) {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿包含平台禁止的能力需求，不能提交。",
      draft: createDijieRolePackageDraftReadModel({
        ...draft,
        capability_report: capabilityReport,
      }),
      roleCapabilityPlan: capabilityReport.capabilityPlan,
      blockedReasons: hardReviewBlockers,
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
