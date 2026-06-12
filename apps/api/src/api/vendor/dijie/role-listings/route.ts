import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  createDijieCatalogReviewRequestReadModel,
  createDijieSpecialCapabilityBindingReadModel,
  type DijieCatalogReviewRequestStorageRecord,
  type DijieSpecialCapabilityBindingStorageRecord,
} from "../../../../lib/dijie/catalog-store";
import {
  createDijieRoleListingManagementReadModel,
  type DijieRoleListingStore,
  type DijieRoleListingStorageRecord,
} from "../../../../lib/dijie/role-listing-store";
import {
  resolveDijieCatalogReader,
  resolveDijieRoleListingReader,
  resolveDijieRolePackageReader,
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

function numberField(record: UnknownRecord, field: string): number | undefined {
  const value = record[field];
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord })
    .auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = (
    req as MedusaRequest & { seller_context?: UnknownRecord }
  ).seller_context;
  return sellerContext ? stringField(sellerContext, "seller_id") : undefined;
}

function isRoleListingStore(value: unknown): value is DijieRoleListingStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { createDijieRoleListing?: unknown })
      .createDijieRoleListing === "function"
  );
}

function resolveDijieRoleSystem(req: MedusaRequest) {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return {
      listingStore: isRoleListingStore(service) ? service : undefined,
      listingReader: resolveDijieRoleListingReader(service),
      packageReader: resolveDijieRolePackageReader(service),
      catalogReader: resolveDijieCatalogReader(service),
    };
  } catch {
    return {};
  }
}

function matchesRoleListing(
  role: DijieRoleListingStorageRecord & { id: string },
  value: {
    role_listing_id?: string | null;
    role_package_id?: string | null;
  },
) {
  if (value.role_listing_id && value.role_listing_id === role.id) {
    return true;
  }
  return Boolean(value.role_package_id && value.role_package_id === role.package_id);
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "读取开发者岗位商品需要登录开发者账号并选择开发者店铺。",
    });
  }

  const { listingReader, catalogReader } = resolveDijieRoleSystem(req);
  if (!listingReader) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位商品存储暂未配置。",
    });
  }

  try {
    const listings = await listingReader.listDijieStoredRoleListings({
      developerRef: sellerId,
      take: 100,
    });
    const [reviewRequests, bindings] = catalogReader
      ? await Promise.all([
          catalogReader.listDijieCatalogReviewRequests(),
          catalogReader.listDijieSpecialCapabilityBindings(),
        ])
      : [[], []];
    return res.status(200).json({
      ok: true,
      listings: listings.map((listing) => ({
        ...createDijieRoleListingManagementReadModel(listing),
        specialCapabilityRequests: reviewRequests
          .filter((request: DijieCatalogReviewRequestStorageRecord & { id?: string }) =>
            request.payload?.requestType === "special_capability_pack" &&
            matchesRoleListing(listing, request),
          )
          .map(createDijieCatalogReviewRequestReadModel),
        specialCapabilityBindings: bindings
          .filter((binding: DijieSpecialCapabilityBindingStorageRecord & { id?: string }) =>
            matchesRoleListing(listing, binding),
          )
          .map(createDijieSpecialCapabilityBindingReadModel),
      })),
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位商品暂时无法读取。",
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  const sellerId = sellerIdFromRequest(req);
  if (!actorId || !sellerId) {
    return res.status(401).json({
      ok: false,
      error: "创建岗位商品需要登录开发者账号并选择开发者店铺。",
    });
  }

  const { listingStore, packageReader } = resolveDijieRoleSystem(req);
  if (!listingStore || !packageReader) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位商品存储暂未配置。",
    });
  }

  const body = asRecord(req.body);
  const packageId =
    stringField(body, "packageId") ?? stringField(body, "package_id");
  const packageVersion =
    stringField(body, "packageVersion") ?? stringField(body, "package_version");
  if (!packageId || !packageVersion) {
    return res.status(400).json({
      ok: false,
      error: "创建岗位商品必须选择已上传的岗位包。",
    });
  }

  const rolePackage = await packageReader.retrieveDijieRolePackage({
    packageId,
    packageVersion,
  });
  if (!rolePackage) {
    return res.status(404).json({
      ok: false,
      error: "未找到已上传的岗位包。",
    });
  }

  if (rolePackage.owner_id && rolePackage.owner_id !== actorId) {
    return res.status(403).json({
      ok: false,
      error: "当前账号无权使用该岗位包创建商品。",
    });
  }

  try {
    const result = await listingStore.createDijieRoleListing({
      packageId,
      packageVersion,
      ownerId: actorId,
      developerRef: sellerId,
      listingOwnerRef: sellerId,
      billingBeneficiaryRef: sellerId,
      title: stringField(body, "title") ?? rolePackage.manifest_summary.name,
      subtitle: stringField(body, "subtitle"),
      description: stringField(body, "description"),
      usageInstructions:
        stringField(body, "usageInstructions") ??
        stringField(body, "usage_instructions"),
      category: stringField(body, "category"),
      categoryRef: stringField(body, "categoryRef") ?? stringField(body, "category_ref"),
      manifestSummary: rolePackage.manifest_summary,
      pricing: body.pricing,
      roleTokenPricing: body.roleTokenPricing ?? body.role_token_pricing,
      confirmationPoints: numberField(body, "confirmationPoints"),
    });
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      roleListingId: result.value.roleListingId,
      listing: result.value.listing,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "岗位商品草稿创建失败。",
    });
  }
}
