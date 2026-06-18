import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieCatalogReviewRequestReadModel,
  type DijieCatalogReader,
} from "../../../../../../lib/dijie/catalog-store";
import { createDijieRolePackageDraftReadModel } from "../../../../../../lib/dijie/role-package-draft-store";
import {
  actorIdFromRequest,
  resolveCatalogReviewReader,
  resolveRolePackageDraftStore,
} from "../../route-utils";

type DraftForCatalogReview = Parameters<typeof createDijieRolePackageDraftReadModel>[0];

async function catalogReviewRequestsForDraft(
  catalogReviewReader: Pick<DijieCatalogReader, "listDijieCatalogReviewRequests"> | undefined,
  draft: DraftForCatalogReview | undefined,
) {
  const draftRefs = new Set(
    [draft?.package_id, draft?.id].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ),
  );
  if (!catalogReviewReader || !draftRefs.size) {
    return [];
  }

  const requests = await catalogReviewReader.listDijieCatalogReviewRequests();
  return requests
    .filter((request) => request.role_package_id && draftRefs.has(request.role_package_id))
    .map(createDijieCatalogReviewRequestReadModel);
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "读取岗位包草稿需要登录开发者账号。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿存储暂未配置。",
    });
  }

  const draft = await draftStore.retrieveLatestDijieRolePackageDraft({ ownerId: actorId });
  const catalogReviewRequests = await catalogReviewRequestsForDraft(
    resolveCatalogReviewReader(req),
    draft,
  );
  return res.status(200).json({
    ok: true,
    draft: draft
      ? createDijieRolePackageDraftReadModel(draft, { catalogReviewRequests })
      : null,
  });
}
