import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  DijieOpenClawDialogModelBridge,
  DijieOpenClawDialogModelResult,
} from "./dialog-model-bridge";

const execFileAsync = promisify(execFile);

type UnknownRecord = Record<string, unknown>;

type OpenClawCliBridgeOptions = {
  cliPath?: string;
  mode?: "local" | "gateway";
  model?: string;
  fastModel?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

function extractJsonObjectText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : undefined;
}

function stringFromOpenClawOutputValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const record = asRecord(value);
  return (
    stringField(record, "text") ??
    stringField(record, "reply") ??
    stringField(record, "content") ??
    stringField(record, "output")
  );
}

function textFromOpenClawOutputs(record: UnknownRecord): string | undefined {
  const outputs = record.outputs;
  if (!Array.isArray(outputs)) {
    return undefined;
  }

  const texts = outputs.flatMap((output) => {
    const text = stringFromOpenClawOutputValue(output);
    return text ? [text] : [];
  });
  return texts.length > 0 ? texts.join("\n") : undefined;
}

function replyFromOpenClawOutput(stdout: string): string {
  const jsonText = extractJsonObjectText(stdout);
  if (!jsonText) {
    return stdout.trim();
  }

  try {
    const parsed = asRecord(JSON.parse(jsonText));
    return (
      stringField(parsed, "reply") ??
      stringField(parsed, "text") ??
      stringField(parsed, "content") ??
      textFromOpenClawOutputs(parsed) ??
      stringFromOpenClawOutputValue(parsed.output) ??
      stdout.trim()
    );
  } catch {
    return stdout.trim();
  }
}

function usageFromOpenClawOutput(stdout: string, modelOverride?: string) {
  const jsonText = extractJsonObjectText(stdout);
  let parsed: UnknownRecord = {};
  if (jsonText) {
    try {
      parsed = asRecord(JSON.parse(jsonText));
    } catch {
      parsed = {};
    }
  }

  const usage = asRecord(parsed.usage ?? parsed.modelUsage);
  const providerModel = stringField(parsed, "model") ?? stringField(usage, "model") ?? modelOverride;
  const [provider, ...modelParts] = providerModel?.includes("/")
    ? providerModel.split("/")
    : [stringField(parsed, "provider") ?? stringField(usage, "provider") ?? "openclaw", providerModel ?? "unknown"];
  const model = modelParts.join("/") || providerModel || "unknown";

  return {
    provider,
    model,
    requestCount: nonNegativeInteger(parsed.requestCount ?? usage.requestCount) ?? 1,
    promptTokens:
      nonNegativeInteger(parsed.promptTokens ?? parsed.inputTokens ?? usage.promptTokens ?? usage.inputTokens) ??
      0,
    completionTokens:
      nonNegativeInteger(
        parsed.completionTokens ?? parsed.outputTokens ?? usage.completionTokens ?? usage.outputTokens,
      ) ?? 0,
    cacheReadTokens: nonNegativeInteger(parsed.cacheReadTokens ?? usage.cacheReadTokens) ?? 0,
    cacheWriteTokens: nonNegativeInteger(parsed.cacheWriteTokens ?? usage.cacheWriteTokens) ?? 0,
    totalTokens:
      nonNegativeInteger(parsed.totalTokens ?? usage.totalTokens) ??
      nonNegativeInteger(parsed.tokens ?? usage.tokens) ??
      0,
    pricing: {
      pricingKnown: false,
      pricingSource: "missing",
    },
  };
}

function sanitizeCliError(error: unknown): string {
  const record = asRecord(error);
  const stderr = stringField(record, "stderr");
  const message = stringField(record, "message");
  const signal = stringField(record, "signal");
  const code = record.code;
  const killed = record.killed === true;
  if (killed || signal === "SIGTERM" || code === "ETIMEDOUT") {
    return "OpenClaw CLI 调用超过长任务等待上限。";
  }
  if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return "OpenClaw CLI 输出超过系统可接收大小，请拆小当前阶段或提高输出上限。";
  }
  const raw = stderr ?? message ?? "OpenClaw CLI 调用失败";
  const ansiEscapePattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;:]*m`, "gu");
  const withoutAnsi = raw.replace(ansiEscapePattern, "");
  const withoutNodeWarnings = withoutAnsi
    .split(/\r?\n/u)
    .filter((line) => !/^\(node:\d+\) Warning:/u.test(line) && !/Use `node --trace-warnings/u.test(line))
    .join("\n");

  return withoutNodeWarnings
    .replace(
      /\b(api[_-]?key|provider[_-]?auth|secret|token)\s*[:=]\s*["']?[^"'\s,;]+/giu,
      "$1=[redacted]",
    )
    .replace(/\b(token)\s+[^"'\s,;]+/giu, "$1 [redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 700) || (
      killed || signal === "SIGTERM" || code === "ETIMEDOUT"
        ? "OpenClaw CLI 调用超时。"
        : "OpenClaw CLI 调用失败，但未返回可展示的错误详情。"
    );
}

export function createDijieOpenClawCliModelBridge(
  options: OpenClawCliBridgeOptions = {},
): DijieOpenClawDialogModelBridge {
  const cliPath = options.cliPath ?? "openclaw";
  const mode = options.mode ?? "local";
  const timeoutMs = options.timeoutMs ?? 30 * 60_000;
  const maxBufferBytes = options.maxBufferBytes ?? 25 * 1024 * 1024;

  return {
    async completeDijieDialogMessage(input): Promise<DijieOpenClawDialogModelResult> {
      const selectedModel =
        input.latencyClass === "fast_interaction"
          ? options.fastModel ?? options.model
          : options.model;
      const args = [
        "capability",
        "model",
        "run",
        mode === "gateway" ? "--gateway" : "--local",
        "--json",
        "--prompt",
        input.message,
      ];
      if (selectedModel) {
        args.push("--model", selectedModel);
      }

      try {
        const { stdout } = await execFileAsync(cliPath, args, {
          timeout: timeoutMs,
          maxBuffer: maxBufferBytes,
          signal: input.signal,
        });
        return {
          reply: replyFromOpenClawOutput(stdout),
          usage: usageFromOpenClawOutput(stdout, selectedModel),
        };
      } catch (error) {
        const bridgeError = new Error(`OpenClaw 模型桥调用失败：${sanitizeCliError(error)}`);
        (bridgeError as Error & { cause?: unknown }).cause = error;
        throw bridgeError;
      }
    },
  };
}

export function createDijieOpenClawCliModelBridgeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DijieOpenClawDialogModelBridge | undefined {
  const enabled = env.DIJIE_OPENCLAW_MODEL_BRIDGE ?? env.DIJIE_OPENCLAW_MODEL_BRIDGE_MODE;
  if (enabled !== "cli" && enabled !== "openclaw-cli") {
    return undefined;
  }

  return createDijieOpenClawCliModelBridge({
    cliPath: env.DIJIE_OPENCLAW_CLI_PATH,
    mode: env.DIJIE_OPENCLAW_MODEL_BRIDGE_EXECUTION === "gateway" ? "gateway" : "local",
    model: env.DIJIE_OPENCLAW_MODEL,
    fastModel: env.DIJIE_OPENCLAW_FAST_MODEL,
    timeoutMs: env.DIJIE_OPENCLAW_MODEL_TIMEOUT_MS
      ? Number.parseInt(env.DIJIE_OPENCLAW_MODEL_TIMEOUT_MS, 10)
      : undefined,
  });
}
