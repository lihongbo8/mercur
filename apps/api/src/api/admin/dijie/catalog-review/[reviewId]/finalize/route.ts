import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../../lib/dijie/access-context";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import type { DijieCatalogReviewStore } from "../../../../../../lib/dijie/catalog-store";
import { canReviewDijieRoles } from "../../../../../../lib/dijie/data-permissions";
import { resolveDijieAccountAccessProfileReader } from "../../../../../../lib/dijie/service-reader-adapters";

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

function nullableStringField(record: UnknownRecord, field: string): string | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return stringField(record, field);
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function reviewResult(value: unknown): "approved" | "rejected" | "request_changes" | undefined {
  return value === "approved" || value === "rejected" || value === "request_changes"
    ? value
    : undefined;
}

function isCatalogReviewStore(value: unknown): value is DijieCatalogReviewStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { finalizeDijieCatalogReviewRequest?: unknown })
      .finalizeDijieCatalogReviewRequest === "function"
  );
}

function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reviewerId = actorIdFromRequest(req);
  if (!reviewerId) {
    return res.status(401).json({
      ok: false,
      error: "完成能力目录审核需要平台审核账号登录。",
    });
  }

  const reviewId = stringField(asRecord(req.params), "reviewId");
  if (!reviewId) {
    return res.status(400).json({
      ok: false,
      error: "能力目录审核单编号不能为空。",
    });
  }

  const auditService = resolveAuditService(req);
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveDijieAccountAccessProfileReader(auditService),
  });
  if (!access || !canReviewDijieRoles(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有能力目录审核权限。",
    });
  }
  if (!isCatalogReviewStore(auditService)) {
    return res.status(503).json({
      ok: false,
      error: "能力目录审核存储暂未配置。",
    });
  }

  const body = asRecord(req.body);
  const result = reviewResult(body.result ?? body.finalResult ?? body.final_result);
  if (!result) {
    return res.status(400).json({
      ok: false,
      error: "入库审核动作必须是 approved、rejected 或 request_changes。",
    });
  }

  const saved = await auditService.finalizeDijieCatalogReviewRequest({
    reviewId,
    result,
    reviewedBy: reviewerId,
    reviewNote: nullableStringField(body, "reviewNote") ?? nullableStringField(body, "review_note"),
  });
  if (!saved.ok) {
    return res.status(saved.status).json({
      ok: false,
      error: saved.error,
    });
  }

  return res.status(200).json({
    ok: true,
    reviewId,
    result,
  });
}
