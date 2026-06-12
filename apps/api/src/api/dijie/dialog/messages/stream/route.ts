import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  DIJIE_OPENCLAW_MODEL_BRIDGE,
  type DijieOpenClawDialogModelBridge,
  type DijieOpenClawDialogModelInput,
  type DijieOpenClawDialogModelResult,
} from "../../../../../lib/dijie/dialog-model-bridge";
import { createDijieOpenAiStreamingModelBridgeFromEnv } from "../../../../../lib/dijie/openai-streaming-model-bridge";
import { resolveDijieOpenClawDialogModelBridge } from "../../../../../lib/dijie/openclaw-model-bridge-resolver";
import { isDijieRolePackageGenerationIntent } from "../../../../../lib/dijie/role-package-generator";
import { POST as postDialogMessage } from "../route";

type UnknownRecord = Record<string, unknown>;

type CapturedResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => CapturedResponse;
  json: (body: unknown) => unknown;
};

type WritableMedusaResponse = MedusaResponse & {
  flushHeaders?: () => void;
  setHeader?: (name: string, value: string) => void;
  write?: (chunk: string) => void;
  end?: () => void;
};

const FALLBACK_STATUS_MS = 10_000;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createCapturedResponse(): CapturedResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function writeSseEvent(
  res: WritableMedusaResponse,
  event: "status" | "fallback" | "delta" | "final" | "error" | "metrics",
  data: UnknownRecord,
) {
  res.write?.(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function hasStreamMethod(
  bridge: DijieOpenClawDialogModelBridge | undefined,
): bridge is DijieOpenClawDialogModelBridge & {
  streamDijieDialogMessage: NonNullable<DijieOpenClawDialogModelBridge["streamDijieDialogMessage"]>;
} {
  return typeof bridge?.streamDijieDialogMessage === "function";
}

function shouldAttemptTrueStreaming(body: UnknownRecord) {
  const surface = stringField(body, "surface") ?? "developer_center";
  const message = stringField(body, "message") ?? "";
  return (
    (surface === "buyer_storefront" ||
      surface === "user_center" ||
      surface === "developer_center" ||
      surface === "admin_review") &&
    Boolean(message) &&
    !isDijieRolePackageGenerationIntent(message)
  );
}

function createStreamingBridge(
  req: MedusaRequest,
  res: WritableMedusaResponse,
  metrics: {
    markDelta: () => void;
    markStreamFallback: () => void;
  },
): DijieOpenClawDialogModelBridge | undefined {
  const baseBridge = resolveDijieOpenClawDialogModelBridge(req);
  const streamBridge = hasStreamMethod(baseBridge)
    ? baseBridge
    : createDijieOpenAiStreamingModelBridgeFromEnv();

  if (!hasStreamMethod(streamBridge)) {
    return undefined;
  }

  return {
    async completeDijieDialogMessage(
      input: DijieOpenClawDialogModelInput,
    ): Promise<DijieOpenClawDialogModelResult> {
      try {
        return await streamBridge.streamDijieDialogMessage(input, {
          onDelta: (text) => {
            if (!text) {
              return;
            }
            metrics.markDelta();
            writeSseEvent(res, "delta", { ok: true, text });
          },
        });
      } catch {
        metrics.markStreamFallback();
        writeSseEvent(res, "fallback", {
          ok: true,
          phase: "stream_fallback",
          surface: input.context.surface,
          message: "真流式通道暂不可用，我切回完整回复继续回答。",
        });

        const completeBridge = baseBridge ?? streamBridge;
        return completeBridge.completeDijieDialogMessage(input);
      }
    },
  };
}

function requestWithModelBridge(
  req: MedusaRequest,
  bridge: DijieOpenClawDialogModelBridge,
): MedusaRequest {
  const originalScope = req.scope;
  const resolveFromOriginalScope = originalScope.resolve.bind(originalScope) as (
    name: string,
    ...args: unknown[]
  ) => unknown;
  return {
    ...req,
    scope: {
      ...originalScope,
      resolve(name: string, ...args: unknown[]) {
        if (name === DIJIE_OPENCLAW_MODEL_BRIDGE) {
          return bridge;
        }
        return resolveFromOriginalScope(name, ...args);
      },
    },
  } as MedusaRequest;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const streamRes = res as WritableMedusaResponse;

  if (typeof streamRes.write !== "function") {
    const captured = createCapturedResponse();
    await postDialogMessage(req, captured as unknown as MedusaResponse);
    return res.status(captured.statusCode).json(captured.body);
  }

  streamRes.status(200);
  streamRes.setHeader?.("Content-Type", "text/event-stream; charset=utf-8");
  streamRes.setHeader?.("Cache-Control", "no-cache, no-transform");
  streamRes.setHeader?.("Connection", "keep-alive");
  streamRes.setHeader?.("X-Accel-Buffering", "no");
  streamRes.flushHeaders?.();

  const body = asRecord(req.body);
  const surface = stringField(body, "surface") ?? "developer_center";
  const startedAt = Date.now();
  let firstDeltaAt: number | undefined;
  let deltaCount = 0;
  let fallbackSent = false;
  let streamPath: "true_stream" | "complete" | "stream_fallback" = "complete";
  let settled = false;
  const fallbackTimer = setTimeout(() => {
    if (settled) {
      return;
    }
    fallbackSent = true;
    writeSseEvent(streamRes, "fallback", {
      ok: true,
      phase: "model_waiting",
      surface,
      message: "这个问题需要稍微分析，我会继续等模型完成，不让对话卡死。",
    });
  }, FALLBACK_STATUS_MS);

  try {
    writeSseEvent(streamRes, "status", {
      ok: true,
      phase: "accepted",
      surface,
      message: "我在理解你的意思，会先保持对话不断线。",
    });

    const captured = createCapturedResponse();
    const streamingBridge = shouldAttemptTrueStreaming(body)
      ? createStreamingBridge(req, streamRes, {
          markDelta: () => {
            deltaCount += 1;
            firstDeltaAt ??= Date.now();
            streamPath = "true_stream";
          },
          markStreamFallback: () => {
            fallbackSent = true;
            streamPath = "stream_fallback";
          },
        })
      : undefined;
    if (streamingBridge) {
      streamPath = "true_stream";
    }
    const requestForDialog = streamingBridge
      ? requestWithModelBridge(req, streamingBridge)
      : req;
    await postDialogMessage(requestForDialog, captured as unknown as MedusaResponse);
    settled = true;
    clearTimeout(fallbackTimer);

    const finishedAt = Date.now();
    writeSseEvent(streamRes, "metrics", {
      ok: true,
      surface,
      streamPath,
      firstResponseMs: firstDeltaAt ? firstDeltaAt - startedAt : finishedAt - startedAt,
      firstDeltaMs: firstDeltaAt ? firstDeltaAt - startedAt : null,
      finalMs: finishedAt - startedAt,
      deltaCount,
      fallbackSent,
      terminalBeforeDelta: deltaCount === 0,
    });

    if (captured.statusCode >= 400) {
      writeSseEvent(streamRes, "error", {
        ok: false,
        status: captured.statusCode,
        ...(asRecord(captured.body).error
          ? { error: stringField(asRecord(captured.body), "error") }
          : {}),
        body: captured.body,
      });
      return streamRes.end?.();
    }

    writeSseEvent(streamRes, "final", asRecord(captured.body));
    return streamRes.end?.();
  } catch (error) {
    settled = true;
    clearTimeout(fallbackTimer);
    const finishedAt = Date.now();
    writeSseEvent(streamRes, "metrics", {
      ok: false,
      surface,
      streamPath,
      firstResponseMs: firstDeltaAt ? firstDeltaAt - startedAt : finishedAt - startedAt,
      firstDeltaMs: firstDeltaAt ? firstDeltaAt - startedAt : null,
      finalMs: finishedAt - startedAt,
      deltaCount,
      fallbackSent,
      terminalBeforeDelta: deltaCount === 0,
    });
    writeSseEvent(streamRes, "error", {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "迭界AI流式对话服务暂时不可用。",
    });
    return streamRes.end?.();
  }
}
