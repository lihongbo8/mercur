import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createDijieCapabilityMatchReport } from "../../../../../lib/dijie/capability-bridge";
import { actorIdFromRequest } from "../route-utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "解析岗位能力需要登录开发者账号。",
    });
  }

  const report = createDijieCapabilityMatchReport(req.body);
  return res.status(200).json({
    ok: true,
    report,
  });
}

