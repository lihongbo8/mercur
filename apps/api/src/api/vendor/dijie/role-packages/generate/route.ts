import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  createDijieDeveloperDialogContext,
  getDijieDialogBillingPolicy,
} from "../../../../../lib/dijie/dialog-context";
import {
  generateDijieRolePackageDraftWithModel,
} from "../../../../../lib/dijie/role-package-generator";
import { createDijieRolePackageDraftReadModel } from "../../../../../lib/dijie/role-package-draft-store";
import { persistDijieRolePackageBuildStage } from "../../../../../lib/dijie/role-package-build-session";
import {
  actorIdFromRequest,
  asRecord,
  resolveOpenClawDialogModelBridge,
  resolveRolePackageDraftStore,
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
  const maxStages =
    positiveIntegerField(body, "maxStages") ?? positiveIntegerField(body, "max_stages");
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

  let generatedDraftId: string | undefined = existingDraft?.id;
  const generation = await generateDijieRolePackageDraftWithModel({
    bridge,
    context,
    billingPolicy,
    message,
    initialFiles: existingDraft?.package_files ?? [],
    maxStages,
    previousDraftSummary: existingDraft
      ? [
          `draftId=${existingDraft.id}; package=${existingDraft.package_id ?? "unknown"}; status=${existingDraft.draft_status}; files=${existingDraft.file_manifest.map((file) => file.path).join(",")}`,
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
      });
      generatedDraftId = artifact.draftId;
    },
  });

  if (!generation.ok) {
    const partialDraftRecord = generatedDraftId
      ? await draftStore.retrieveDijieRolePackageDraft({
          draftId: generatedDraftId,
          ownerId: actorId,
        })
      : undefined;
    return res.status(generation.status).json({
      ok: false,
      error: generation.error,
      issues: generation.issues,
      diagnostics: generation.diagnostics,
      draft: partialDraftRecord ? createDijieRolePackageDraftReadModel(partialDraftRecord) : undefined,
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

  return res.status(200).json({
    ok: true,
    draft: record ? createDijieRolePackageDraftReadModel(record) : undefined,
    files: generation.value.files,
    manifestSummary: generation.value.uploadSummary?.manifestSummary,
    capabilityReport: generation.value.capabilityReport,
    qualityReport: generation.value.qualityReport,
    uploadValidationIssues: generation.value.uploadValidationIssues,
    modelUsage: generation.value.modelUsage,
    modelCalled: true,
    complete: generation.complete,
  });
}
