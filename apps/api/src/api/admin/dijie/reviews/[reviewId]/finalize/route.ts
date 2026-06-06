import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import {
  canReviewDijieRoles,
} from "../../../../../../lib/dijie/data-permissions";
import type {
  DijieRoleReviewFinalResult,
  DijieRoleReviewStore,
} from "../../../../../../lib/dijie/role-review-store";

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

function finalResult(value: unknown): DijieRoleReviewFinalResult | undefined {
  return value === "approved" || value === "needs_changes" || value === "rejected"
    ? value
    : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function roleListingIdFromReviewId(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const reviewId = value.trim();
  return reviewId.startsWith("review_") ? reviewId.slice("review_".length) : reviewId;
}

function isRoleReviewStore(value: unknown): value is DijieRoleReviewStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { finalizeDijieRoleReview?: unknown }).finalizeDijieRoleReview ===
      "function"
  );
}

function resolveRoleReviewStore(req: MedusaRequest): DijieRoleReviewStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRoleReviewStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
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

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reviewerId = actorIdFromRequest(req);
  if (!reviewerId) {
    return res.status(401).json({
      ok: false,
      error: "完成审核需要平台审核账号登录。",
    });
  }

  const roleListingId = roleListingIdFromReviewId(req.params?.reviewId);
  if (!roleListingId) {
    return res.status(400).json({
      ok: false,
      error: "审核单编号不能为空。",
    });
  }
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });
  if (!access || !canReviewDijieRoles(access, roleListingId)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有该岗位审核数据权限。",
    });
  }

  const store = resolveRoleReviewStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI审核存储暂未配置。",
    });
  }

  const body = asRecord(req.body);
  const result = finalResult(body.finalResult ?? body.final_result);
  if (!result) {
    return res.status(400).json({
      ok: false,
      error: "最终审核动作必须是 approved、needs_changes 或 rejected。",
    });
  }

  try {
    const saved = await store.finalizeDijieRoleReview({
      roleListingId,
      reviewerId,
      finalResult: result,
      summary: nullableStringField(body, "summary"),
    });

    if (!saved.ok) {
      return res.status(saved.status).json({
        ok: false,
        error: saved.error,
      });
    }

    return res.status(200).json({
      ok: true,
      reviewId: saved.value.reviewId,
      roleListingId: saved.value.roleListingId,
      review: saved.value.review,
      listing: saved.value.listing,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "最终审核动作保存失败。",
    });
  }
}
