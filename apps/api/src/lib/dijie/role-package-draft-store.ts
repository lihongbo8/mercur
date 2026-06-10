import type { DijieCatalogReviewRequestSummary } from "./catalog-store";
import type { DijieCapabilityMatchReport } from "./capability-bridge";
import type { DijieDialogModelUsage } from "./dialog-model-bridge";
import type { DijieRolePackageQualityReport } from "./role-package-quality";
import type {
  DijieRolePackageUploadFile,
  DijieRolePackageUploadSummary,
} from "./role-package-upload";

export type DijieRolePackageDraftStatus = "partial" | "ready" | "blocked" | "submitted";

export type DijieRolePackageDraftStorageRecord = {
  owner_id: string;
  draft_status: DijieRolePackageDraftStatus;
  source_message: string;
  package_id: string | null;
  package_version: string | null;
  generated_at: Date;
  manifest_summary: DijieRolePackageUploadSummary["manifestSummary"] | null;
  file_manifest: DijieRolePackageUploadSummary["files"];
  package_files: DijieRolePackageUploadFile[];
  capability_report: DijieCapabilityMatchReport;
  quality_report: DijieRolePackageQualityReport;
  upload_validation_issues: string[];
  blocking_issues: string[];
  model_usage: DijieDialogModelUsage | null;
  submitted_package_id: string | null;
};

export type DijieRolePackageDraftRepository = {
  createDijieRolePackageDrafts: (
    data: DijieRolePackageDraftStorageRecord,
  ) => Promise<{ id?: string }>;
};

export type DijieRolePackageDraftLookupRepository = {
  listDijieRolePackageDrafts: (
    filters?: {
      id?: string;
      owner_id?: string;
    },
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRolePackageDraftStorageRecord & { id?: string }>>;
};

export type DijieRolePackageDraftUpdateRepository = {
  updateDijieRolePackageDrafts: (
    data: Partial<DijieRolePackageDraftStorageRecord> & { id: string },
  ) => Promise<Array<DijieRolePackageDraftStorageRecord & { id?: string }>>;
};

export type DijieRolePackageDraftStore = {
  createDijieRolePackageDraft: (input: {
    ownerId: string;
    sourceMessage: string;
    files: DijieRolePackageUploadFile[];
    status?: DijieRolePackageDraftStatus;
    uploadSummary?: DijieRolePackageUploadSummary;
    capabilityReport: DijieCapabilityMatchReport;
    qualityReport: DijieRolePackageQualityReport;
    uploadValidationIssues: string[];
    blockingIssues: string[];
    modelUsage: DijieDialogModelUsage | null;
  }) => Promise<{ draftId?: string }>;
  updateDijieRolePackageDraft: (input: {
    draftId: string;
    ownerId: string;
    files: DijieRolePackageUploadFile[];
    status: DijieRolePackageDraftStatus;
    uploadSummary?: DijieRolePackageUploadSummary;
    capabilityReport: DijieCapabilityMatchReport;
    qualityReport: DijieRolePackageQualityReport;
    uploadValidationIssues: string[];
    blockingIssues: string[];
    modelUsage: DijieDialogModelUsage | null;
  }) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  markDijieRolePackageDraftSubmitted: (input: {
    draftId: string;
    ownerId: string;
    submittedPackageId?: string;
  }) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
};

export type DijieRolePackageDraftReader = {
  retrieveLatestDijieRolePackageDraft: (input: {
    ownerId: string;
  }) => Promise<(DijieRolePackageDraftStorageRecord & { id?: string }) | undefined>;
  retrieveDijieRolePackageDraft: (input: {
    draftId: string;
    ownerId: string;
  }) => Promise<(DijieRolePackageDraftStorageRecord & { id?: string }) | undefined>;
};

function fileManifest(files: DijieRolePackageUploadFile[]) {
  return files.map((file) => ({
    path: file.path,
    ...(file.sha256 ? { sha256: file.sha256 } : {}),
    ...(file.sizeBytes !== undefined ? { sizeBytes: file.sizeBytes } : {}),
  }));
}

export async function createDijieRolePackageDraftWithRepository(
  repository: DijieRolePackageDraftRepository,
  input: Parameters<DijieRolePackageDraftStore["createDijieRolePackageDraft"]>[0],
) {
  const blockingIssues = [...input.blockingIssues, ...input.uploadValidationIssues];
  const stored = await repository.createDijieRolePackageDrafts({
    owner_id: input.ownerId,
    draft_status:
      input.status ?? (blockingIssues.length === 0 && input.qualityReport.ok ? "ready" : "blocked"),
    source_message: input.sourceMessage,
    package_id: input.uploadSummary?.packageId ?? null,
    package_version: input.uploadSummary?.packageVersion ?? null,
    generated_at: new Date(),
    manifest_summary: input.uploadSummary?.manifestSummary ?? null,
    file_manifest: input.uploadSummary?.files ?? fileManifest(input.files),
    package_files: input.files,
    capability_report: input.capabilityReport,
    quality_report: input.qualityReport,
    upload_validation_issues: input.uploadValidationIssues,
    blocking_issues: [...new Set(blockingIssues)],
    model_usage: input.modelUsage,
    submitted_package_id: null,
  });

  return { draftId: stored.id };
}

export async function updateDijieRolePackageDraftWithRepository(
  repository: DijieRolePackageDraftLookupRepository & DijieRolePackageDraftUpdateRepository,
  input: Parameters<DijieRolePackageDraftStore["updateDijieRolePackageDraft"]>[0],
) {
  const record = await retrieveDijieRolePackageDraftWithRepository(repository, input);
  if (!record) {
    return { ok: false as const, status: 404, error: "未找到岗位包草稿。" };
  }
  if (record.draft_status === "submitted") {
    return { ok: false as const, status: 409, error: "岗位包草稿已提交，不能继续修改。" };
  }

  const blockingIssues = [...input.blockingIssues, ...input.uploadValidationIssues];
  await repository.updateDijieRolePackageDrafts({
    id: input.draftId,
    draft_status: input.status,
    package_id: input.uploadSummary?.packageId ?? null,
    package_version: input.uploadSummary?.packageVersion ?? null,
    generated_at: new Date(),
    manifest_summary: input.uploadSummary?.manifestSummary ?? null,
    file_manifest: input.uploadSummary?.files ?? fileManifest(input.files),
    package_files: input.files,
    capability_report: input.capabilityReport,
    quality_report: input.qualityReport,
    upload_validation_issues: input.uploadValidationIssues,
    blocking_issues: [...new Set(blockingIssues)],
    model_usage: input.modelUsage,
  });
  return { ok: true as const };
}

export async function retrieveLatestDijieRolePackageDraftWithRepository(
  repository: DijieRolePackageDraftLookupRepository,
  input: { ownerId: string },
) {
  const [record] = await repository.listDijieRolePackageDrafts(
    { owner_id: input.ownerId },
    { take: 1, order: { generated_at: "DESC" } },
  );
  return record;
}

export async function retrieveDijieRolePackageDraftWithRepository(
  repository: DijieRolePackageDraftLookupRepository,
  input: { draftId: string; ownerId: string },
) {
  const [record] = await repository.listDijieRolePackageDrafts(
    { id: input.draftId, owner_id: input.ownerId },
    { take: 1 },
  );
  return record;
}

export async function markDijieRolePackageDraftSubmittedWithRepository(
  repository: DijieRolePackageDraftLookupRepository & DijieRolePackageDraftUpdateRepository,
  input: { draftId: string; ownerId: string; submittedPackageId?: string },
) {
  const record = await retrieveDijieRolePackageDraftWithRepository(repository, input);
  if (!record) {
    return { ok: false as const, status: 404, error: "未找到岗位包草稿。" };
  }
  if (record.draft_status !== "ready") {
    return { ok: false as const, status: 409, error: "岗位包草稿未通过验收，不能提交。" };
  }
  await repository.updateDijieRolePackageDrafts({
    id: input.draftId,
    draft_status: "submitted",
    submitted_package_id: input.submittedPackageId ?? record.package_id,
  });
  return { ok: true as const };
}

export function createDijieRolePackageDraftReadModel(
  record: DijieRolePackageDraftStorageRecord & { id?: string },
  options: { catalogReviewRequests?: DijieCatalogReviewRequestSummary[] } = {},
) {
  return {
    draftId: record.id,
    ownerId: record.owner_id,
    status: record.draft_status,
    sourceMessage: record.source_message,
    packageId: record.package_id,
    packageVersion: record.package_version,
    generatedAt:
      record.generated_at instanceof Date ? record.generated_at.toISOString() : record.generated_at,
    manifestSummary: record.manifest_summary,
    fileCount: record.file_manifest.length,
    files: record.file_manifest,
    capabilityReport: record.capability_report,
    roleRequirementSpec: record.capability_report.requirementSpec,
    roleCapabilityPlan: record.capability_report.capabilityPlan,
    catalogBindings: record.capability_report.catalogBindings ?? [],
    catalogReviewRequests: options.catalogReviewRequests ?? [],
    reviewBlockers: record.capability_report.reviewBlockers ?? [],
    qualityReport: record.quality_report,
    uploadValidationIssues: record.upload_validation_issues,
    blockingIssues: record.blocking_issues,
    modelUsage: record.model_usage,
    submittedPackageId: record.submitted_package_id,
  };
}
