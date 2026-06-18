import type {
  DijieRolePackageUploadFile,
  DijieRolePackageUploadSummary,
} from "./role-package-upload";

export type DijieRolePackageStoredFile = {
  path: string;
  content?: string;
  sha256?: string;
  sizeBytes?: number;
};

export type DijieRolePackageStorageRecord = {
  package_id: string;
  package_version: string;
  owner_id: string | null;
  uploaded_at: Date;
  manifest_summary: DijieRolePackageUploadSummary["manifestSummary"];
  file_manifest: DijieRolePackageUploadSummary["files"];
  package_files: DijieRolePackageStoredFile[];
  validation_issues: string[] | null;
};

export type DijieRolePackageRepository = {
  createDijieRolePackages: (
    data: DijieRolePackageStorageRecord,
  ) => Promise<{ id?: string }>;
};

export type DijieRolePackageLookupRepository = {
  listDijieRolePackages: (
    filters?: {
      package_id?: string;
      package_version?: string;
      owner_id?: string;
    },
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieRolePackageStorageRecord & { id?: string }>>;
};

export type DijieRolePackageStore = {
  storeDijieRolePackage: (input: {
    summary: DijieRolePackageUploadSummary;
    files: DijieRolePackageUploadFile[];
    ownerId?: string;
  }) => Promise<{
    rolePackageId?: string;
    packageId: string;
    packageVersion: string;
  }>;
};

export type DijieRolePackageReader = {
  retrieveDijieRolePackage: (input: {
    packageId: string;
    packageVersion?: string;
  }) => Promise<(DijieRolePackageStorageRecord & { id?: string }) | undefined>;
  listDijieRolePackages: (input?: {
    ownerId?: string;
    take?: number;
  }) => Promise<Array<DijieRolePackageStorageRecord & { id?: string }>>;
};

function storedFiles(files: DijieRolePackageUploadFile[]): DijieRolePackageStoredFile[] {
  return files.map((file) => ({
    path: file.path,
    ...(file.content !== undefined ? { content: file.content } : {}),
    ...(file.sha256 ? { sha256: file.sha256 } : {}),
    ...(file.sizeBytes !== undefined ? { sizeBytes: file.sizeBytes } : {}),
  }));
}

export function createDijieRolePackageStorageRecord(input: {
  summary: DijieRolePackageUploadSummary;
  files: DijieRolePackageUploadFile[];
  ownerId?: string;
  uploadedAt?: Date;
}): DijieRolePackageStorageRecord {
  return {
    package_id: input.summary.packageId,
    package_version: input.summary.packageVersion,
    owner_id: input.ownerId?.trim() || null,
    uploaded_at: input.uploadedAt ?? new Date(),
    manifest_summary: input.summary.manifestSummary,
    file_manifest: input.summary.files,
    package_files: storedFiles(input.files),
    validation_issues: null,
  };
}

export async function storeDijieRolePackageWithRepository(
  repository: DijieRolePackageRepository,
  input: {
    summary: DijieRolePackageUploadSummary;
    files: DijieRolePackageUploadFile[];
    ownerId?: string;
  },
): Promise<{
  rolePackageId?: string;
  packageId: string;
  packageVersion: string;
}> {
  const stored = await repository.createDijieRolePackages(
    createDijieRolePackageStorageRecord(input),
  );

  return {
    rolePackageId: stored.id,
    packageId: input.summary.packageId,
    packageVersion: input.summary.packageVersion,
  };
}

export async function retrieveDijieRolePackageWithRepository(
  repository: DijieRolePackageLookupRepository,
  input: {
    packageId: string;
    packageVersion?: string;
  },
): Promise<(DijieRolePackageStorageRecord & { id?: string }) | undefined> {
  const [record] = await repository.listDijieRolePackages(
    {
      package_id: input.packageId,
      ...(input.packageVersion ? { package_version: input.packageVersion } : {}),
    },
    {
      take: 1,
      order: { uploaded_at: "DESC" },
    },
  );

  return record;
}

export async function listDijieRolePackagesWithRepository(
  repository: DijieRolePackageLookupRepository,
  input: {
    ownerId?: string;
    take?: number;
  } = {},
): Promise<Array<DijieRolePackageStorageRecord & { id?: string }>> {
  return repository.listDijieRolePackages(
    {
      ...(input.ownerId ? { owner_id: input.ownerId } : {}),
    },
    {
      take: input.take ?? 100,
      order: { uploaded_at: "DESC" },
    },
  );
}

export function createDijieRolePackageSummaryReadModel(
  record: DijieRolePackageStorageRecord & { id?: string },
) {
  const uploadedAt = record.uploaded_at instanceof Date
    ? record.uploaded_at.toISOString()
    : record.uploaded_at;
  const downloadUrl = `/vendor/dijie/role-packages/${encodeURIComponent(
    record.package_id,
  )}/download?version=${encodeURIComponent(record.package_version)}`;

  return {
    rolePackageId: record.id,
    packageId: record.package_id,
    packageVersion: record.package_version,
    ownerId: record.owner_id,
    uploadedAt,
    manifestSummary: record.manifest_summary,
    fileCount: record.file_manifest.length,
    validationIssues: record.validation_issues ?? [],
    download: {
      available: true,
      url: downloadUrl,
    },
  };
}

export function createDijieRolePackageDownloadReadModel(
  record: DijieRolePackageStorageRecord & { id?: string },
) {
  return {
    rolePackageId: record.id,
    packageId: record.package_id,
    packageVersion: record.package_version,
    uploadedAt: record.uploaded_at instanceof Date
      ? record.uploaded_at.toISOString()
      : record.uploaded_at,
    manifestSummary: record.manifest_summary,
    files: record.package_files,
  };
}
