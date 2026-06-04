import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getDijieVendorReceivablesReadModel } from "../../../../lib/dijie/role-receivables";

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

function sellerIdFromRequest(req: MedusaRequest): string | undefined {
  const sellerContext = asRecord(
    (req as MedusaRequest & { seller_context?: UnknownRecord }).seller_context,
  );
  return stringField(sellerContext, "seller_id");
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = sellerIdFromRequest(req);
  if (!sellerId) {
    return res.status(401).json({
      ok: false,
      error: "读取迭界AI岗位应收需要先选择开发者店铺。",
    });
  }

  const query = req.scope.resolve("query");
  try {
    const receivables = await getDijieVendorReceivablesReadModel({
      sellerId,
      queryGraph: (queryInput) => query.graph(queryInput),
    });

    return res.status(200).json({
      ok: true,
      receivables,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位应收暂时无法读取。",
    });
  }
}
