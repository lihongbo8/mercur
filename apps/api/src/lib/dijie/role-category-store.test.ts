import { describe, expect, it } from "bun:test";
import {
  bindDijieRoleCategoryPackWithRepository,
  createDijieRoleCategoryAdminReadModel,
  createDijieRoleCategoryRecordWithRepository,
  disableDijieRoleCategoryWithRepository,
  finalizeDijieRoleCategoryReviewWithRepository,
  submitDijieRoleCategoryReviewWithRepository,
  type DijieRoleCategoryLookupRepository,
  type DijieRoleCategoryRepository,
  type DijieRoleCategoryStorageRecord,
  type DijieRoleCategoryUpdateRepository,
} from "./role-category-store";
import type { DijieCatalogItem } from "./role-skill-tool-planner";

type CategoryRepository = DijieRoleCategoryLookupRepository &
  DijieRoleCategoryRepository &
  DijieRoleCategoryUpdateRepository;

const approvedCatalogItems: DijieCatalogItem[] = [
  {
    id: "tool.platform.audit-record",
    kind: "tool",
    name: "审计记录",
    version: "1.0.0",
    description: "记录岗位调用摘要。",
    tags: ["audit"],
    provides: ["audit.record"],
    source: "openclaw",
    status: "approved",
    permissions: ["audit.record"],
    riskLevel: "low",
    auditPolicy: ["audit.record"],
    keywords: ["audit.record"],
  },
  {
    id: "api.opencloud.image_generation",
    kind: "api",
    name: "图片生成",
    version: "1.0.0",
    description: "图片生成能力引用。",
    tags: ["image"],
    provides: ["image.generate"],
    source: "opencloud",
    status: "approved",
    permissions: ["image.generate", "human.confirm"],
    riskLevel: "medium",
    auditPolicy: ["human.confirm", "audit.record"],
    keywords: ["image.generate"],
  },
  {
    id: "api.disabled.video",
    kind: "api",
    name: "禁用视频",
    version: "1.0.0",
    description: "禁用能力。",
    tags: ["video"],
    provides: ["video.generate"],
    source: "opencloud",
    status: "disabled",
    permissions: ["video.generate"],
    riskLevel: "high",
    auditPolicy: ["human.confirm"],
    keywords: ["video.generate"],
  },
];

function memoryCategoryRepository(
  seed: Array<DijieRoleCategoryStorageRecord & { id?: string }> = [],
): CategoryRepository {
  const records = seed.map((record, index) => ({
    id: record.id ?? `djcatg_${index + 1}`,
    ...record,
  }));
  return {
    async listDijieRoleCategories(filters) {
      const categoryRef = filters?.category_ref;
      const id = filters?.id;
      return records.filter((record) => {
        if (typeof categoryRef === "string" && record.category_ref !== categoryRef) {
          return false;
        }
        if (typeof id === "string" && record.id !== id) {
          return false;
        }
        return true;
      });
    },
    async createDijieRoleCategories(data) {
      const record = {
        id: `djcatg_${records.length + 1}`,
        ...data,
      };
      records.push(record);
      return record;
    },
    async updateDijieRoleCategories(data) {
      const index = records.findIndex((record) => record.id === data.id);
      if (index < 0) {
        throw new Error("missing category");
      }
      records[index] = {
        ...records[index],
        ...data,
      };
      return records[index];
    },
  };
}

async function createBoundDraft(repository: CategoryRepository) {
  const created = await createDijieRoleCategoryRecordWithRepository(repository, {
    categoryRef: "category:test_designer@1",
    name: "测试设计",
    version: "1",
    description: "测试品类。",
  });
  expect(created.ok).toBe(true);
  const bound = await bindDijieRoleCategoryPackWithRepository(repository, {
    categoryRef: "category:test_designer@1",
    categoryPackRef: "categorypack:test_designer@1",
    skillPackRef: "skillpack:test_designer@1",
    toolPackRef: "toolpack:test_designer@1",
    catalogRefs: ["tool.platform.audit-record", "api.opencloud.image_generation"],
    catalogItems: approvedCatalogItems,
  });
  expect(bound.ok).toBe(true);
}

describe("Dijie role category store", () => {
  it("creates draft categories and rejects duplicate refs", async () => {
    const repository = memoryCategoryRepository();

    const created = await createDijieRoleCategoryRecordWithRepository(repository, {
      categoryRef: "category:customer_ops@1",
      name: "客服运营",
      version: "1",
    });
    const duplicate = await createDijieRoleCategoryRecordWithRepository(repository, {
      categoryRef: "category:customer_ops@1",
      name: "客服运营",
      version: "1",
    });

    expect(created).toMatchObject({
      ok: true,
      value: {
        categoryRef: "category:customer_ops@1",
        category: {
          category_status: "draft",
        },
      },
    });
    expect(duplicate).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("binds only approved catalog refs and derives capabilities", async () => {
    const repository = memoryCategoryRepository();
    await createDijieRoleCategoryRecordWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      name: "测试设计",
      version: "1",
    });

    const rejected = await bindDijieRoleCategoryPackWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      categoryPackRef: "categorypack:test_designer@1",
      skillPackRef: "skillpack:test_designer@1",
      toolPackRef: "toolpack:test_designer@1",
      catalogRefs: ["api.disabled.video"],
      catalogItems: approvedCatalogItems,
    });
    const bound = await bindDijieRoleCategoryPackWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      categoryPackRef: "categorypack:test_designer@1",
      skillPackRef: "skillpack:test_designer@1",
      toolPackRef: "toolpack:test_designer@1",
      catalogRefs: ["tool.platform.audit-record", "api.opencloud.image_generation"],
      catalogItems: approvedCatalogItems,
    });

    expect(rejected).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(bound).toMatchObject({
      ok: true,
      value: {
        category: {
          pack_binding: {
            capabilityRefs: expect.arrayContaining(["audit.record", "image.generate"]),
            permissionSummary: expect.arrayContaining(["audit.record", "human.confirm"]),
          },
        },
      },
    });
  });

  it("submits, approves, and disables a bound category", async () => {
    const repository = memoryCategoryRepository();
    await createBoundDraft(repository);

    const submitted = await submitDijieRoleCategoryReviewWithRepository(repository, {
      categoryRef: "category:test_designer@1",
    });
    const approved = await finalizeDijieRoleCategoryReviewWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      result: "approved",
      reviewedBy: "admin_001",
    });
    const rebinding = await bindDijieRoleCategoryPackWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      categoryPackRef: "categorypack:test_designer@1",
      skillPackRef: "skillpack:test_designer@1",
      toolPackRef: "toolpack:test_designer@1",
      catalogRefs: ["tool.platform.audit-record"],
      catalogItems: approvedCatalogItems,
    });
    const disabled = await disableDijieRoleCategoryWithRepository(repository, {
      categoryRef: "category:test_designer@1",
      disabledBy: "admin_001",
      reason: "risk",
    });

    expect(submitted).toMatchObject({
      ok: true,
      value: { category: { category_status: "pending_review" } },
    });
    expect(approved).toMatchObject({
      ok: true,
      value: { category: { category_status: "approved" } },
    });
    expect(rebinding).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(disabled).toMatchObject({
      ok: true,
      value: {
        category: {
          category_status: "disabled",
          review_policy: {
            disabledReason: "risk",
          },
        },
      },
    });
  });

  it("projects usage and approved catalog items for the admin UI", async () => {
    const repository = memoryCategoryRepository();
    await createBoundDraft(repository);
    const categories = await repository.listDijieRoleCategories();

    const model = createDijieRoleCategoryAdminReadModel({
      categories,
      catalogItems: approvedCatalogItems,
      roleListings: [
        {
          id: "djrole_1",
          category_ref: "category:test_designer@1",
          listing_status: "published",
        },
        {
          id: "djrole_2",
          category_ref: "category:test_designer@1",
          listing_status: "proposed",
        },
      ],
    });

    expect(model.categories[0]).toMatchObject({
      categoryRef: "category:test_designer@1",
      allowedActions: expect.arrayContaining(["submit_review"]),
      usage: {
        roleListingCount: 2,
        publishedRoleListingCount: 1,
      },
    });
    expect(model.approvedCatalogItems.map((item) => item.id)).not.toContain(
      "api.disabled.video",
    );
  });
});
