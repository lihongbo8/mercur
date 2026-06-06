import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieDeveloperDialogContext,
  getDijieDialogBillingPolicy,
} from "../../../../../lib/dijie/dialog-context";
import type { DijieDialogModelUsage } from "../../../../../lib/dijie/dialog-model-bridge";
import { createDijieCapabilityMatchReport } from "../../../../../lib/dijie/capability-bridge";
import {
  generateDijieRolePackageDraftWithModel,
  missingGeneratedPaths,
  type RolePackageGenerationStage,
} from "../../../../../lib/dijie/role-package-generator";
import { createDijieRolePackageDraftReadModel } from "../../../../../lib/dijie/role-package-draft-store";
import { evaluateDijieRolePackageQuality } from "../../../../../lib/dijie/role-package-quality";
import {
  readDijieRolePackageUploadFilesForStorage,
  validateDijieRolePackageUpload,
  type DijieRolePackageUploadFile,
} from "../../../../../lib/dijie/role-package-upload";
import {
  actorIdFromRequest,
  asRecord,
  resolveOpenClawDialogModelBridge,
  resolveRolePackageDraftStore,
  stringField,
} from "../route-utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "生成岗位包需要登录开发者账号。",
    });
  }

  const body = asRecord(req.body);
  const message = stringField(body, "message") ?? stringField(body, "prompt");
  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "岗位开发需求不能为空。",
    });
  }

  const bridge = resolveOpenClawDialogModelBridge(req);
  if (!bridge) {
    return res.status(503).json({
      ok: false,
      error: "AI开发助手模型桥暂未配置，不能生成岗位包。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿存储暂未配置。",
    });
  }

  const context = createDijieDeveloperDialogContext({ developerAccountId: actorId });
  const billingPolicy = getDijieDialogBillingPolicy(context);
  const latestDraft = await draftStore.retrieveLatestDijieRolePackageDraft({ ownerId: actorId });
  let generatedDraftId: string | undefined;
  const persistGeneratedStage = async (
    stage: RolePackageGenerationStage,
    files: DijieRolePackageUploadFile[],
    modelUsage: DijieDialogModelUsage | null,
  ) => {
    const missingPaths = missingGeneratedPaths(files);
    const uploadBody = { files };
    const complete = missingPaths.length === 0;
    const uploadValidation = complete
      ? validateDijieRolePackageUpload(uploadBody)
      : ({ ok: false, issues: [] } as const);
    const uploadValidationIssues = uploadValidation.ok ? [] : uploadValidation.issues;
    const qualityReport = evaluateDijieRolePackageQuality(files);
    const capabilityReport = createDijieCapabilityMatchReport({
      files: readDijieRolePackageUploadFilesForStorage(uploadBody),
      message,
    });
    const blockingIssues = [
      ...missingPaths.map((path) => `missing ${path}`),
      ...uploadValidationIssues,
      ...qualityReport.blockingIssues,
    ];
    const status =
      !complete && !stage.final
        ? "partial"
        : blockingIssues.length === 0 && uploadValidation.ok && qualityReport.ok
          ? "ready"
          : "blocked";
    const draftInput = {
      ownerId: actorId,
      sourceMessage: message,
      files,
      status,
      uploadSummary: uploadValidation.ok ? uploadValidation.value : undefined,
      capabilityReport,
      qualityReport,
      uploadValidationIssues,
      blockingIssues: [...new Set(blockingIssues)],
      modelUsage,
    };

    if (!generatedDraftId) {
      const stored = await draftStore.createDijieRolePackageDraft(draftInput);
      generatedDraftId = stored.draftId;
      if (!generatedDraftId) {
        throw new Error("岗位包草稿创建失败。");
      }
      return;
    }

    const updated = await draftStore.updateDijieRolePackageDraft({
      draftId: generatedDraftId,
      ...draftInput,
    });
    if (!updated.ok) {
      throw new Error(updated.error);
    }
  };
  const generation = await generateDijieRolePackageDraftWithModel({
    bridge,
    context,
    billingPolicy,
    message,
    previousDraftSummary: latestDraft
      ? `draftId=${latestDraft.id}; package=${latestDraft.package_id ?? "unknown"}; status=${latestDraft.draft_status}`
      : undefined,
    onStageFiles: async ({ stage, allFiles, modelUsage }) => {
      await persistGeneratedStage(stage, allFiles, modelUsage);
    },
  });

  if (!generation.ok) {
    return res.status(generation.status).json({
      ok: false,
      error: generation.error,
      issues: generation.issues,
      diagnostics: generation.diagnostics,
      modelUsage: generation.modelUsage ?? null,
      modelCalled: true,
    });
  }

  if (!generatedDraftId) {
    const stored = await draftStore.createDijieRolePackageDraft({
      ownerId: actorId,
      sourceMessage: message,
      files: generation.value.files,
      uploadSummary: generation.value.uploadSummary,
      capabilityReport: generation.value.capabilityReport,
      qualityReport: generation.value.qualityReport,
      uploadValidationIssues: generation.value.uploadValidationIssues,
      blockingIssues: [],
      modelUsage: generation.value.modelUsage,
    });
    generatedDraftId = stored.draftId;
  }
  const record = generatedDraftId
    ? await draftStore.retrieveDijieRolePackageDraft({
        draftId: generatedDraftId,
        ownerId: actorId,
      })
    : undefined;

  return res.status(200).json({
    ok: true,
    draft: record ? createDijieRolePackageDraftReadModel(record) : undefined,
    files: generation.value.files,
    manifestSummary: generation.value.uploadSummary?.manifestSummary,
    capabilityReport: generation.value.capabilityReport,
    qualityReport: generation.value.qualityReport,
    uploadValidationIssues: generation.value.uploadValidationIssues,
    modelUsage: generation.value.modelUsage,
    modelCalled: true,
  });
}
