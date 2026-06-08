import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { getDijieVendorReceivablesReadModel } from "../../../../lib/dijie/role-receivables";
import {
  createDijieRoleListingManagementReadModel,
  type DijieRoleListingReader,
} from "../../../../lib/dijie/role-listing-store";
import {
  createDijieRolePackageDraftReadModel,
  type DijieRolePackageDraftReader,
} from "../../../../lib/dijie/role-package-draft-store";

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

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = asRecord(
    (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context,
  );
  return stringField(authContext, "actor_id");
}

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = asRecord(
    (req as MedusaRequest & { seller_context?: UnknownRecord }).seller_context,
  );
  return stringField(sellerContext, "seller_id");
}

function resolveService(req: MedusaRequest) {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as Partial<
      DijieRoleListingReader & DijieRolePackageDraftReader
    >;
  } catch {
    return {};
  }
}

function countBy<T extends Record<string, unknown>>(records: T[], field: keyof T) {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = String(record[field] ?? "unknown");
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "读取开发者中心需要登录开发者账号并选择开发者店铺。",
    });
  }

  const service = resolveService(req);
  if (typeof service.listDijieStoredRoleListings !== "function") {
    return res.status(503).json({
      ok: false,
      error: "开发者中心岗位商品读模型暂不可用。",
    });
  }

  const query = req.scope.resolve("query");
  const [listings, latestDraftResult, receivablesResult] = await Promise.all([
    service.listDijieStoredRoleListings({
      developerRef: sellerId,
      take: 100,
    }),
    typeof service.retrieveLatestDijieRolePackageDraft === "function"
      ? service.retrieveLatestDijieRolePackageDraft({ ownerId: actorId })
          .then((draft) => ({ ok: true as const, draft }))
          .catch(() => ({ ok: false as const }))
      : Promise.resolve(undefined),
    getDijieVendorReceivablesReadModel({
      sellerId,
      queryGraph: (queryInput) => query.graph(queryInput),
    })
      .then((receivables) => ({ ok: true as const, receivables }))
      .catch(() => ({ ok: false as const })),
  ]);

  const listingReadModels = listings.map(createDijieRoleListingManagementReadModel);
  const latestDraft = latestDraftResult?.ok ? latestDraftResult.draft : null;
  const receivables = receivablesResult.ok ? receivablesResult.receivables : null;

  return res.status(200).json({
    ok: true,
    dashboard: {
      actorId,
      sellerId,
      listings: {
        total: listings.length,
        byListingStatus: countBy(listings, "listing_status"),
        byReviewState: countBy(listings, "review_state"),
        pendingReview: listings.filter((listing) => listing.review_state === "submitted").length,
        needsChanges: listings.filter((listing) => listing.review_state === "needs_changes").length,
        published: listings.filter(
          (listing) =>
            listing.listing_status === "published" &&
            listing.review_state === "approved",
        ).length,
        confirmationPoints: listings.reduce(
          (sum, listing) => sum + listing.confirmation_points,
          0,
        ),
        recent: listingReadModels.slice(0, 5),
      },
      latestDraft: latestDraft ? createDijieRolePackageDraftReadModel(latestDraft) : null,
      receivables: receivables
        ? {
            summary: receivables.summary,
            authorizationByRole: receivables.authorizationByRole,
            roleUsageByRole: receivables.roleUsageByRole,
            authorizationEvents: receivables.authorizationEvents,
            usageEvents: receivables.usageEvents,
          }
        : null,
    },
  });
}
