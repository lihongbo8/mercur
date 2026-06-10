import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import { resolveDijieAccountAccessProfileReader as resolveDijieAccountAccessProfileReaderAdapter } from "../../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function resolveAccountAccessProfileReader(
  req: MedusaRequest,
): DijieAccountAccessProfileReader | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return resolveDijieAccountAccessProfileReaderAdapter(service);
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });

  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取账号权限需要先登录迭界AI账号。",
    });
  }

  return res.status(200).json({
    ok: true,
    access: {
      accountId: access.accountId,
      billingAccountId: access.billingAccountId,
      accountLevel: access.accountLevel,
      localSystemAccess: access.localSystemAccess,
      dataScopes: access.dataScopes,
      marketplaceOwnerAccess: access.marketplaceOwnerAccess,
    },
  });
}
