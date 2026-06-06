import type { DijieAccessContext, DijieAccountLevel } from "./data-permissions";

export type DijieAccountAccessProfileStorageRecord = {
  account_id: string;
  account_level: DijieAccountLevel;
  local_system_access: boolean;
  data_scopes: string[];
  configured_by: string | null;
  configured_at: Date;
};

export type DijieAccountAccessProfileRepository = {
  createDijieAccountAccessProfiles: (
    data: DijieAccountAccessProfileStorageRecord,
  ) => Promise<DijieAccountAccessProfileStorageRecord & { id: string }>;
};

export type DijieAccountAccessProfileLookupRepository = {
  listDijieAccountAccessProfiles: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieAccountAccessProfileStorageRecord & { id: string }>>;
};

export type DijieAccountAccessProfileUpdateRepository = {
  updateDijieAccountAccessProfiles: (
    data: Partial<DijieAccountAccessProfileStorageRecord> & { id: string },
  ) => Promise<DijieAccountAccessProfileStorageRecord & { id: string }>;
};

export type DijieAccountAccessProfileReader = {
  retrieveDijieAccountAccessProfile: (input: {
    accountId: string;
  }) => Promise<(DijieAccountAccessProfileStorageRecord & { id: string }) | undefined>;
  listDijieAccountAccessProfiles: (input?: {
    take?: number;
  }) => Promise<Array<DijieAccountAccessProfileStorageRecord & { id: string }>>;
};

export type DijieAccountAccessProfileStore = DijieAccountAccessProfileReader & {
  upsertDijieAccountAccessProfile: (
    input: UpsertDijieAccountAccessProfileInput,
  ) => Promise<DijieAccountAccessProfileMutationResult>;
};

export type UpsertDijieAccountAccessProfileInput = {
  accountId: string;
  accountLevel: unknown;
  localSystemAccess: unknown;
  dataScopes?: unknown;
  configuredBy?: string;
};

export type DijieAccountAccessProfileMutationResult =
  | {
      ok: true;
      value: {
        profile: DijieAccountAccessProfileStorageRecord & { id: string };
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

const ACCOUNT_LEVELS = new Set<DijieAccountLevel>([
  "super_admin",
  "admin",
  "operator",
  "viewer",
  "member",
]);

const LOCAL_SCOPE_PATTERN =
  /^(?:\*|role:[A-Za-z0-9_-]+|package:[A-Za-z0-9_-]+|developer:[A-Za-z0-9_-]+|execution:[A-Za-z0-9_-]+|entitlement:[A-Za-z0-9_-]+)$/u;

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeAccountLevel(value: unknown): DijieAccountLevel | undefined {
  const level = nonEmptyString(value);
  return level && ACCOUNT_LEVELS.has(level as DijieAccountLevel)
    ? (level as DijieAccountLevel)
    : undefined;
}

function normalizeDataScopes(value: unknown): string[] | undefined {
  const scopes = stringArray(value);
  for (const scope of scopes) {
    if (
      scope.startsWith("review:") ||
      scope.startsWith("marketplace:review:") ||
      !LOCAL_SCOPE_PATTERN.test(scope)
    ) {
      return undefined;
    }
  }
  return scopes;
}

export function canManageDijieLocalAccounts(context: DijieAccessContext): boolean {
  return (
    context.localSystemAccess &&
    (context.accountLevel === "super_admin" || context.accountLevel === "admin")
  );
}

export function createDijieAccountAccessProfileRecord(input: {
  accountId: string;
  accountLevel: DijieAccountLevel;
  localSystemAccess: boolean;
  dataScopes?: string[];
  configuredBy?: string;
  configuredAt?: Date;
}): DijieAccountAccessProfileStorageRecord {
  return {
    account_id: input.accountId,
    account_level: input.accountLevel,
    local_system_access: input.localSystemAccess,
    data_scopes: input.dataScopes ?? [],
    configured_by: input.configuredBy?.trim() || null,
    configured_at: input.configuredAt ?? new Date(),
  };
}

export function createDijieAccountAccessProfileReadModel(
  profile: DijieAccountAccessProfileStorageRecord & { id?: string },
) {
  return {
    id: profile.id,
    accountId: profile.account_id,
    accountLevel: profile.account_level,
    localSystemAccess: profile.local_system_access,
    dataScopes: profile.data_scopes,
    configuredBy: profile.configured_by,
    configuredAt: profile.configured_at instanceof Date
      ? profile.configured_at.toISOString()
      : profile.configured_at,
  };
}

export async function retrieveDijieAccountAccessProfileWithRepository(
  repository: DijieAccountAccessProfileLookupRepository,
  input: {
    accountId: string;
  },
): Promise<(DijieAccountAccessProfileStorageRecord & { id: string }) | undefined> {
  const accountId = input.accountId.trim();
  if (!accountId) {
    return undefined;
  }
  const [profile] = await repository.listDijieAccountAccessProfiles(
    { account_id: accountId },
    {
      take: 1,
      order: { configured_at: "DESC" },
    },
  );
  return profile;
}

export async function listDijieAccountAccessProfilesWithRepository(
  repository: DijieAccountAccessProfileLookupRepository,
  input?: {
    take?: number;
  },
): Promise<Array<DijieAccountAccessProfileStorageRecord & { id: string }>> {
  return repository.listDijieAccountAccessProfiles(
    {},
    {
      take: input?.take ?? 100,
      order: { configured_at: "DESC" },
    },
  );
}

export async function upsertDijieAccountAccessProfileWithRepository(
  repository: DijieAccountAccessProfileRepository &
    DijieAccountAccessProfileLookupRepository &
    DijieAccountAccessProfileUpdateRepository,
  input: UpsertDijieAccountAccessProfileInput,
): Promise<DijieAccountAccessProfileMutationResult> {
  const accountId = nonEmptyString(input.accountId);
  if (!accountId) {
    return { ok: false, status: 400, error: "账号编号不能为空。" };
  }

  const accountLevel = normalizeAccountLevel(input.accountLevel);
  if (!accountLevel) {
    return { ok: false, status: 400, error: "账号等级不合法。" };
  }

  if (typeof input.localSystemAccess !== "boolean") {
    return { ok: false, status: 400, error: "本地主系统权限必须是布尔值。" };
  }

  const dataScopes = normalizeDataScopes(input.dataScopes);
  if (!dataScopes) {
    return {
      ok: false,
      status: 400,
      error: "本地账号数据权限只能包含 role/package/developer/execution/entitlement 范围。",
    };
  }

  const existing = await retrieveDijieAccountAccessProfileWithRepository(repository, {
    accountId,
  });
  const record = createDijieAccountAccessProfileRecord({
    accountId,
    accountLevel,
    localSystemAccess: input.localSystemAccess,
    dataScopes,
    configuredBy: input.configuredBy,
  });

  const profile = existing
    ? await repository.updateDijieAccountAccessProfiles({
        id: existing.id,
        ...record,
      })
    : await repository.createDijieAccountAccessProfiles(record);

  return {
    ok: true,
    value: { profile },
  };
}
