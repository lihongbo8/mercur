import crypto from "node:crypto";
import type { DijieCapabilityMatchReport } from "./capability-bridge";
import type { DijieDialogModelUsage } from "./dialog-model-bridge";
import type { DijieRolePackageQualityReport } from "./role-package-quality";
import type {
  DijieRolePackageUploadFile,
  DijieRolePackageUploadSummary,
} from "./role-package-upload";

export type DijieRolePackageDraftStatus = "partial" | "ready" | "blocked" | "submitted";

export type DijieRolePackageDraftFileConfirmation = {
  path: string;
  sha256: string;
  confirmed_at: string;
  confirmed_by: string;
};

export type DijieRolePackageDraftFileConfirmations = Record<
  string,
  DijieRolePackageDraftFileConfirmation
>;

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
  file_confirmations?: DijieRolePackageDraftFileConfirmations | null;
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
    fileConfirmations?: DijieRolePackageDraftFileConfirmations | null;
    modelUsage: DijieDialogModelUsage | null;
  }) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  confirmDijieRolePackageDraftFile: (input: {
    draftId: string;
    ownerId: string;
    path: string;
  }) => Promise<
    | { ok: true; confirmation: DijieRolePackageDraftFileConfirmation }
    | { ok: false; status: number; error: string }
  >;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function fileSha256(file: DijieRolePackageUploadFile): string | undefined {
  return file.sha256 ?? (typeof file.content === "string" ? sha256(file.content) : undefined);
}

function fileManifest(files: DijieRolePackageUploadFile[]) {
  return files.map((file) => ({
    path: file.path,
    ...(fileSha256(file) ? { sha256: fileSha256(file) } : {}),
    ...(file.sizeBytes !== undefined ? { sizeBytes: file.sizeBytes } : {}),
  }));
}

function normalizeFileConfirmations(
  value: unknown,
): DijieRolePackageDraftFileConfirmations {
  const source = asRecord(value);
  const normalized: DijieRolePackageDraftFileConfirmations = {};

  for (const [key, entry] of Object.entries(source)) {
    const record = asRecord(entry);
    const path = stringField(record, "path") ?? key;
    const digest = stringField(record, "sha256");
    const confirmedAt = stringField(record, "confirmed_at");
    const confirmedBy = stringField(record, "confirmed_by");
    if (!path || !digest || !confirmedAt || !confirmedBy) {
      continue;
    }
    normalized[path] = {
      path,
      sha256: digest,
      confirmed_at: confirmedAt,
      confirmed_by: confirmedBy,
    };
  }

  return normalized;
}

export function getDijieRolePackageDraftConfirmationStatus(
  record: DijieRolePackageDraftStorageRecord & { id?: string },
  requiredPaths?: readonly string[],
) {
  const confirmations = normalizeFileConfirmations(record.file_confirmations);
  const filesByPath = new Map(record.package_files.map((file) => [file.path, file]));
  const required = requiredPaths?.length
    ? [...new Set(requiredPaths)]
    : record.file_manifest.map((file) => file.path);
  const confirmedFiles: string[] = [];
  const unconfirmedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const path of required) {
    const file = filesByPath.get(path);
    if (!file) {
      missingFiles.push(path);
      unconfirmedFiles.push(path);
      continue;
    }
    const currentDigest = fileSha256(file);
    const confirmation = confirmations[path];
    if (currentDigest && confirmation?.sha256 === currentDigest) {
      confirmedFiles.push(path);
    } else {
      unconfirmedFiles.push(path);
    }
  }

  return {
    requiredFileCount: required.length,
    confirmedFileCount: confirmedFiles.length,
    confirmedFiles,
    unconfirmedFiles,
    missingFiles,
    allConfirmed: required.length > 0 && unconfirmedFiles.length === 0 && missingFiles.length === 0,
  };
}

export function pruneDijieRolePackageDraftFileConfirmations(input: {
  files: DijieRolePackageUploadFile[];
  confirmations?: DijieRolePackageDraftFileConfirmations | null;
  clearPaths?: string[];
}): DijieRolePackageDraftFileConfirmations {
  const confirmations = normalizeFileConfirmations(input.confirmations);
  const clearPaths = new Set(input.clearPaths ?? []);
  const filesByPath = new Map(input.files.map((file) => [file.path, file]));
  const pruned: DijieRolePackageDraftFileConfirmations = {};

  for (const [path, confirmation] of Object.entries(confirmations)) {
    const file = filesByPath.get(path);
    if (!file || clearPaths.has(path)) {
      continue;
    }
    const currentDigest = fileSha256(file);
    if (currentDigest && confirmation.sha256 === currentDigest) {
      pruned[path] = confirmation;
    }
  }

  return pruned;
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
    file_confirmations: {},
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
    ...(input.fileConfirmations !== undefined
      ? { file_confirmations: input.fileConfirmations ?? {} }
      : {}),
    model_usage: input.modelUsage,
  });
  return { ok: true as const };
}

export async function confirmDijieRolePackageDraftFileWithRepository(
  repository: DijieRolePackageDraftLookupRepository & DijieRolePackageDraftUpdateRepository,
  input: { draftId: string; ownerId: string; path: string },
) {
  const record = await retrieveDijieRolePackageDraftWithRepository(repository, input);
  if (!record) {
    return { ok: false as const, status: 404, error: "未找到岗位包草稿。" };
  }
  if (record.draft_status === "submitted") {
    return { ok: false as const, status: 409, error: "岗位包草稿已提交，不能继续确认。" };
  }
  if (record.draft_status !== "ready" || record.blocking_issues.length > 0) {
    return { ok: false as const, status: 409, error: "岗位包草稿未通过验收，不能确认文件。" };
  }
  const file = record.package_files.find((entry) => entry.path === input.path);
  const digest = file ? fileSha256(file) : undefined;
  if (!file || !digest) {
    return { ok: false as const, status: 404, error: "未找到可确认的草稿文件。" };
  }

  const confirmation: DijieRolePackageDraftFileConfirmation = {
    path: input.path,
    sha256: digest,
    confirmed_at: new Date().toISOString(),
    confirmed_by: input.ownerId,
  };
  await repository.updateDijieRolePackageDrafts({
    id: input.draftId,
    file_confirmations: {
      ...pruneDijieRolePackageDraftFileConfirmations({
        files: record.package_files,
        confirmations: record.file_confirmations,
      }),
      [input.path]: confirmation,
    },
  });

  return { ok: true as const, confirmation };
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
  requiredPaths?: readonly string[],
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
    confirmationStatus: getDijieRolePackageDraftConfirmationStatus(record, requiredPaths),
    capabilityReport: record.capability_report,
    qualityReport: record.quality_report,
    uploadValidationIssues: record.upload_validation_issues,
    blockingIssues: record.blocking_issues,
    modelUsage: record.model_usage,
    submittedPackageId: record.submitted_package_id,
  };
}

export function createDijieRolePackageDraftDetailReadModel(
  record: DijieRolePackageDraftStorageRecord & { id?: string },
  requiredPaths?: readonly string[],
) {
  const confirmations = normalizeFileConfirmations(record.file_confirmations);
  const files = record.package_files.map((file) => {
    const digest = fileSha256(file);
    const confirmation = confirmations[file.path];
    const confirmed = Boolean(digest && confirmation?.sha256 === digest);
    return {
      path: file.path,
      content: file.content ?? "",
      ...(digest ? { sha256: digest } : {}),
      ...(file.sizeBytes !== undefined
        ? { sizeBytes: file.sizeBytes }
        : typeof file.content === "string"
          ? { sizeBytes: Buffer.byteLength(file.content) }
          : {}),
      confirmed,
      confirmedAt: confirmed ? confirmation.confirmed_at : null,
      confirmedBy: confirmed ? confirmation.confirmed_by : null,
    };
  });

  return {
    ...createDijieRolePackageDraftReadModel(record, requiredPaths),
    files,
    confirmationStatus: getDijieRolePackageDraftConfirmationStatus(record, requiredPaths),
  };
}
