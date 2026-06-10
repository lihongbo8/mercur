import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieCapabilityMatchReport,
  createDijieRoleCapabilityBinding,
  type DijieCapabilityMatchReport,
} from "../../../../../lib/dijie/capability-bridge";
import { actorIdFromRequest, asRecord, resolveCatalogReader } from "../route-utils";

function hasMatchReport(value: unknown): value is DijieCapabilityMatchReport {
  const record = asRecord(value);
  return Array.isArray(record.results) && Array.isArray(record.blockedReasons);
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "绑定岗位能力需要登录开发者账号。",
    });
  }

  const body = asRecord(req.body);
  const catalogReader = resolveCatalogReader(req);
  const catalogItems = catalogReader
    ? await catalogReader.listDijieEffectiveCatalogItems()
    : undefined;
  const report = hasMatchReport(body.report)
    ? body.report
    : createDijieCapabilityMatchReport(req.body, { catalogItems });
  const binding = createDijieRoleCapabilityBinding({
    rolePackageId: stringField(body, "rolePackageId"),
    roleListingId: stringField(body, "roleListingId"),
    report,
  });

  return res.status(200).json({
    ok: true,
    binding,
  });
}
