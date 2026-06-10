import type {
  DijieAccountAccessProfileReader,
  DijieAccountAccessProfileStore,
} from "./account-access-store";
import type { DijieCatalogReader } from "./catalog-store";
import type { DijieRoleListingReader } from "./role-listing-store";
import type {
  DijieRolePackageDraftReader,
  DijieRolePackageDraftStore,
} from "./role-package-draft-store";
import type { DijieRolePackageReader } from "./role-package-store";

type Method = (...args: never[]) => unknown;
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function bindMethod<T extends Method>(value: unknown, name: string): T | undefined {
  const method = asRecord(value)[name];
  return typeof method === "function" ? (method.bind(value) as T) : undefined;
}

export function resolveDijieRolePackageReader(
  value: unknown,
): DijieRolePackageReader | undefined {
  const retrieve =
    bindMethod<DijieRolePackageReader["retrieveDijieRolePackage"]>(
      value,
      "retrieveDijieRolePackageRecord",
    ) ??
    bindMethod<DijieRolePackageReader["retrieveDijieRolePackage"]>(
      value,
      "retrieveDijieRolePackage",
    );
  const list =
    bindMethod<DijieRolePackageReader["listDijieRolePackages"]>(
      value,
      "listDijieRolePackageRecords",
    ) ??
    bindMethod<DijieRolePackageReader["listDijieRolePackages"]>(
      value,
      "listDijieRolePackages",
    );
  return retrieve || list
    ? {
        retrieveDijieRolePackage: retrieve ?? (async () => undefined),
        listDijieRolePackages: list ?? (async () => []),
      }
    : undefined;
}

export function resolveDijieRolePackageDraftReader(
  value: unknown,
): DijieRolePackageDraftReader | undefined {
  const retrieveLatest = bindMethod<
    DijieRolePackageDraftReader["retrieveLatestDijieRolePackageDraft"]
  >(value, "retrieveLatestDijieRolePackageDraft");
  const retrieveRecord = bindMethod<
    DijieRolePackageDraftReader["retrieveDijieRolePackageDraft"]
  >(value, "retrieveDijieRolePackageDraftRecord");
  if (retrieveLatest && retrieveRecord) {
    return {
      retrieveLatestDijieRolePackageDraft: retrieveLatest,
      retrieveDijieRolePackageDraft: retrieveRecord,
    };
  }

  const retrieveLegacy = bindMethod<
    DijieRolePackageDraftReader["retrieveDijieRolePackageDraft"]
  >(value, "retrieveDijieRolePackageDraft");
  return retrieveLatest && retrieveLegacy
    ? {
        retrieveLatestDijieRolePackageDraft: retrieveLatest,
        retrieveDijieRolePackageDraft: retrieveLegacy,
      }
    : undefined;
}

export function resolveDijieRolePackageDraftStore(
  value: unknown,
): (DijieRolePackageDraftStore & DijieRolePackageDraftReader) | undefined {
  const reader = resolveDijieRolePackageDraftReader(value);
  const createDraft = bindMethod<DijieRolePackageDraftStore["createDijieRolePackageDraft"]>(
    value,
    "createDijieRolePackageDraft",
  );
  const updateDraft = bindMethod<DijieRolePackageDraftStore["updateDijieRolePackageDraft"]>(
    value,
    "updateDijieRolePackageDraft",
  );
  const markSubmitted = bindMethod<
    DijieRolePackageDraftStore["markDijieRolePackageDraftSubmitted"]
  >(value, "markDijieRolePackageDraftSubmitted");
  return reader && createDraft && updateDraft
    ? {
        ...reader,
        createDijieRolePackageDraft: createDraft,
        updateDijieRolePackageDraft: updateDraft,
        markDijieRolePackageDraftSubmitted:
          markSubmitted ??
          (async () => ({
            ok: false as const,
            status: 503,
            error: "迭界AI岗位包草稿提交存储暂未配置。",
          })),
      }
    : undefined;
}

export function resolveDijieRoleListingReader(
  value: unknown,
): DijieRoleListingReader | undefined {
  const listStored = bindMethod<DijieRoleListingReader["listDijieStoredRoleListings"]>(
    value,
    "listDijieStoredRoleListings",
  );
  const retrieve =
    bindMethod<DijieRoleListingReader["retrieveDijieRoleListing"]>(
      value,
      "retrieveDijieRoleListingRecord",
    ) ??
    bindMethod<DijieRoleListingReader["retrieveDijieRoleListing"]>(
      value,
      "retrieveDijieRoleListing",
    );
  return listStored || retrieve
    ? {
        listDijieStoredRoleListings: listStored ?? (async () => []),
        retrieveDijieRoleListing: retrieve ?? (async () => undefined),
      }
    : undefined;
}

export function resolveDijieAccountAccessProfileReader(
  value: unknown,
): DijieAccountAccessProfileReader | undefined {
  const retrieve =
    bindMethod<DijieAccountAccessProfileReader["retrieveDijieAccountAccessProfile"]>(
      value,
      "retrieveDijieAccountAccessProfileRecord",
    ) ??
    bindMethod<DijieAccountAccessProfileReader["retrieveDijieAccountAccessProfile"]>(
      value,
      "retrieveDijieAccountAccessProfile",
    );
  const list =
    bindMethod<DijieAccountAccessProfileReader["listDijieAccountAccessProfiles"]>(
      value,
      "listDijieAccountAccessProfileRecords",
    ) ??
    bindMethod<DijieAccountAccessProfileReader["listDijieAccountAccessProfiles"]>(
      value,
      "listDijieAccountAccessProfiles",
    );
  return retrieve || list
    ? {
        retrieveDijieAccountAccessProfile: retrieve ?? (async () => undefined),
        listDijieAccountAccessProfiles: list ?? (async () => []),
      }
    : undefined;
}

export function resolveDijieAccountAccessProfileStore(
  value: unknown,
): DijieAccountAccessProfileStore | undefined {
  const reader = resolveDijieAccountAccessProfileReader(value);
  const upsert = bindMethod<
    DijieAccountAccessProfileStore["upsertDijieAccountAccessProfile"]
  >(value, "upsertDijieAccountAccessProfile");
  return reader && upsert
    ? {
        ...reader,
        upsertDijieAccountAccessProfile: upsert,
      }
    : undefined;
}

export function resolveDijieCatalogReader(value: unknown): DijieCatalogReader | undefined {
  const listItems = bindMethod<DijieCatalogReader["listDijieEffectiveCatalogItems"]>(
    value,
    "listDijieEffectiveCatalogItems",
  );
  const listRecordRequests = bindMethod<
    DijieCatalogReader["listDijieCatalogReviewRequests"]
  >(value, "listDijieCatalogReviewRequestRecords");
  if (listItems && listRecordRequests) {
    return {
      listDijieEffectiveCatalogItems: listItems,
      listDijieCatalogReviewRequests: listRecordRequests,
    };
  }

  const listLegacyRequests = bindMethod<
    DijieCatalogReader["listDijieCatalogReviewRequests"]
  >(value, "listDijieCatalogReviewRequests");
  return listItems
    ? {
        listDijieEffectiveCatalogItems: listItems,
        listDijieCatalogReviewRequests: listLegacyRequests ?? (async () => []),
    }
    : undefined;
}

export function resolveDijieCatalogReviewRequestReader(
  value: unknown,
): Pick<DijieCatalogReader, "listDijieCatalogReviewRequests"> | undefined {
  const listRecordRequests = bindMethod<
    DijieCatalogReader["listDijieCatalogReviewRequests"]
  >(value, "listDijieCatalogReviewRequestRecords");
  if (listRecordRequests) {
    return { listDijieCatalogReviewRequests: listRecordRequests };
  }

  const listLegacyRequests = bindMethod<
    DijieCatalogReader["listDijieCatalogReviewRequests"]
  >(value, "listDijieCatalogReviewRequests");
  return listLegacyRequests
    ? { listDijieCatalogReviewRequests: listLegacyRequests }
    : undefined;
}
