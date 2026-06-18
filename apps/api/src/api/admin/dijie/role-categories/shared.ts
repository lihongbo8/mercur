import type { MedusaRequest } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import { canReviewDijieRoles } from "../../../../lib/dijie/data-permissions";
import type { DijieRoleCategoryStorageRecord } from "../../../../lib/dijie/role-category-store";
import {
  resolveDijieAccountAccessProfileReader,
  resolveDijieCatalogReader,
  resolveDijieRoleCategoryStore,
  resolveDijieRoleListingReader,
} from "../../../../lib/dijie/service-reader-adapters";

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function nullableStringField(
  record: UnknownRecord,
  field: string,
): string | null | undefined {
  if (record[field] === null) {
    return null;
  }
  return stringField(record, field);
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

export function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord })
    .auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

export function categoryRefFromRequest(req: MedusaRequest): string | undefined {
  const raw = stringField(asRecord(req.params), "categoryRef");
  return raw ? decodeURIComponent(raw) : undefined;
}

export function resolveAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

type RoleCategoryAdminContext =
  | {
      ok: true;
      actorId: string;
      auditService: unknown;
      categoryStore: NonNullable<ReturnType<typeof resolveDijieRoleCategoryStore>>;
      categoryRecordReader: {
        listDijieRoleCategoryRecords: () => Promise<
          Array<DijieRoleCategoryStorageRecord & { id?: string }>
        >;
      };
      catalogReader: NonNullable<ReturnType<typeof resolveDijieCatalogReader>>;
      listingReader?: ReturnType<typeof resolveDijieRoleListingReader>;
    }
  | { ok: false; status: number; error: string };

export async function resolveRoleCategoryAdminContext(
  req: MedusaRequest,
): Promise<RoleCategoryAdminContext> {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return { ok: false, status: 401, error: "管理岗位品类需要平台审核账号登录。" };
  }
  const auditService = resolveAuditService(req);
  const profileReader = resolveDijieAccountAccessProfileReader(
    auditService,
  ) as DijieAccountAccessProfileReader | undefined;
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader,
  });
  if (!access || !canReviewDijieRoles(access)) {
    return { ok: false, status: 403, error: "当前账号没有岗位品类管理权限。" };
  }

  const categoryStore = resolveDijieRoleCategoryStore(auditService);
  const catalogReader = resolveDijieCatalogReader(auditService);
  const listRecords = (auditService as {
    listDijieRoleCategoryRecords?: unknown;
  })?.listDijieRoleCategoryRecords;
  if (!categoryStore || typeof listRecords !== "function" || !catalogReader) {
    return { ok: false, status: 503, error: "岗位品类管理存储暂未配置。" };
  }

  return {
    ok: true,
    actorId,
    auditService,
    categoryStore,
    categoryRecordReader: {
      listDijieRoleCategoryRecords: listRecords.bind(auditService) as () => Promise<
        Array<DijieRoleCategoryStorageRecord & { id?: string }>
      >,
    },
    catalogReader,
    listingReader: resolveDijieRoleListingReader(auditService),
  };
}
