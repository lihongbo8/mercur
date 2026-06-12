import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DIJIE_AUDIT_MODULE } from "../lib/dijie/audit-store";
import {
  DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
  createDijieEcommerceArtDesignerCategoryStorageRecord,
} from "../lib/dijie/ecommerce-art-designer-category";

type RoleCategoryRecord = ReturnType<
  typeof createDijieEcommerceArtDesignerCategoryStorageRecord
> & {
  id?: string;
  pack_binding?: Record<string, unknown> | null;
};

type RoleCategoryService = {
  listDijieRoleCategories: (
    filters?: Record<string, unknown>,
  ) => Promise<RoleCategoryRecord[]>;
  createDijieRoleCategories: (
    input: RoleCategoryRecord,
  ) => Promise<RoleCategoryRecord>;
  updateDijieRoleCategories: (
    input: Partial<RoleCategoryRecord> & { id: string },
  ) => Promise<RoleCategoryRecord>;
};

export default async function seedEcommerceArtDesignerCategory({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve(DIJIE_AUDIT_MODULE) as unknown as RoleCategoryService;
  const record = createDijieEcommerceArtDesignerCategoryStorageRecord();
  const existing = await service.listDijieRoleCategories({
    category_ref: DIJIE_ECOMMERCE_ART_DESIGNER_CATEGORY_REF,
  });
  const current = existing[0];

  const result = current?.id
    ? await service.updateDijieRoleCategories({
        id: current.id,
        ...record,
      })
    : await service.createDijieRoleCategories(record);

  logger.info(
    JSON.stringify({
      ok: true,
      action: current?.id ? "updated" : "created",
      categoryRef: result.category_ref,
      name: result.name,
      categoryStatus: result.category_status,
      inheritedCapabilityCount: Array.isArray(result.pack_binding?.capabilityRefs)
        ? result.pack_binding.capabilityRefs.length
        : 0,
      inheritedCatalogRefCount: Array.isArray(result.pack_binding?.catalogRefs)
        ? result.pack_binding.catalogRefs.length
        : 0,
    }),
  );
}
