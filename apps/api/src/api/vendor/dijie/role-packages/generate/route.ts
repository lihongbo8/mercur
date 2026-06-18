import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieDeveloperDialogContext,
  getDijieDialogBillingPolicy,
} from "../../../../../lib/dijie/dialog-context";
import { createDijieRoleCategoryRegistry, validateDijieRoleCategoryIntegration } from "../../../../../lib/dijie/role-category-registry";
import {
  generateDijieRolePackageDraftWithModel,
} from "../../../../../lib/dijie/role-package-generator";
import { createDijieRolePackageDraftReadModel } from "../../../../../lib/dijie/role-package-draft-store";
import { persistDijieRolePackageBuildStage } from "../../../../../lib/dijie/role-package-build-session";
import {
  actorIdFromRequest,
  asRecord,
  resolveCatalogReader,
  resolveCatalogReviewStore,
  resolveOpenClawDialogModelBridge,
  resolveRolePackageDraftStore,
  resolveRoleCategoryReader,
  stringField,
} from "../route-utils";

function positiveIntegerField(record: Record<string, unknown>, field: string): number | undefined {
  const value = record[field];
  if (Number.isInteger(value) && (value as number) > 0) {
    return value as number;
  }
  if (typeof value === "string" && /^\d+$/u.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

function booleanField(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  return value === true || value === "true" || value === 1 || value === "1";
}

function compactText(value: string, maxLength = 2_400): string {
  const compacted = value.replace(/\s+/gu, " ").trim();
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength)}...` : compacted;
}

function createRequestAbortSignal(req: MedusaRequest, res: MedusaResponse) {
  const controller = new AbortController();
  const request = req as MedusaRequest & {
    aborted?: boolean;
    on?: (event: "aborted" | "close", listener: () => void) => void;
    off?: (event: "aborted" | "close", listener: () => void) => void;
  };
  const response = res as MedusaResponse & {
    writableEnded?: boolean;
    on?: (event: "close", listener: () => void) => void;
    off?: (event: "close", listener: () => void) => void;
  };
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  const abortIfResponseClosed = () => {
    if (!response.writableEnded) {
      abort();
    }
  };

  if (request.aborted) {
    abort();
  }
  request.on?.("aborted", abort);
  response.on?.("close", abortIfResponseClosed);

  return {
    signal: controller.signal,
    cleanup: () => {
      request.off?.("aborted", abort);
      response.off?.("close", abortIfResponseClosed);
    },
  };
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = actorIdFromRequest(req);
  if (!actorId) {
    return res.status(401).json({
      ok: false,
      error: "生成岗位包需要登录开发者账号。",
    });
  }

  const body = asRecord(req.body);
  const message = stringField(body, "message") ?? stringField(body, "prompt");
  const draftId = stringField(body, "draftId") ?? stringField(body, "draft_id");
  const requestedCategoryRef =
    stringField(body, "categoryRef") ?? stringField(body, "category_ref");
  const maxStages =
    positiveIntegerField(body, "maxStages") ?? positiveIntegerField(body, "max_stages");
  const stageTimeoutMs =
    positiveIntegerField(body, "stageTimeoutMs") ??
    positiveIntegerField(body, "stage_timeout_ms");
  const startNew = booleanField(body, "startNew") || booleanField(body, "start_new");
  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "岗位开发需求不能为空。",
    });
  }

  const bridge = resolveOpenClawDialogModelBridge(req);
  if (!bridge) {
    return res.status(503).json({
      ok: false,
      error: "AI开发助手模型桥暂未配置，不能生成岗位包。",
    });
  }

  const draftStore = resolveRolePackageDraftStore(req);
  if (!draftStore) {
    return res.status(503).json({
      ok: false,
      error: "岗位包草稿存储暂未配置。",
    });
  }
  const catalogReader = resolveCatalogReader(req);
  const catalogReviewStore = resolveCatalogReviewStore(req);
  const catalogItems = catalogReader
    ? await catalogReader.listDijieEffectiveCatalogItems()
    : undefined;

  const context = createDijieDeveloperDialogContext({ developerAccountId: actorId });
  const billingPolicy = getDijieDialogBillingPolicy(context);
  const existingDraft = draftId
    ? await draftStore.retrieveDijieRolePackageDraft({ draftId, ownerId: actorId })
    : startNew
      ? undefined
      : await draftStore.retrieveLatestDijieRolePackageDraft({ ownerId: actorId });
  if (draftId && !existingDraft) {
    return res.status(404).json({
      ok: false,
      error: "未找到可继续生成的岗位包草稿。",
    });
  }
  if (existingDraft?.draft_status === "submitted") {
    return res.status(409).json({
      ok: false,
      error: "岗位包草稿已提交，不能继续生成。",
    });
  }
  const existingCategoryRef = existingDraft?.manifest_summary?.categoryRef;
  if (
    requestedCategoryRef &&
    existingCategoryRef &&
    requestedCategoryRef !== existingCategoryRef &&
    !startNew
  ) {
    return res.status(409).json({
      ok: false,
      error: "继续生成已有草稿时不能切换平台品类；如需更换品类，请重新开始生成。",
    });
  }
  const categoryRef = requestedCategoryRef ?? existingCategoryRef;
  if (!categoryRef) {
    return res.status(400).json({
      ok: false,
      error: "生成岗位包前必须先选择平台已审核品类。",
      issues: ["categoryRef_required"],
    });
  }
  const roleCategoryReader = resolveRoleCategoryReader(req);
  if (!roleCategoryReader) {
    return res.status(503).json({
      ok: false,
      error: "平台岗位品类存储暂未配置，不能生成岗位包。",
    });
  }
  const categoryRegistry = createDijieRoleCategoryRegistry(
    await roleCategoryReader.listDijieRoleCategories(),
  );
  const categoryCheck = validateDijieRoleCategoryIntegration({
    categoryRef,
    registry: categoryRegistry,
  });
  if (!categoryCheck.ok || !categoryCheck.category) {
    return res.status(409).json({
      ok: false,
      error: categoryCheck.error ?? "岗位绑定的平台品类暂不可用。",
      issues: [...categoryCheck.missing, ...categoryCheck.blocked],
      blockedReasons: [...categoryCheck.missing, ...categoryCheck.blocked],
    });
  }

  let generatedDraftId: string | undefined = existingDraft?.id;
  const requestAbort = createRequestAbortSignal(req, res);
  let generation: Awaited<ReturnType<typeof generateDijieRolePackageDraftWithModel>>;
  try {
    generation = await generateDijieRolePackageDraftWithModel({
      bridge,
      context,
      billingPolicy,
      message,
      catalogItems,
      categoryContext: {
        category: categoryCheck.category,
        inheritedCatalogRefs: categoryCheck.inheritedCatalogRefs,
        inheritedCapabilityRefs: categoryCheck.inheritedCapabilityRefs,
      },
      initialFiles: existingDraft?.package_files ?? [],
      maxStages,
      stageTimeoutMs,
      signal: requestAbort.signal,
      previousDraftSummary: existingDraft
        ? [
            `draftId=${existingDraft.id}; package=${existingDraft.package_id ?? "unknown"}; status=${existingDraft.draft_status}; files=${existingDraft.file_manifest.map((file) => file.path).join(",")}`,
            `平台品类：${categoryCheck.category.name} / ${categoryCheck.category.categoryRef}`,
            `原始开发规格摘要：${compactText(existingDraft.source_message)}`,
          ].join("\n")
        : undefined,
      onStageFiles: async ({ stage, allFiles, modelUsage }) => {
        const artifact = await persistDijieRolePackageBuildStage({
          draftStore,
          draftId: generatedDraftId,
          ownerId: actorId,
          sourceMessage: message,
          files: allFiles,
          stage,
          modelUsage,
          catalogItems,
        });
        generatedDraftId = artifact.draftId;
      },
    });
  } finally {
    requestAbort.cleanup();
  }

  if (!generation.ok) {
    const partialDraftRecord = generatedDraftId
      ? await draftStore.retrieveDijieRolePackageDraft({
          draftId: generatedDraftId,
          ownerId: actorId,
        })
      : undefined;
    const catalogReviewRequests =
      generation.capabilityReport?.capabilityPlan && catalogReviewStore
        ? await catalogReviewStore.createDijieCatalogReviewRequestsForPlan({
            plan: generation.capabilityReport.capabilityPlan,
            rolePackageId: partialDraftRecord?.package_id ?? generatedDraftId ?? null,
            requestedBy: actorId,
          })
        : [];
    return res.status(generation.status).json({
      ok: false,
      error: generation.error,
      issues: generation.issues,
      diagnostics: generation.diagnostics,
      draft: partialDraftRecord
        ? createDijieRolePackageDraftReadModel(partialDraftRecord, { catalogReviewRequests })
        : undefined,
      roleRequirementSpec: generation.capabilityReport?.requirementSpec,
      roleCapabilityPlan: generation.capabilityReport?.capabilityPlan,
      skillToolReviewRequests:
        generation.capabilityReport?.capabilityGaps ?? catalogReviewRequests,
      catalogReviewRequests,
      blockedReasons:
        generation.capabilityReport?.reviewBlockers ??
        generation.capabilityReport?.blockedReasons,
      modelUsage: generation.modelUsage ?? null,
      modelCalled: true,
    });
  }

  if (!generatedDraftId) {
    const stored = await draftStore.createDijieRolePackageDraft({
      ownerId: actorId,
      sourceMessage: message,
      files: generation.value.files,
      status: generation.complete ? undefined : "partial",
      uploadSummary: generation.value.uploadSummary,
      capabilityReport: generation.value.capabilityReport,
      qualityReport: generation.value.qualityReport,
      uploadValidationIssues: generation.value.uploadValidationIssues,
      blockingIssues: [],
      modelUsage: generation.value.modelUsage,
    });
    generatedDraftId = stored.draftId;
  } else if (generation.complete) {
    const updated = await draftStore.updateDijieRolePackageDraft({
      draftId: generatedDraftId,
      ownerId: actorId,
      files: generation.value.files,
      status: "ready",
      uploadSummary: generation.value.uploadSummary,
      capabilityReport: generation.value.capabilityReport,
      qualityReport: generation.value.qualityReport,
      uploadValidationIssues: generation.value.uploadValidationIssues,
      blockingIssues: [],
      modelUsage: generation.value.modelUsage,
    });
    if (!updated.ok) {
      return res.status(updated.status).json({
        ok: false,
        error: updated.error,
        issues: ["draft_store_update_failed"],
        modelUsage: generation.value.modelUsage,
        modelCalled: true,
      });
    }
  }
  const record = generatedDraftId
    ? await draftStore.retrieveDijieRolePackageDraft({
        draftId: generatedDraftId,
        ownerId: actorId,
      })
    : undefined;
  const catalogReviewRequests = catalogReviewStore && generation.value.capabilityReport.capabilityPlan
    ? await catalogReviewStore.createDijieCatalogReviewRequestsForPlan({
        plan: generation.value.capabilityReport.capabilityPlan,
        rolePackageId:
          generation.value.uploadSummary?.packageId ??
          record?.package_id ??
          generatedDraftId ??
          null,
        requestedBy: actorId,
      })
    : [];

  return res.status(200).json({
    ok: true,
    draft: record ? createDijieRolePackageDraftReadModel(record, { catalogReviewRequests }) : undefined,
    files: generation.value.files,
    manifestSummary: generation.value.uploadSummary?.manifestSummary,
    capabilityReport: generation.value.capabilityReport,
    roleRequirementSpec: generation.value.capabilityReport.requirementSpec,
    roleCapabilityPlan: generation.value.capabilityReport.capabilityPlan,
    skillToolReviewRequests: generation.value.capabilityReport.capabilityGaps ?? [],
    catalogReviewRequests,
    blockedReasons:
      generation.value.capabilityReport.reviewBlockers ??
      generation.value.capabilityReport.blockedReasons,
    qualityReport: generation.value.qualityReport,
    uploadValidationIssues: generation.value.uploadValidationIssues,
    modelUsage: generation.value.modelUsage,
    modelCalled: true,
    complete: generation.complete,
  });
}
