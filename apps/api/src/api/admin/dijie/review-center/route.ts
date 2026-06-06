import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  canReviewDijieRoles,
} from "../../../../lib/dijie/data-permissions";
import { getDijieReviewCenterReadModel } from "../../../../lib/dijie/role-review-center";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

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
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });
  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取审核中心需要登录平台审核账号。",
    });
  }
  if (!canReviewDijieRoles(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有岗位审核数据权限。",
    });
  }
  const adminAccountId = actorIdFromRequest(req);

  try {
    const query = req.scope.resolve("query");
    const reviewCenter = await getDijieReviewCenterReadModel((queryInput) =>
      query.graph(queryInput),
      { adminAccountId },
    );

    return res.status(200).json({
      ok: true,
      reviewCenter,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI审核中心暂时无法读取岗位审核数据。",
    });
  }
}
