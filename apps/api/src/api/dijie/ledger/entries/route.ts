import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  canAccessDijieExecutionData,
  canAccessDijiePackageData,
  canAccessDijieRoleData,
  canUseDijieLocalSystem,
  hasDijieGlobalDataAccess,
  type DijieAccessContext,
} from "../../../../lib/dijie/data-permissions";
import {
  createDijieLedgerEntryReadModel,
  type DijieLedgerEntryReader,
  type DijieLedgerEntryStorageRecord,
} from "../../../../lib/dijie/ledger-store";
import { resolveDijieAccountAccessProfileReader } from "../../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function isLedgerEntryReader(value: unknown): value is DijieLedgerEntryReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { listDijieLedgerEntriesForAccount?: unknown })
      .listDijieLedgerEntriesForAccount === "function"
  );
}

function resolveDijieService(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
  } catch {
    return undefined;
  }
}

function canReadLedgerEntry(
  access: DijieAccessContext,
  entry: DijieLedgerEntryStorageRecord & { id: string },
): boolean {
  if (entry.account_id === access.accountId || entry.billing_account_id === access.accountId) {
    return true;
  }
  if (hasDijieGlobalDataAccess(access)) {
    return true;
  }
  if (!canUseDijieLocalSystem(access)) {
    return false;
  }
  return (
    canAccessDijieRoleData(access, entry.role_listing_id) ||
    canAccessDijiePackageData(access, entry.package_id, entry.developer_ref) ||
    canAccessDijieExecutionData(access, {
      execution_id: entry.execution_id,
      actor_id: entry.account_id,
      role_listing_id: entry.role_listing_id,
      entitlement_id: entry.entitlement_id,
    })
  );
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = resolveDijieService(req);
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveDijieAccountAccessProfileReader(service),
  });
  if (!access) {
    return res.status(401).json({
      ok: false,
      error: "读取费用记录需要先登录迭界AI账号。",
    });
  }
  if (!isLedgerEntryReader(service)) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI账本存储暂未配置。",
    });
  }

  const scopedRead =
    hasDijieGlobalDataAccess(access) ||
    (canUseDijieLocalSystem(access) && access.dataScopes.length > 0);
  const entries = await service.listDijieLedgerEntriesForAccount({
    accountId: scopedRead ? undefined : access.accountId,
    take: scopedRead ? 500 : 100,
  });

  return res.status(200).json({
    ok: true,
    entries: entries.filter((entry) => canReadLedgerEntry(access, entry)).map(createDijieLedgerEntryReadModel),
  });
}
