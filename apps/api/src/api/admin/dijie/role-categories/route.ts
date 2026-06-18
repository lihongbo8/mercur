import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieRoleCategoryAdminReadModel,
} from "../../../../lib/dijie/role-category-store";
import {
  asRecord,
  resolveRoleCategoryAdminContext,
  stringField,
} from "./shared";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const context = await resolveRoleCategoryAdminContext(req);
  if (!context.ok) {
    return res.status(context.status).json({ ok: false, error: context.error });
  }

  const [categories, catalogItems, roleListings] = await Promise.all([
    context.categoryRecordReader.listDijieRoleCategoryRecords(),
    context.catalogReader.listDijieEffectiveCatalogItems(),
    context.listingReader
      ? context.listingReader.listDijieStoredRoleListings({ take: 1000 })
      : Promise.resolve([]),
  ]);

  return res.status(200).json({
    ok: true,
    roleCategories: createDijieRoleCategoryAdminReadModel({
      categories,
      catalogItems,
      roleListings,
    }),
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const context = await resolveRoleCategoryAdminContext(req);
  if (!context.ok) {
    return res.status(context.status).json({ ok: false, error: context.error });
  }

  const body = asRecord(req.body);
  const categoryRef = stringField(body, "categoryRef") ?? stringField(body, "category_ref");
  const name = stringField(body, "name");
  const version = stringField(body, "version");
  if (!categoryRef || !name || !version) {
    return res.status(400).json({
      ok: false,
      error: "创建品类必须填写 categoryRef、name 和 version。",
    });
  }

  const result = await context.categoryStore.createDijieRoleCategoryRecord({
    categoryRef,
    name,
    version,
    description: stringField(body, "description"),
    createdBy: context.actorId,
  });
  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  return res.status(200).json({
    ok: true,
    categoryRef: result.value.categoryRef,
    category: result.value.category,
  });
}
