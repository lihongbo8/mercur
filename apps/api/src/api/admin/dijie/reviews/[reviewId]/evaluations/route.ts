import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import {
  canReviewDijieRoles,
} from "../../../../../../lib/dijie/data-permissions";
import type {
  DijieRoleReviewDecision,
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

function reviewDecision(value: unknown): DijieRoleReviewDecision | undefined {
  return value === "pending" ||
    value === "pass" ||
    value === "needs_changes" ||
    value === "reject"
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
    typeof (value as { saveDijieRoleReviewEvaluations?: unknown })
      .saveDijieRoleReviewEvaluations === "function"
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
      error: "保存审核评估需要平台审核账号登录。",
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
  try {
    const result = await store.saveDijieRoleReviewEvaluations({
      roleListingId,
      reviewerId,
      roleStandardDecision: reviewDecision(
        body.roleStandardDecision ?? body.role_standard_decision,
      ),
      safetyComplianceDecision: reviewDecision(
        body.safetyComplianceDecision ?? body.safety_compliance_decision,
      ),
      pricingReasonabilityDecision: reviewDecision(
        body.pricingReasonabilityDecision ?? body.pricing_reasonability_decision,
      ),
      summary: nullableStringField(body, "summary"),
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      reviewId: result.value.reviewId,
      roleListingId: result.value.roleListingId,
      review: result.value.review,
      listing: result.value.listing,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "审核评估保存失败。",
    });
  }
}
