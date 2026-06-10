import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  readDijieRolePackageUploadFilesForStorage,
  validateDijieRolePackageUpload,
} from "../../../../lib/dijie/role-package-upload";
import {
  createDijieRolePackageSummaryReadModel,
  type DijieRolePackageReader,
  type DijieRolePackageStore,
} from "../../../../lib/dijie/role-package-store";
import { resolveDijieRolePackageReader } from "../../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function isRolePackageStore(value: unknown): value is DijieRolePackageStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { storeDijieRolePackage?: unknown }).storeDijieRolePackage ===
      "function"
  );
}

function resolveRolePackageStore(req: MedusaRequest): DijieRolePackageStore | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRolePackageStore(store) ? store : undefined;
  } catch {
    return undefined;
  }
}

function resolveRolePackageReader(req: MedusaRequest): DijieRolePackageReader | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return resolveDijieRolePackageReader(store);
  } catch {
    return undefined;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "读取开发者岗位包需要登录开发者账号。",
    });
  }

  const reader = resolveRolePackageReader(req);
  if (!reader) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位包存储暂未配置，无法读取开发者岗位包。",
    });
  }

  try {
    const packages = await reader.listDijieRolePackages({
      ownerId: actorId,
      take: 100,
    });
    return res.status(200).json({
      ok: true,
      packages: packages.map(createDijieRolePackageSummaryReadModel),
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位包暂时无法读取。",
    });
  }
}

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

  const store = resolveRolePackageStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位包存储暂未配置，无法保存上传文件包。",
    });
  }

  let stored: Awaited<ReturnType<DijieRolePackageStore["storeDijieRolePackage"]>>;
  try {
    stored = await store.storeDijieRolePackage({
      summary: validation.value,
      files: readDijieRolePackageUploadFilesForStorage(req.body),
      ownerId: actorIdFromRequest(req),
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位包存储写入失败。",
    });
  }

  return res.status(200).json({
    ok: true,
    rolePackageId: stored.rolePackageId,
    package: validation.value,
    downloadUrl: `/vendor/dijie/role-packages/${encodeURIComponent(
      validation.value.packageId,
    )}/download?version=${encodeURIComponent(validation.value.packageVersion)}`,
  });
}
