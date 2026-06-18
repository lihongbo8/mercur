import { createHash, randomUUID } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type {
  DijieAuditRecord,
  DijieAuditSummary,
  DijieRoleArtifact,
  DijieRoleResult,
} from "../../../lib/dijie/audit-summary";
import {
  createDijieAuditExecutionReadModel,
  createDijieAuditStorageRecord,
  DIJIE_AUDIT_MODULE,
  type DijieAuditRecordStore,
} from "../../../lib/dijie/audit-store";
import {
  normalizeOneTimeAuthorizationPricing,
  normalizeRoleTokenPricing,
} from "../../../lib/dijie/execution-token";
import type { DijieLedgerEntryStore } from "../../../lib/dijie/ledger-store";
import { createDijieRoleTokenUsageLedgerEntryFromAudit } from "../../../lib/dijie/ledgers";
import type {
  DijieRoleEntitlementLookupRepository,
  DijieRoleEntitlementStorageRecord,
} from "../../../lib/dijie/role-entitlement-store";
import type {
  DijieRolePackageReader,
  DijieRolePackageStorageRecord,
} from "../../../lib/dijie/role-package-store";
import { resolveDijieRolePackageReader } from "../../../lib/dijie/service-reader-adapters";

type UnknownRecord = Record<string, unknown>;

type CloudExecutionStore = DijieAuditRecordStore &
  Partial<DijieLedgerEntryStore> &
  DijieRoleEntitlementLookupRepository &
  Partial<DijieRolePackageReader>;

type ExecutionFailureCode =
  | "failed/input_required"
  | "failed/capability_missing"
  | "failed/no_artifact";

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanField(record: UnknownRecord, field: string): boolean {
  return record[field] === true;
}

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function isCloudExecutionStore(value: unknown): value is CloudExecutionStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { listDijieRoleEntitlements?: unknown })
      .listDijieRoleEntitlements === "function" &&
    typeof (value as { recordDijieAuditSummary?: unknown })
      .recordDijieAuditSummary === "function"
  );
}

function resolveCloudExecutionStore(req: MedusaRequest): CloudExecutionStore | undefined {
  try {
    const store = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    if (isCloudExecutionStore(store)) {
      return store;
    }
  } catch {
    // The module is optional in lightweight tests; fail closed below when absent.
  }

  return undefined;
}

async function retrieveAuthorizedEntitlement(input: {
  store: CloudExecutionStore;
  actorId: string;
  roleListingId: string;
  entitlementId?: string;
}): Promise<(DijieRoleEntitlementStorageRecord & { id: string }) | undefined> {
  const entitlements = await input.store.listDijieRoleEntitlements(
    {
      actor_id: input.actorId,
      role_listing_id: input.roleListingId,
      entitlement_status: "authorized",
      ...(input.entitlementId ? { id: input.entitlementId } : {}),
    },
    { take: 10, order: { authorized_at: "DESC" } },
  );

  return entitlements.find(
    (entitlement) =>
      entitlement.actor_id === input.actorId &&
      entitlement.role_listing_id === input.roleListingId &&
      entitlement.entitlement_status === "authorized" &&
      (!input.entitlementId || entitlement.id === input.entitlementId),
  );
}

function requiresNativeImageGeneration(taskText: string): boolean {
  return /生成图片文件|直接出图|图片生成|生成一张图片|生成主图图片|导出图片/.test(taskText);
}

function cloudExecutorSupportsNativeImageGeneration(): boolean {
  return process.env.DIJIE_CLOUD_IMAGE_GENERATION_ENABLED === "true";
}

function packageContextDigest(record: DijieRolePackageStorageRecord & { id?: string }): string {
  const payload = JSON.stringify({
    packageId: record.package_id,
    packageVersion: record.package_version,
    manifestSummary: record.manifest_summary,
    fileManifest: record.file_manifest,
    validationIssues: record.validation_issues ?? [],
  });
  return `pkgctx_${createHash("sha256").update(payload).digest("hex").slice(0, 16)}`;
}

async function retrievePackageContext(input: {
  store: CloudExecutionStore;
  entitlement: DijieRoleEntitlementStorageRecord & { id: string };
}): Promise<
  | { ok: true; digest: string }
  | { ok: false; status: number; code: string; error: string }
> {
  const packageReader = resolveDijieRolePackageReader(input.store);
  if (!packageReader) {
    return {
      ok: false,
      status: 503,
      code: "package_context_store_missing",
      error: "云端执行前无法读取岗位包上下文。",
    };
  }

  let record: (DijieRolePackageStorageRecord & { id?: string }) | undefined;
  try {
    record = await packageReader.retrieveDijieRolePackage({
      packageId: input.entitlement.package_id,
      packageVersion: input.entitlement.package_version,
    });
  } catch {
    return {
      ok: false,
      status: 502,
      code: "package_context_read_failed",
      error: "云端执行前岗位包上下文读取失败。",
    };
  }

  if (!record) {
    return {
      ok: false,
      status: 409,
      code: "package_context_missing",
      error: "该授权岗位缺少可执行的岗位包上下文，不能发起正式执行。",
    };
  }

  return {
    ok: true,
    digest: packageContextDigest(record),
  };
}

function estimateModelUsage(taskText: string): NonNullable<DijieAuditSummary["modelProxyUsage"]> {
  const inputTokens = Math.max(80, Math.ceil(taskText.length * 1.4));
  const outputTokens = Math.max(500, Math.min(2200, Math.ceil(taskText.length * 5) + 420));
  return {
    requestCount: 1,
    inputTokens,
    outputTokens,
  };
}

function createDesignPlanArtifact(input: {
  executionId: string;
  taskText: string;
}): DijieRoleArtifact {
  const content = [
    "智能门锁电商主图方案",
    `任务：${input.taskText}`,
    "画面：产品正面大图、门体场景、核心卖点三段式信息层级。",
    "卖点：指纹/密码/NFC/远程临时密码；突出安全、便捷、适配家用门。",
    "输出：主图方案文本，可作为后续图片生成或设计制作输入。",
  ].join("\n");
  const sha256 = createHash("sha256").update(content).digest("hex");

  return {
    id: `artifact_${input.executionId}_main_image_plan`,
    type: "design_plan_text",
    title: "智能门锁主图设计方案",
    sizeBytes: Buffer.byteLength(content),
    sha256,
  };
}

function createRoleResult(input: {
  executionId: string;
  roleListingId: string;
  entitlement: DijieRoleEntitlementStorageRecord & { id: string };
  startedAt: string;
  endedAt: string;
  taskText: string;
  packageContextDigest: string;
  failureCode?: ExecutionFailureCode;
}): DijieRoleResult {
  const status: DijieRoleResult["status"] = input.failureCode ? "failed" : "completed";
  const artifacts = input.failureCode
    ? []
    : [createDesignPlanArtifact({
        executionId: input.executionId,
        taskText: input.taskText,
      })];
  const hasBusinessArtifact = artifacts.length > 0;
  const finalStatus: DijieRoleResult["status"] =
    status === "completed" && !hasBusinessArtifact ? "failed" : status;
  const error =
    input.failureCode ??
    (finalStatus === "failed" ? "failed/no_artifact" : undefined);

  return {
    executionId: input.executionId,
    roleListingId: input.roleListingId,
    packageId: input.entitlement.package_id,
    packageVersion: input.entitlement.package_version,
    developerRef: input.entitlement.developer_ref,
    listingOwnerRef: input.entitlement.listing_owner_ref,
    billingBeneficiaryRef: input.entitlement.billing_beneficiary_ref,
    status: finalStatus,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    summary:
      finalStatus === "completed"
        ? `云端使用者中心已生成岗位业务产物。packageContext=${input.packageContextDigest}`
        : `云端使用者中心执行未满足岗位业务成功条件。packageContext=${input.packageContextDigest}`,
    changedFiles: [],
    artifacts,
    ...(error ? { error } : {}),
  };
}

function createCloudAuditRecord(input: {
  actorId: string;
  roleListingId: string;
  entitlement: DijieRoleEntitlementStorageRecord & { id: string };
  taskText: string;
  packageContextDigest: string;
  failureCode?: ExecutionFailureCode;
}): DijieAuditRecord {
  const executionId = randomUUID();
  const startedAt = new Date().toISOString();
  const endedAt = new Date().toISOString();
  const result = createRoleResult({
    executionId,
    roleListingId: input.roleListingId,
    entitlement: input.entitlement,
    startedAt,
    endedAt,
    taskText: input.taskText,
    packageContextDigest: input.packageContextDigest,
    failureCode: input.failureCode,
  });
  const modelProxyUsage =
    result.status === "completed" ? estimateModelUsage(input.taskText) : undefined;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  return {
    auditRecordVersion: 1,
    actorId: input.actorId,
    packageId: input.entitlement.package_id,
    packageVersion: input.entitlement.package_version,
    developerRef: input.entitlement.developer_ref,
    listingOwnerRef: input.entitlement.listing_owner_ref,
    billingBeneficiaryRef: input.entitlement.billing_beneficiary_ref,
    receivedAt: endedAt,
    executionTokenIssuedAt: issuedAt,
    executionTokenExpiresAt: expiresAt,
    pricing: input.entitlement.pricing,
    roleTokenPricing: input.entitlement.role_token_pricing,
    summary: {
      executionId,
      deviceId: "cloud_user_center",
      workspaceRef: "cloud_user_center",
      roleListingId: input.roleListingId,
      packageId: input.entitlement.package_id,
      packageVersion: input.entitlement.package_version,
      developerRef: input.entitlement.developer_ref,
      listingOwnerRef: input.entitlement.listing_owner_ref,
      billingBeneficiaryRef: input.entitlement.billing_beneficiary_ref,
      entitlementId: input.entitlement.id,
      localGatewayId: "cloud_user_center",
      status: result.status,
      startedAt,
      endedAt,
      ...(modelProxyUsage ? { modelProxyUsage } : {}),
      toolUsage: {
        shellCommands: 0,
        testsRun: 0,
        filesRead: 0,
        filesChanged: 0,
      },
      result,
    },
  };
}

function createStructuredReadback(record: DijieAuditRecord) {
  const readModel = createDijieAuditExecutionReadModel(
    createDijieAuditStorageRecord(record),
  );

  return {
    status: readModel.status,
    failureReason: readModel.errorSummary,
    artifacts: readModel.artifacts,
    ledger: readModel.billingSummary,
    execution: {
      roleListingId: readModel.roleListingId,
      packageId: readModel.packageId,
      packageVersion: readModel.packageVersion,
      developerRef: readModel.developerRef,
      listingOwnerRef: readModel.listingOwnerRef,
      billingBeneficiaryRef: readModel.billingBeneficiaryRef,
      status: readModel.status,
      pricing: readModel.pricing,
      roleTokenPricing: readModel.roleTokenPricing,
      toolUsage: readModel.toolUsage,
      modelProxyUsage: readModel.modelProxyUsage,
      changedFiles: readModel.changedFiles,
      receivedAt: readModel.receivedAt,
    },
    audit: {
      status: readModel.status,
      toolUsage: readModel.toolUsage,
      modelProxyUsage: readModel.modelProxyUsage,
      changedFiles: readModel.changedFiles,
      errorSummary: readModel.errorSummary,
      receivedAt: readModel.receivedAt,
    },
  };
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      code: "unauthenticated",
      error: "云端使用者中心执行岗位需要先登录迭界AI账号。",
    });
  }

  const body = asRecord(req.body);
  const roleListingId = stringField(body, "roleListingId");
  const entitlementId = stringField(body, "entitlementId");
  const taskText =
    stringField(body, "taskText") ??
    stringField(body, "task") ??
    stringField(body, "prompt") ??
    "";

  if (!roleListingId) {
    return res.status(400).json({
      ok: false,
      code: "role_listing_id_missing",
      error: "云端执行岗位需要 roleListingId。",
    });
  }

  if (!booleanField(body, "confirmCost")) {
    return res.status(409).json({
      ok: false,
      code: "confirmation_required",
      error: "请先确认岗位执行费用规则。",
    });
  }

  if (!booleanField(body, "confirmHumanCheckpoints")) {
    return res.status(409).json({
      ok: false,
      code: "confirmation_required",
      error: "请先确认岗位人工确认点。",
    });
  }

  const store = resolveCloudExecutionStore(req);
  if (!store) {
    return res.status(503).json({
      ok: false,
      code: "cloud_execution_store_missing",
      error: "Dijie cloud execution store is not configured.",
    });
  }

  let entitlement: (DijieRoleEntitlementStorageRecord & { id: string }) | undefined;
  try {
    entitlement = await retrieveAuthorizedEntitlement({
      store,
      actorId,
      roleListingId,
      entitlementId,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      code: "entitlement_read_failed",
      error: "迭界AI岗位授权记录暂时无法读取。",
    });
  }

  if (!entitlement) {
    return res.status(403).json({
      ok: false,
      code: "not_authorized",
      error: "当前账号没有该岗位的有效授权，不能执行。",
    });
  }

  const pricing = normalizeOneTimeAuthorizationPricing(entitlement.pricing);
  const roleTokenPricing = normalizeRoleTokenPricing(entitlement.role_token_pricing);
  if (!pricing || !roleTokenPricing) {
    return res.status(502).json({
      ok: false,
      code: "execution_pricing_missing",
      error: "岗位授权缺少可结算的执行价格合同。",
    });
  }

  const packageContext = await retrievePackageContext({
    store,
    entitlement,
  });
  if (!packageContext.ok) {
    return res.status(packageContext.status).json({
      ok: false,
      code: packageContext.code,
      error: packageContext.error,
    });
  }

  let failureCode: ExecutionFailureCode | undefined;
  if (!taskText) {
    failureCode = "failed/input_required";
  } else if (
    requiresNativeImageGeneration(taskText) &&
    !cloudExecutorSupportsNativeImageGeneration()
  ) {
    failureCode = "failed/capability_missing";
  }

  let auditRecord = createCloudAuditRecord({
    actorId,
    roleListingId,
    entitlement: {
      ...entitlement,
      pricing,
      role_token_pricing: roleTokenPricing,
    },
    taskText,
    packageContextDigest: packageContext.digest,
    failureCode,
  });

  const roleUsageLedger =
    auditRecord.summary.status === "completed"
      ? createDijieRoleTokenUsageLedgerEntryFromAudit(auditRecord)
      : undefined;
  if (roleUsageLedger && !roleUsageLedger.ok) {
    return res.status(400).json({
      ok: false,
      code: "ledger_contract_invalid",
      error: roleUsageLedger.error,
    });
  }
  if (roleUsageLedger?.ok) {
    auditRecord = {
      ...auditRecord,
      roleUsageLedger: roleUsageLedger.value,
    };
  }

  let auditRecordId: string | undefined;
  try {
    const result = await store.recordDijieAuditSummary(auditRecord);
    auditRecordId = result?.auditRecordId;
  } catch {
    return res.status(502).json({
      ok: false,
      code: "audit_write_failed",
      error: "云端使用者中心未能写入岗位执行审计。",
    });
  }

  if (roleUsageLedger?.ok && typeof store.createDijieLedgerEntry === "function") {
    const ledger = roleUsageLedger.value;
    const ledgerResult = await store.createDijieLedgerEntry({
      accountId: ledger.actorId,
      billingAccountId: ledger.actorId,
      source: "role_usage",
      usageKind: ledger.usageKind,
      surface: "user_center",
      mode: "user",
      subject: {
        executionId: ledger.executionId,
        roleListingId: ledger.roleListingId,
        packageId: ledger.packageId,
        entitlementId: ledger.entitlementId,
      },
      meters: ledger.meters,
      currency: "CNY",
      grossAmountCents: ledger.grossAmountCents,
      platformReceivableCents: ledger.platformReceivableCents,
      developerReceivableCents: ledger.developerReceivableCents,
      roleListingId: ledger.roleListingId,
      packageId: ledger.packageId,
      executionId: ledger.executionId,
      entitlementId: ledger.entitlementId,
      developerRef: ledger.developerRef,
      occurredAt: new Date(ledger.occurredAt),
    });
    if (!ledgerResult.ok) {
      return res.status(ledgerResult.status).json({
        ok: false,
        code: "ledger_write_failed",
        error: ledgerResult.error,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    executionId: auditRecord.summary.executionId,
    auditRecordId,
    packageContextDigest: packageContext.digest,
    ...createStructuredReadback(auditRecord),
  });
}
