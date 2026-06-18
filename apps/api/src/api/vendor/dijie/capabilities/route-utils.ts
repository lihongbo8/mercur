import type { MedusaRequest } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import type { DijieCatalogReader } from "../../../../lib/dijie/catalog-store";

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
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

export function resolveCatalogReader(req: MedusaRequest): DijieCatalogReader | undefined {
  const service = resolveAuditModule(req);
  return service &&
    typeof (service as { listDijieEffectiveCatalogItems?: unknown })
      .listDijieEffectiveCatalogItems === "function"
    ? (service as DijieCatalogReader)
    : undefined;
}
