import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import {
  canAccessDijiePackageData,
} from "../../../../../../lib/dijie/data-permissions";
import {
  createDijieRolePackageDownloadReadModel,
  type DijieRolePackageReader,
} from "../../../../../../lib/dijie/role-package-store";
import {
  resolveDijieAccountAccessProfileReader as resolveDijieAccountAccessProfileReaderAdapter,
  resolveDijieRolePackageReader as resolveDijieRolePackageReaderAdapter,
} from "../../../../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord {
  return ((req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context ?? {}) as UnknownRecord;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  return stringField(authContextFromRequest(req), "actor_id");
}

function queryVersion(req: MedusaRequest): string | undefined {
  const query = (req as MedusaRequest & { query?: UnknownRecord }).query ?? {};
  return stringField(query, "version");
}

function resolveRolePackageReader(req: MedusaRequest): DijieRolePackageReader | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return resolveDijieRolePackageReaderAdapter(store);
  } catch {
    return undefined;
  }
}

function resolveAccountAccessProfileReader(
  req: MedusaRequest,
): DijieAccountAccessProfileReader | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return resolveDijieAccountAccessProfileReaderAdapter(store);
  } catch {
    return undefined;
  }
}

function setDownloadHeaders(res: MedusaResponse, packageId: string, packageVersion: string) {
  const responseWithHeaders = res as MedusaResponse & {
    setHeader?: (name: string, value: string) => void;
  };
  responseWithHeaders.setHeader?.("content-type", "application/json; charset=utf-8");
  responseWithHeaders.setHeader?.(
    "content-disposition",
    `attachment; filename="${packageId}-${packageVersion}-role-package.json"`,
  );
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const packageId = req.params?.packageId;
  if (typeof packageId !== "string" || !packageId.trim()) {
    return res.status(400).json({
      ok: false,
      error: "岗位包编号不能为空。",
    });
  }

  const reader = resolveRolePackageReader(req);
  if (!reader) {
    return res.status(503).json({
      ok: false,
      error: "迭界AI岗位包存储暂未配置，无法下载文件包。",
    });
  }

  let record: Awaited<ReturnType<DijieRolePackageReader["retrieveDijieRolePackage"]>>;
  try {
    record = await reader.retrieveDijieRolePackage({
      packageId: packageId.trim(),
      packageVersion: queryVersion(req),
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI岗位包存储读取失败。",
    });
  }

  if (!record) {
    return res.status(404).json({
      ok: false,
      error: "未找到可下载的岗位包。",
    });
  }

  const actorId = actorIdFromRequest(req);
  if (record.owner_id && !actorId) {
    return res.status(401).json({
      ok: false,
      error: "下载岗位包需要登录。",
    });
  }
  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });
  if (
    record.owner_id &&
    (!access || !canAccessDijiePackageData(access, record.package_id, record.owner_id))
  ) {
    return res.status(403).json({
      ok: false,
      error: "当前账号无权下载该岗位包。",
    });
  }

  setDownloadHeaders(res, record.package_id, record.package_version);
  return res.status(200).json({
    ok: true,
    package: createDijieRolePackageDownloadReadModel(record),
  });
}
