import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../../lib/dijie/access-context";
import {
  canManageDijieLocalAccounts,
  createDijieAccountAccessProfileReadModel,
  type DijieAccountAccessProfileStore,
} from "../../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function actorIdFromAuthContext(authContext: UnknownRecord | undefined): string | undefined {
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function isAccountAccessProfileStore(value: unknown): value is DijieAccountAccessProfileStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieAccountAccessProfile?: unknown })
      .retrieveDijieAccountAccessProfile === "function" &&
    typeof (value as { upsertDijieAccountAccessProfile?: unknown })
      .upsertDijieAccountAccessProfile === "function"
  );
}

function resolveAccountAccessProfileStore(
  req: MedusaRequest,
): DijieAccountAccessProfileStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isAccountAccessProfileStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const targetAccountId = req.params?.accountId;
  if (typeof targetAccountId !== "string" || !targetAccountId.trim()) {
    return res.status(400).json({
      ok: false,
      error: "被配置账号不能为空。",
    });
  }

  const store = resolveAccountAccessProfileStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI本地账号权限存储暂未配置。",
    });
  }

  const authContext = authContextFromRequest(req);
  const actorId = actorIdFromAuthContext(authContext);
  const access = await resolveDijieAccessContext({
    authContext,
    profileReader: store,
  });
  if (!actorId || !access) {
    return res.status(401).json({
      ok: false,
      error: "配置本地账号权限需要先登录管理账号。",
    });
  }

  if (!canManageDijieLocalAccounts(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有配置本地账号权限的权限。",
    });
  }

  const body = asRecord(req.body);
  const result = await store.upsertDijieAccountAccessProfile({
    accountId: targetAccountId,
    accountLevel: body.accountLevel ?? body.account_level,
    localSystemAccess: body.localSystemAccess ?? body.local_system_access,
    dataScopes: body.dataScopes ?? body.data_scopes,
    configuredBy: actorId,
  });

  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      error: result.error,
    });
  }

  return res.status(200).json({
    ok: true,
    profile: createDijieAccountAccessProfileReadModel(result.value.profile),
  });
}
