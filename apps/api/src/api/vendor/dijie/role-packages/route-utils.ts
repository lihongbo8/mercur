import type { MedusaRequest } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import type {
  DijieCatalogReader,
  DijieCatalogReviewStore,
} from "../../../../lib/dijie/catalog-store";
import type { DijieOpenClawDialogModelBridge } from "../../../../lib/dijie/dialog-model-bridge";
import { resolveDijieOpenClawDialogModelBridge } from "../../../../lib/dijie/openclaw-model-bridge-resolver";
import type { DijieRolePackageDraftReader, DijieRolePackageDraftStore } from "../../../../lib/dijie/role-package-draft-store";
import type { DijieRolePackageStore } from "../../../../lib/dijie/role-package-store";
import {
  resolveDijieCatalogReader,
  resolveDijieCatalogReviewRequestReader,
  resolveDijieRoleCategoryReader,
  resolveDijieRolePackageDraftStore as resolveDijieRolePackageDraftStoreAdapter,
} from "../../../../lib/dijie/service-reader-adapters";
import type { DijieRoleCategoryReader } from "../../../../lib/dijie/role-category-registry";

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function resolveAuditModule(req: MedusaRequest): unknown {
  try {
    return req.scope.resolve(DIJIE_AUDIT_MODULE);
  } catch {
    return undefined;
  }
}

export function resolveRolePackageDraftStore(
  req: MedusaRequest,
): (DijieRolePackageDraftStore & DijieRolePackageDraftReader) | undefined {
  const service = resolveAuditModule(req);
  return resolveDijieRolePackageDraftStoreAdapter(service);
}

export function resolveRolePackageStore(req: MedusaRequest): DijieRolePackageStore | undefined {
  const service = resolveAuditModule(req);
  return service &&
    typeof (service as { storeDijieRolePackage?: unknown }).storeDijieRolePackage === "function"
    ? (service as DijieRolePackageStore)
    : undefined;
}

export function resolveCatalogReader(req: MedusaRequest): DijieCatalogReader | undefined {
  const service = resolveAuditModule(req);
  return resolveDijieCatalogReader(service);
}

export function resolveCatalogReviewReader(
  req: MedusaRequest,
): Pick<DijieCatalogReader, "listDijieCatalogReviewRequests"> | undefined {
  const service = resolveAuditModule(req);
  return resolveDijieCatalogReviewRequestReader(service);
}

export function resolveCatalogReviewStore(
  req: MedusaRequest,
): DijieCatalogReviewStore | undefined {
  const service = resolveAuditModule(req);
  if (!service) {
    return undefined;
  }
  const record = service as {
    createDijieCatalogReviewRequestsForPlan?: unknown;
    createDijieSpecialCapabilityReviewRequest?: unknown;
  };
  return typeof record.createDijieCatalogReviewRequestsForPlan === "function" ||
    typeof record.createDijieSpecialCapabilityReviewRequest === "function"
    ? (service as DijieCatalogReviewStore)
    : undefined;
}

export function resolveRoleCategoryReader(
  req: MedusaRequest,
): DijieRoleCategoryReader | undefined {
  const service = resolveAuditModule(req);
  return resolveDijieRoleCategoryReader(service);
}

export function resolveOpenClawDialogModelBridge(
  req: MedusaRequest,
): DijieOpenClawDialogModelBridge | undefined {
  return resolveDijieOpenClawDialogModelBridge(req);
}
