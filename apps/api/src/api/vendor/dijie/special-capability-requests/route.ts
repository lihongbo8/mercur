import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type {
  DijieCatalogReviewStore,
} from "../../../../lib/dijie/catalog-store";
import type { DijieCatalogKind } from "../../../../lib/dijie/role-skill-tool-planner";
import {
  actorIdFromRequest,
  asRecord,
  resolveCatalogReviewStore,
  resolveRoleCategoryReader,
  stringField,
} from "../role-packages/route-utils";
import {
  createDijieRoleCategoryRegistry,
  validateDijieRoleCategoryIntegration,
} from "../../../../lib/dijie/role-category-registry";

type UnknownRecord = Record<string, unknown>;

function catalogKind(value: unknown): DijieCatalogKind | undefined {
  return value === "skill" ||
    value === "tool" ||
    value === "api" ||
    value === "mcp" ||
    value === "provider" ||
    value === "adapter" ||
    value === "capability"
    ? value
    : undefined;
}

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = (
    req as MedusaRequest & { seller_context?: UnknownRecord }
  ).seller_context;
  return sellerContext ? stringField(sellerContext, "seller_id") : undefined;
}

function isSpecialCapabilityReviewStore(value: unknown): value is DijieCatalogReviewStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { createDijieSpecialCapabilityReviewRequest?: unknown })
      .createDijieSpecialCapabilityReviewRequest === "function"
  );
}

function requestCandidate(body: UnknownRecord) {
  return {
    businessScenario:
      stringField(body, "businessScenario") ?? stringField(body, "business_scenario") ?? null,
    expectedInput: stringField(body, "expectedInput") ?? stringField(body, "expected_input") ?? null,
    expectedOutput:
      stringField(body, "expectedOutput") ?? stringField(body, "expected_output") ?? null,
    reviewBoundary:
      stringField(body, "reviewBoundary") ?? stringField(body, "review_boundary") ?? null,
  };
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "申请特殊能力包需要登录开发者账号并选择开发者店铺。",
    });
  }

  const body = asRecord(req.body);
  const need = stringField(body, "need") ?? stringField(body, "capability") ?? stringField(body, "name");
  const kind = catalogKind(body.kind) ?? "capability";
  const categoryRef =
    stringField(body, "categoryRef") ?? stringField(body, "category_ref");
  if (!need) {
    return res.status(400).json({
      ok: false,
      error: "特殊能力包申请必须说明能力诉求。",
      issues: ["need_required"],
    });
  }
  if (!categoryRef) {
    return res.status(400).json({
      ok: false,
      error: "特殊能力包申请必须绑定一个已审核平台品类。",
      issues: ["categoryRef_required"],
    });
  }

  const roleCategoryReader = resolveRoleCategoryReader(req);
  if (!roleCategoryReader) {
    return res.status(503).json({
      ok: false,
      error: "平台岗位品类存储暂未配置，不能申请特殊能力包。",
    });
  }
  const categoryRegistry = createDijieRoleCategoryRegistry(
    await roleCategoryReader.listDijieRoleCategories(),
  );
  const categoryCheck = validateDijieRoleCategoryIntegration({
    categoryRef,
    registry: categoryRegistry,
  });
  if (!categoryCheck.ok) {
    return res.status(409).json({
      ok: false,
      error: categoryCheck.error ?? "特殊能力包必须绑定已审核且有基础品类包的平台品类。",
      issues: [...categoryCheck.missing, ...categoryCheck.blocked],
    });
  }

  const catalogReviewStore = resolveCatalogReviewStore(req);
  if (!isSpecialCapabilityReviewStore(catalogReviewStore)) {
    return res.status(503).json({
      ok: false,
      error: "特殊能力包申请存储暂未配置。",
    });
  }

  const request = await catalogReviewStore.createDijieSpecialCapabilityReviewRequest({
    need,
    kind,
    reason: stringField(body, "reason") ?? null,
    categoryRef,
    rolePackageId:
      stringField(body, "rolePackageId") ?? stringField(body, "role_package_id") ?? null,
    roleListingId:
      stringField(body, "roleListingId") ?? stringField(body, "role_listing_id") ?? null,
    requestedBy: actorId,
    candidate: requestCandidate(body),
    riskSummary: {
      requestedFrom: "developer_center",
      sellerId,
      requiresPlatformBuild: true,
    },
  });

  return res.status(200).json({
    ok: true,
    request,
  });
}
