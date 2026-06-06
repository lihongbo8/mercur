import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../lib/dijie/access-context";
import {
  canManageDijieLocalAccounts,
  createDijieAccountAccessProfileReadModel,
  type DijieAccountAccessProfileReader,
} from "../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";

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
      .retrieveDijieAccountAccessProfile === "function" &&
    typeof (value as { listDijieAccountAccessProfiles?: unknown })
      .listDijieAccountAccessProfiles === "function"
  );
}

function resolveAccountAccessProfileReader(
  req: MedusaRequest,
): DijieAccountAccessProfileReader | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isAccountAccessProfileReader(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reader = resolveAccountAccessProfileReader(req);
  if (!reader) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI本地账号权限存储暂未配置。",
    });
  }

  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: reader,
  });
  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取本地账号权限列表需要先登录管理账号。",
    });
  }
  if (!canManageDijieLocalAccounts(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有读取本地账号权限列表的权限。",
    });
  }

  const profiles = await reader.listDijieAccountAccessProfiles({ take: 200 });

  return res.status(200).json({
    ok: true,
    profiles: profiles.map(createDijieAccountAccessProfileReadModel),
  });
}
