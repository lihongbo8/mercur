import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
import { canUseDijieLocalSystem } from "../../../../../lib/dijie/data-permissions";
import { buildDijieDispatcherGatewayRoleReadModel } from "../../../../../lib/dijie/gateway-role-read-model";
import type {
  DijieRoleEntitlementLookupRepository,
  DijieRoleEntitlementStorageRecord,
} from "../../../../../lib/dijie/role-entitlement-store";
import type {
  DijieRolePackageReader,
  DijieRolePackageStorageRecord,
} from "../../../../../lib/dijie/role-package-store";
import { listDijieRoleListings } from "../../../../../lib/dijie/role-listings";

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

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = authContextFromRequest(req);
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function billingAccountIdFromAuthContext(authContext?: UnknownRecord): string | undefined {
  if (!authContext) {
    return undefined;
  }
  const metadata = {
    ...asRecord(authContext.metadata),
    ...asRecord(authContext.dijieAccess),
    ...asRecord(authContext.dijie_access),
  };
  return (
    stringField(metadata, "billingAccountId") ??
    stringField(metadata, "billing_account_id") ??
    stringField(authContext, "billingAccountId") ??
    stringField(authContext, "billing_account_id")
  );
}

function workspaceRefFromQuery(req: MedusaRequest): string | undefined {
  const query = asRecord((req as MedusaRequest & { query?: unknown }).query);
  return stringField(query, "workspaceRef") ?? stringField(query, "workspace_ref");
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

function isRoleEntitlementLookupRepository(
  value: unknown,
): value is DijieRoleEntitlementLookupRepository {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { listDijieRoleEntitlements?: unknown }).listDijieRoleEntitlements ===
      "function"
  );
}

function isRolePackageReader(value: unknown): value is DijieRolePackageReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieRolePackage?: unknown }).retrieveDijieRolePackage ===
      "function"
  );
}

function resolveDijieAuditService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

async function listActorEntitlements(input: {
  service: unknown;
  actorId: string;
}): Promise<Array<DijieRoleEntitlementStorageRecord & { id: string }>> {
  if (!isRoleEntitlementLookupRepository(input.service)) {
    return [];
  }
  return input.service.listDijieRoleEntitlements(
    {
      actor_id: input.actorId,
      entitlement_status: "authorized",
    },
    {
      take: 500,
      order: { authorized_at: "DESC" },
    },
  );
}

async function retrieveRolePackages(input: {
  reader?: DijieRolePackageReader;
  roles: Awaited<ReturnType<typeof listDijieRoleListings>>;
}): Promise<Array<DijieRolePackageStorageRecord & { id?: string }>> {
  if (!input.reader) {
    return [];
  }

  const packageKeys = new Map<string, { packageId: string; packageVersion?: string }>();
  for (const role of input.roles) {
    if (!role.packageId) {
      continue;
    }
    const key = `${role.packageId}:${role.packageVersion ?? ""}`;
    packageKeys.set(key, {
      packageId: role.packageId,
      ...(role.packageVersion ? { packageVersion: role.packageVersion } : {}),
    });
  }

  const packages = await Promise.all(
    [...packageKeys.values()].map((lookup) => input.reader!.retrieveDijieRolePackage(lookup)),
  );
  return packages.filter(
    (record): record is DijieRolePackageStorageRecord & { id?: string } => Boolean(record),
  );
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authContext = authContextFromRequest(req);
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "读取岗位 Gateway 视图需要先登录账号。",
    });
  }

  const auditService = resolveDijieAuditService(req);
  const access = await resolveDijieAccessContext({
    authContext,
    profileReader: isAccountAccessProfileReader(auditService) ? auditService : undefined,
  });
  if (!access || !canUseDijieLocalSystem(access)) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有本地主系统 Gateway 数据权限。",
    });
  }

  try {
    const query = req.scope.resolve("query");
    const [roles, entitlements] = await Promise.all([
      listDijieRoleListings((queryInput) => query.graph(queryInput)),
      listActorEntitlements({ service: auditService, actorId }),
    ]);
    const packages = await retrieveRolePackages({
      reader: isRolePackageReader(auditService) ? auditService : undefined,
      roles,
    });

    return res.status(200).json({
      ok: true,
      readModel: buildDijieDispatcherGatewayRoleReadModel({
        actorId,
        billingAccountId: billingAccountIdFromAuthContext(authContext),
        workspaceRef: workspaceRefFromQuery(req),
        roles,
        entitlements,
        packages,
      }),
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位 Gateway 暂时无法读取岗位调度视图。",
    });
  }
}
