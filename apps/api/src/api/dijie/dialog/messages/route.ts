import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { resolveDijieAccessContext } from "../../../../lib/dijie/access-context";
import type { DijieAccountAccessProfileReader } from "../../../../lib/dijie/account-access-store";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
import {
  canReviewDijieRoles,
  canUseDijieLocalSystem,
  hasDijieGlobalDataAccess,
  type DijieAccessContext,
} from "../../../../lib/dijie/data-permissions";
import { getDijieDialogCapabilityPolicy } from "../../../../lib/dijie/dialog-capability-policy";
import { resolveDijieOpenClawDialogModelBridge } from "../../../../lib/dijie/openclaw-model-bridge-resolver";
import {
  createDijieDialogTurnReadModel,
  type DijieDialogSessionStore,
} from "../../../../lib/dijie/dialog-session-store";
import {
  createDijieDialogContext,
  normalizeDijieDialogContext,
  type DijieDialogContext,
  type DijieDialogAccountType,
  type DijieDialogMode,
  type DijieDialogSurface,
} from "../../../../lib/dijie/dialog-context";
import { createDijieDialogMessageResponse } from "../../../../lib/dijie/dialog-messages";
import {
  generateDijieRolePackageDraftWithModel,
  isDijieRolePackageGenerationIntent,
} from "../../../../lib/dijie/role-package-generator";
import {
  createDijieRolePackageDraftReadModel,
  type DijieRolePackageDraftReader,
  type DijieRolePackageDraftStore,
} from "../../../../lib/dijie/role-package-draft-store";
import { listDijieRoleListings } from "../../../../lib/dijie/role-listings";

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

function actorIdFromRequest(req: MedusaRequest): string | undefined {
  const authContext = (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
  return authContext ? stringField(authContext, "actor_id") : undefined;
}

function authContextFromRequest(req: MedusaRequest): UnknownRecord | undefined {
  return (req as MedusaRequest & { auth_context?: UnknownRecord }).auth_context;
}

function isAccountAccessProfileReader(
  value: unknown,
): value is DijieAccountAccessProfileReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { retrieveDijieAccountAccessProfile?: unknown })
      .retrieveDijieAccountAccessProfile === "function"
  );
}

function resolveAccountAccessProfileReader(
  req: MedusaRequest,
): DijieAccountAccessProfileReader | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isAccountAccessProfileReader(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

function isDialogSessionStore(value: unknown): value is DijieDialogSessionStore {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { recordDijieDialogTurn?: unknown }).recordDijieDialogTurn ===
      "function"
  );
}

function isRolePackageDraftStore(
  value: unknown,
): value is DijieRolePackageDraftStore & DijieRolePackageDraftReader {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { createDijieRolePackageDraft?: unknown }).createDijieRolePackageDraft ===
      "function" &&
    typeof (value as { retrieveLatestDijieRolePackageDraft?: unknown })
      .retrieveLatestDijieRolePackageDraft === "function"
  );
}

function resolveDialogSessionStore(req: MedusaRequest): DijieDialogSessionStore | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isDialogSessionStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

function resolveRolePackageDraftStore(
  req: MedusaRequest,
): (DijieRolePackageDraftStore & DijieRolePackageDraftReader) | undefined {
  try {
    const service = req.scope.resolve(DIJIE_AUDIT_MODULE) as unknown;
    return isRolePackageDraftStore(service) ? service : undefined;
  } catch {
    return undefined;
  }
}

function accountTypeForSurface(surface: DijieDialogSurface): DijieDialogAccountType {
  if (surface === "admin_review") {
    return "admin";
  }
  if (surface === "developer_center") {
    return "developer";
  }
  return "buyer";
}

function modeForSurface(surface: DijieDialogSurface): DijieDialogMode {
  if (surface === "admin_review") {
    return "review";
  }
  if (surface === "developer_center") {
    return "developer";
  }
  return "user";
}

function surfaceFromBody(body: UnknownRecord): DijieDialogSurface | undefined {
  const surface = stringField(body, "surface");
  return surface === "buyer_storefront" ||
    surface === "user_center" ||
    surface === "developer_center" ||
    surface === "admin_review" ||
    surface === "openclaw_local"
    ? surface
    : undefined;
}

function contextFromRequest(
  req: MedusaRequest,
  body: UnknownRecord,
  access: DijieAccessContext | null,
): DijieDialogContext | null {
  const actorId = actorIdFromRequest(req);
  const explicitContext = normalizeDijieDialogContext(body.context);
  if (explicitContext) {
    if (
      !access ||
      (explicitContext.accountId !== access.accountId && !hasDijieGlobalDataAccess(access))
    ) {
      return null;
    }
    return createDijieDialogContext({
      accountId: explicitContext.accountId,
      accountType: explicitContext.accountType,
      surface: explicitContext.surface,
      mode: explicitContext.mode,
      subject: explicitContext.subject,
      billingAccountId: access?.billingAccountId ?? explicitContext.accountId,
    });
  }

  const surface = surfaceFromBody(body);
  if (!actorId || !surface) {
    return null;
  }
  return createDijieDialogContext({
    accountId: actorId,
    accountType: accountTypeForSurface(surface),
    surface,
    mode: modeForSurface(surface),
    subject: asRecord(body.subject),
    billingAccountId: access?.billingAccountId ?? actorId,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = asRecord(req.body);
  const message = stringField(body, "message");
  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "对话消息不能为空。",
    });
  }

  const access = await resolveDijieAccessContext({
    authContext: authContextFromRequest(req),
    profileReader: resolveAccountAccessProfileReader(req),
  });
  const context = contextFromRequest(req, body, access);
  if (!context) {
    return res.status(401).json({
      ok: false,
      error: "发送对话消息需要登录账号并提供对话入口。",
    });
  }
  const capabilityPolicy = getDijieDialogCapabilityPolicy(context);
  if (capabilityPolicy.requiresMarketplaceOwnerAccess && (!access || !canReviewDijieRoles(access))) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有审核助手数据权限。",
    });
  }
  if (capabilityPolicy.requiresLocalSystemAccess && (!access || !canUseDijieLocalSystem(access))) {
    return res.status(403).json({
      ok: false,
      error: "当前账号没有本地主系统数据权限。",
    });
  }

  try {
    const query = req.scope.resolve("query");
    const dialogStore = resolveDialogSessionStore(req);
    if (!dialogStore) {
      return res.status(503).json({
        ok: false,
        error: "迭界AI对话会话存储暂未配置。",
      });
    }
    const roles =
      context.surface === "buyer_storefront"
        ? await listDijieRoleListings((queryInput) => query.graph(queryInput))
        : [];
    const fallbackReply = createDijieDialogMessageResponse({
      context,
      message,
      roles,
    });
    const modelBridge = resolveDijieOpenClawDialogModelBridge(req);
    if (
      context.surface === "developer_center" &&
      isDijieRolePackageGenerationIntent(message)
    ) {
      if (!modelBridge) {
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
      const latestDraft = await draftStore.retrieveLatestDijieRolePackageDraft({
        ownerId: context.accountId,
      });
      const generation = await generateDijieRolePackageDraftWithModel({
        bridge: modelBridge,
        context,
        billingPolicy: fallbackReply.billingPolicy,
        message,
        previousDraftSummary: latestDraft
          ? `draftId=${latestDraft.id}; package=${latestDraft.package_id ?? "unknown"}; status=${latestDraft.draft_status}`
          : undefined,
      });
      if (!generation.ok) {
        return res.status(generation.status).json({
          ok: false,
          error: generation.error,
          issues: generation.issues,
          modelUsage: generation.modelUsage ?? null,
          modelCalled: true,
        });
      }

      const storedDraft = await draftStore.createDijieRolePackageDraft({
        ownerId: context.accountId,
        sourceMessage: message,
        files: generation.value.files,
        uploadSummary: generation.value.uploadSummary,
        capabilityReport: generation.value.capabilityReport,
        qualityReport: generation.value.qualityReport,
        uploadValidationIssues: generation.value.uploadValidationIssues,
        blockingIssues: [],
        modelUsage: generation.value.modelUsage,
      });
      const draftRecord = storedDraft.draftId
        ? await draftStore.retrieveDijieRolePackageDraft({
            draftId: storedDraft.draftId,
            ownerId: context.accountId,
          })
        : undefined;
      const draftReadModel = draftRecord
        ? createDijieRolePackageDraftReadModel(draftRecord)
        : undefined;
      const assistantReply = {
        reply: draftReadModel
          ? `已生成岗位包草稿 ${draftReadModel.packageId ?? draftReadModel.draftId}，包含 ${draftReadModel.fileCount} 个文件，质量评分 ${draftReadModel.qualityReport.score}。请到上传岗位页确认并提交。`
          : "已生成岗位包草稿，请到上传岗位页确认并提交。",
        grounding: { roles: [], source: "dialog_context" as const },
        billingPolicy: fallbackReply.billingPolicy,
        modelUsage: generation.value.modelUsage,
        modelCalled: true,
      };
      const recorded = await dialogStore.recordDijieDialogTurn({
        sessionId: stringField(body, "sessionId") ?? stringField(body, "session_id"),
        context,
        capabilityPolicy,
        userMessage: message,
        assistantReply,
      });
      if (!recorded.ok) {
        return res.status(recorded.status).json({
          ok: false,
          error: recorded.error,
        });
      }
      const turn = createDijieDialogTurnReadModel(recorded.value);

      return res.status(200).json({
        ok: true,
        sessionId: recorded.value.session.id,
        ledgerEntryId: recorded.value.ledgerEntry.id,
        context,
        message: {
          role: "assistant",
          content: assistantReply.reply,
        },
        grounding: assistantReply.grounding,
        billingPolicy: assistantReply.billingPolicy,
        capabilityPolicy,
        persisted: turn,
        modelUsage: assistantReply.modelUsage,
        modelCalled: assistantReply.modelCalled,
        rolePackageDraft: draftReadModel,
      });
    }
    const modelResult =
      fallbackReply.billingPolicy.modelAllowed && modelBridge
        ? await modelBridge.completeDijieDialogMessage({
            context,
            billingPolicy: fallbackReply.billingPolicy,
            message,
            fallbackReply: fallbackReply.reply,
            roles: fallbackReply.grounding.roles,
          })
        : null;
    const reply = modelResult
      ? createDijieDialogMessageResponse({
          context,
          message,
          roles,
          modelResult,
        })
      : fallbackReply;
    const recorded = await dialogStore.recordDijieDialogTurn({
      sessionId: stringField(body, "sessionId") ?? stringField(body, "session_id"),
      context,
      capabilityPolicy,
      userMessage: message,
      assistantReply: reply,
    });
    if (!recorded.ok) {
      return res.status(recorded.status).json({
        ok: false,
        error: recorded.error,
      });
    }
    const turn = createDijieDialogTurnReadModel(recorded.value);

    return res.status(200).json({
      ok: true,
      sessionId: recorded.value.session.id,
      ledgerEntryId: recorded.value.ledgerEntry.id,
      context,
      message: {
        role: "assistant",
        content: reply.reply,
      },
      grounding: reply.grounding,
      billingPolicy: reply.billingPolicy,
      capabilityPolicy,
      persisted: turn,
      modelUsage: reply.modelUsage,
      modelCalled: reply.modelCalled,
    });
  } catch {
    return res.status(502).json({
      ok: false,
      error: "迭界AI对话服务暂时无法读取后端数据。",
    });
  }
}
