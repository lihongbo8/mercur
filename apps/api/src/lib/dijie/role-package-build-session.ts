import { createDijieCapabilityMatchReport } from "./capability-bridge";
import type { DijieDialogModelUsage } from "./dialog-model-bridge";
import {
  missingGeneratedPaths,
  type RolePackageGenerationStage,
} from "./role-package-generator";
import type {
  DijieRolePackageDraftStatus,
  DijieRolePackageDraftStore,
} from "./role-package-draft-store";
import { evaluateDijieRolePackageQuality } from "./role-package-quality";
import {
  readDijieRolePackageUploadFilesForStorage,
  validateDijieRolePackageUpload,
  type DijieRolePackageUploadFile,
} from "./role-package-upload";

export type RoleBuildArtifact = {
  stageId: string;
  stageLabel: string;
  status: DijieRolePackageDraftStatus;
  draftId: string;
  fileCount: number;
  outputPaths: string[];
  missingPaths: string[];
  blockingIssues: string[];
};

export async function persistDijieRolePackageBuildStage(input: {
  draftStore: DijieRolePackageDraftStore;
  draftId?: string;
  ownerId: string;
  sourceMessage: string;
  files: DijieRolePackageUploadFile[];
  stage: RolePackageGenerationStage;
  modelUsage: DijieDialogModelUsage | null;
}): Promise<RoleBuildArtifact> {
  const missingPaths = missingGeneratedPaths(input.files);
  const uploadBody = { files: input.files };
  const complete = missingPaths.length === 0;
  const uploadValidation = complete
    ? validateDijieRolePackageUpload(uploadBody)
    : ({ ok: false, issues: [] } as const);
  const uploadValidationIssues = uploadValidation.ok ? [] : uploadValidation.issues;
  const qualityReport = evaluateDijieRolePackageQuality(input.files);
  const capabilityReport = createDijieCapabilityMatchReport({
    files: readDijieRolePackageUploadFilesForStorage(uploadBody),
    message: input.sourceMessage,
  });
  const blockingIssues = [
    ...missingPaths.map((path) => `missing ${path}`),
    ...uploadValidationIssues,
    ...qualityReport.blockingIssues,
  ];
  const status: DijieRolePackageDraftStatus =
    !complete && !input.stage.final
      ? "partial"
      : blockingIssues.length === 0 && uploadValidation.ok && qualityReport.ok
        ? "ready"
        : "blocked";

  if (!input.draftId) {
    const stored = await input.draftStore.createDijieRolePackageDraft({
      ownerId: input.ownerId,
      sourceMessage: input.sourceMessage,
      files: input.files,
      status,
      uploadSummary: uploadValidation.ok ? uploadValidation.value : undefined,
      capabilityReport,
      qualityReport,
      uploadValidationIssues,
      blockingIssues: [...new Set(blockingIssues)],
      modelUsage: input.modelUsage,
    });
    if (!stored.draftId) {
      throw new Error("岗位包草稿创建失败。");
    }
    return {
      stageId: input.stage.id,
      stageLabel: input.stage.label,
      status,
      draftId: stored.draftId,
      fileCount: input.files.length,
      outputPaths: input.stage.outputPaths,
      missingPaths,
      blockingIssues: [...new Set(blockingIssues)],
    };
  }

  const updated = await input.draftStore.updateDijieRolePackageDraft({
    draftId: input.draftId,
    ownerId: input.ownerId,
    files: input.files,
    status,
    uploadSummary: uploadValidation.ok ? uploadValidation.value : undefined,
    capabilityReport,
    qualityReport,
    uploadValidationIssues,
    blockingIssues: [...new Set(blockingIssues)],
    modelUsage: input.modelUsage,
  });
  if (!updated.ok) {
    throw new Error(updated.error);
  }

  return {
    stageId: input.stage.id,
    stageLabel: input.stage.label,
    status,
    draftId: input.draftId,
    fileCount: input.files.length,
    outputPaths: input.stage.outputPaths,
    missingPaths,
    blockingIssues: [...new Set(blockingIssues)],
  };
}
