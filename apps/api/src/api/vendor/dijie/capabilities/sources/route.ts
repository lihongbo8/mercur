import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { listDijieCapabilitySources } from "../../../../../lib/dijie/capability-bridge";
import { actorIdFromRequest } from "../route-utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "读取岗位能力来源需要登录开发者账号。",
    });
  }

  return res.status(200).json({
    ok: true,
    sources: listDijieCapabilitySources(),
  });
}

