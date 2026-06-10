import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  createDijieCatalogReviewRequestReadModel,
} from "../../../../lib/dijie/catalog-store";
import { canReviewDijieRoles } from "../../../../lib/dijie/data-permissions";
import {
  resolveDijieAccountAccessProfileReader,
  resolveDijieCatalogReader,
} from "../../../../lib/dijie/service-reader-adapters";

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

function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

function reviewStatus(value: unknown) {
  return value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "request_changes"
    ? value
    : undefined;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auditService = resolveAuditService(req);
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveDijieAccountAccessProfileReader(auditService),
  });
  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取 Skill/Tool 入库审核需要平台审核账号登录。",
    });
  }
  if (!canReviewDijieRoles(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有 Skill/Tool 入库审核权限。",
    });
  }
  const catalogReader = resolveDijieCatalogReader(auditService);
  if (!catalogReader) {
    return res.status(503).json({
      ok: false,
      error: "Skill/Tool 目录审核存储暂未配置。",
    });
  }

  const query = asRecord((req as MedusaRequest & { query?: unknown }).query);
  const status = reviewStatus(stringField(query, "status"));
  const [catalogItems, reviewRequests] = await Promise.all([
    catalogReader.listDijieEffectiveCatalogItems(),
    catalogReader.listDijieCatalogReviewRequests({ status }),
  ]);

  return res.status(200).json({
    ok: true,
    catalogItems,
    reviewRequests: reviewRequests.map((request) => ({
      ...request,
      ...createDijieCatalogReviewRequestReadModel(request),
    })),
  });
}
