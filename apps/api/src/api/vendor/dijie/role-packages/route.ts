import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { validateDijieRolePackageUpload } from "../../../../lib/dijie/role-package-upload";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validation = validateDijieRolePackageUpload(req.body);

  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      error: "迭界AI岗位包上传校验失败。",
      message: "迭界AI岗位包上传校验失败。",
      issues: validation.issues,
    });
  }

  return res.status(200).json({
    ok: true,
    package: validation.value,
  });
}
