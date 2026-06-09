import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieCapabilityMatchReport } from "../../../../../../../lib/dijie/capability-bridge";
import {
  createDijieRolePackageDraftDetailReadModel,
  pruneDijieRolePackageDraftFileConfirmations,
} from "../../../../../../../lib/dijie/role-package-draft-store";
import { evaluateDijieRolePackageQuality } from "../../../../../../../lib/dijie/role-package-quality";
import {
  readDijieRolePackageUploadFilesForStorage,
  validateDijieRolePackageUpload,
} from "../../../../../../../lib/dijie/role-package-upload";
import { actorIdFromRequest, asRecord, resolveRolePackageDraftStore, stringField } from "../../../route-utils";

function revalidateDraftFiles(input: {
  files: ReturnType<typeof readDijieRolePackageUploadFilesForStorage>;
  sourceMessage: string;
}) {
  const uploadBody = { files: input.files };
  const uploadValidation = validateDijieRolePackageUpload(uploadBody);
  const uploadValidationIssues = uploadValidation.ok ? [] : uploadValidation.issues;
  const qualityReport = evaluateDijieRolePackageQuality(input.files);
  const capabilityReport = createDijieCapabilityMatchReport({
    files: readDijieRolePackageUploadFilesForStorage(uploadBody),
    message: input.sourceMessage,
  });
  const blockingIssues = [
    ...uploadValidationIssues,
    ...qualityReport.blockingIssues,
  ];
  const status =
    blockingIssues.length === 0 && uploadValidation.ok && qualityReport.ok ? "ready" : "blocked";

  return {
    status,
    uploadSummary: uploadValidation.ok ? uploadValidation.value : undefined,
    capabilityReport,
    qualityReport,
    uploadValidationIssues,
    blockingIssues: [...new Set(blockingIssues)],
  } as const;
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "修改岗位包草稿需要登录开发者账号。",
    });
  }

  const draftId = req.params?.draftId;
  if (!draftId) {
    return res.status(400).json({
      ok: false,
      error: "岗位包草稿编号不能为空。",
    });
  }

  const body = asRecord(req.body);
  const rawPath = stringField(body, "path");
  const rawContent = body.content;
  if (!rawPath || typeof rawContent !== "string") {
    return res.status(400).json({
      ok: false,
      error: "草稿文件路径和内容不能为空。",
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
  if (draft.draft_status === "submitted") {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿已提交，不能继续修改。",
    });
  }

  const [normalizedTarget] = readDijieRolePackageUploadFilesForStorage({
    files: [{ path: rawPath, content: rawContent }],
  });
  if (!normalizedTarget) {
    return res.status(400).json({
      ok: false,
      error: "草稿文件路径不合法。",
    });
  }

  const hasFile = draft.package_files.some((file) => file.path === normalizedTarget.path);
  if (!hasFile) {
    return res.status(404).json({
      ok: false,
      error: "未找到要修改的草稿文件。",
    });
  }

  const files = readDijieRolePackageUploadFilesForStorage({
    files: draft.package_files.map((file) =>
      file.path === normalizedTarget.path
        ? { path: normalizedTarget.path, content: rawContent }
        : file,
    ),
  });
  const validation = revalidateDraftFiles({
    files,
    sourceMessage: draft.source_message,
  });
  const updated = await draftStore.updateDijieRolePackageDraft({
    draftId,
    ownerId: actorId,
    files,
    status: validation.status,
    uploadSummary: validation.uploadSummary,
    capabilityReport: validation.capabilityReport,
    qualityReport: validation.qualityReport,
    uploadValidationIssues: validation.uploadValidationIssues,
    blockingIssues: [...validation.blockingIssues],
    fileConfirmations: pruneDijieRolePackageDraftFileConfirmations({
      files,
      confirmations: draft.file_confirmations,
      clearPaths: [normalizedTarget.path],
    }),
    modelUsage: draft.model_usage,
  });
  if (!updated.ok) {
    return res.status(updated.status).json({
      ok: false,
      error: updated.error,
    });
  }

  const refreshed = await draftStore.retrieveDijieRolePackageDraft({
    draftId,
    ownerId: actorId,
  });

  return res.status(200).json({
    ok: true,
    draft: refreshed ? createDijieRolePackageDraftDetailReadModel(refreshed) : undefined,
  });
}
