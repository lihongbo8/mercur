import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
import {
  canAccessDijieDialogSessionData,
  canUseDijieLocalSystem,
  hasDijieGlobalDataAccess,
} from "../../../../../lib/dijie/data-permissions";
import {
  createDijieDialogMessageReadModel,
  createDijieDialogSessionReadModel,
  type DijieDialogSessionReader,
} from "../../../../../lib/dijie/dialog-session-store";

type UnknownRecord = Record<string, unknown>;

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
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
    typeof (value as { retrieveDijieDialogSessionWithMessages?: unknown })
      .retrieveDijieDialogSessionWithMessages === "function"
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
  const sessionId = req.params?.sessionId?.trim();
  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      error: "读取对话会话需要会话编号。",
    });
  }

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

  const scopedRead =
    hasDijieGlobalDataAccess(access) ||
    (canUseDijieLocalSystem(access) && access.dataScopes.length > 0);
  const result = await service.retrieveDijieDialogSessionWithMessages({
    sessionId,
    accountId: scopedRead ? undefined : access.accountId,
  });
  if (!result || !canAccessDijieDialogSessionData(access, result.session)) {
    return res.status(404).json({
      ok: false,
      error: "未找到当前账号可访问的对话会话。",
    });
  }

  return res.status(200).json({
    ok: true,
    session: createDijieDialogSessionReadModel(result.session),
    messages: result.messages.map(createDijieDialogMessageReadModel),
  });
}
