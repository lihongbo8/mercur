import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  canAccessDijieDialogSessionData,
  canUseDijieLocalSystem,
  hasDijieGlobalDataAccess,
} from "../../../../lib/dijie/data-permissions";
import {
  createDijieDialogSessionReadModel,
  type DijieDialogSessionReader,
} from "../../../../lib/dijie/dialog-session-store";
import type { DijieDialogSurface } from "../../../../lib/dijie/dialog-context";

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

function surfaceFromQuery(req: MedusaRequest): DijieDialogSurface | undefined {
  const surface = stringField(asRecord((req as MedusaRequest & { query?: unknown }).query), "surface");
  return surface === "buyer_storefront" ||
    surface === "user_center" ||
    surface === "developer_center" ||
    surface === "admin_review" ||
    surface === "openclaw_local"
    ? surface
    : undefined;
}

function isAccountAccessProfileReader(
  value: unknown,
): value is DijieAccountAccessProfileReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieAccountAccessProfile?: unknown })
      .retrieveDijieAccountAccessProfile === "function"
  );
}

function isDialogSessionReader(value: unknown): value is DijieDialogSessionReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { listDijieDialogSessionsForAccount?: unknown })
      .listDijieDialogSessionsForAccount === "function"
  );
}

function resolveDijieService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = resolveDijieService(req);
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: isAccountAccessProfileReader(service) ? service : undefined,
  });
  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取对话会话需要先登录迭界AI账号。",
    });
  }
  if (!isDialogSessionReader(service)) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI对话会话存储暂未配置。",
    });
  }

  const query = asRecord((req as MedusaRequest & { query?: unknown }).query);
  const requestedAccountId = stringField(query, "accountId") ?? stringField(query, "account_id");
  const scopedRead =
    hasDijieGlobalDataAccess(access) ||
    (canUseDijieLocalSystem(access) && access.dataScopes.length > 0);
  const accountId = scopedRead
    ? requestedAccountId
    : access.accountId;
  const sessions = await service.listDijieDialogSessionsForAccount({
    accountId,
    surface: surfaceFromQuery(req),
    take: scopedRead ? 200 : 50,
  });

  return res.status(200).json({
    ok: true,
    sessions: sessions
      .filter((session) => canAccessDijieDialogSessionData(access, session))
      .map(createDijieDialogSessionReadModel),
  });
}
