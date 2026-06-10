import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  DijieOpenClawDialogModelBridge,
  DijieOpenClawDialogModelInput,
  DijieOpenClawDialogModelResult,
} from "./dialog-model-bridge";

const execFileAsync = promisify(execFile);

type UnknownRecord = Record<string, unknown>;

type CodexCliBridgeOptions = {
  cliPath?: string;
  model?: string;
  fastModel?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  cwd?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  provider?: string;
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

function splitProviderModel(model: string | undefined, providerFallback: string) {
  if (!model) {
    return { provider: providerFallback, model: "codex-default" };
  }
  if (!model.includes("/")) {
    return { provider: providerFallback, model };
  }
  const [provider, ...modelParts] = model.split("/");
  return {
    provider: provider || providerFallback,
    model: modelParts.join("/") || model,
  };
}

function jsonEventsFromCodexOutput(stdout: string): UnknownRecord[] {
  return stdout
    .split(/\r?\n/u)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return [];
      }
      try {
        return [asRecord(JSON.parse(trimmed))];
      } catch {
        return [];
      }
    });
}

function replyFromCodexEvents(events: UnknownRecord[]): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type !== "item.completed") {
      continue;
    }
    const item = asRecord(event.item);
    const text = stringField(item, "text") ?? stringField(item, "content");
    if (text) {
      return text;
    }
  }

  return "";
}

function usageFromCodexEvents(events: UnknownRecord[], selectedModel: string | undefined, provider: string) {
  const completed = [...events].reverse().find((event) => event.type === "turn.completed");
  const usage = asRecord(completed?.usage);
  const promptTokens =
    nonNegativeInteger(usage.input_tokens ?? usage.inputTokens ?? usage.promptTokens) ?? 0;
  const completionTokens =
    nonNegativeInteger(usage.output_tokens ?? usage.outputTokens ?? usage.completionTokens) ?? 0;
  const cacheReadTokens =
    nonNegativeInteger(usage.cached_input_tokens ?? usage.cachedInputTokens ?? usage.cacheReadTokens) ?? 0;
  const { provider: usageProvider, model } = splitProviderModel(selectedModel, provider);

  return {
    provider: usageProvider,
    model,
    requestCount: 1,
    promptTokens,
    completionTokens,
    cacheReadTokens,
    cacheWriteTokens: 0,
    totalTokens:
      nonNegativeInteger(usage.total_tokens ?? usage.totalTokens) ??
      promptTokens + completionTokens + cacheReadTokens,
    pricing: {
      pricingKnown: false,
      pricingSource: "missing",
    },
  };
}

function sanitizeCliError(error: unknown): string {
  const record = asRecord(error);
  const stderr = stringField(record, "stderr");
  const stdout = stringField(record, "stdout");
  const message = stringField(record, "message");
  const signal = stringField(record, "signal");
  const code = record.code;
  const killed = record.killed === true;
  if (killed || signal === "SIGTERM" || code === "ETIMEDOUT") {
    return "Codex CLI 调用超过等待上限。";
  }
  if (code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return "Codex CLI 输出超过系统可接收大小。";
  }
  const raw = stderr ?? stdout ?? message ?? "Codex CLI 调用失败";
  const ansiEscapePattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;:]*m`, "gu");
  const withoutAnsi = raw.replace(ansiEscapePattern, "");

  return withoutAnsi
    .split(/\r?\n/u)
    .filter((line) => !/^\d{4}-\d{2}-\d{2}T/u.test(line))
    .join("\n")
    .replace(
      /\b(api[_-]?key|provider[_-]?auth|secret|token|bearer|access|refresh)\s*[:=]\s*["']?[^"'\s,;]+/giu,
      "$1=[redacted]",
    )
    .replace(/\b(token|bearer)\s+[^"'\s,;]+/giu, "$1 [redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 700) || "Codex CLI 调用失败，但未返回可展示的错误详情。";
}

function selectedModelForInput(input: DijieOpenClawDialogModelInput, options: CodexCliBridgeOptions) {
  return input.latencyClass === "fast_interaction"
    ? options.fastModel ?? options.model
    : options.model;
}

export function createDijieCodexCliModelBridge(
  options: CodexCliBridgeOptions = {},
): DijieOpenClawDialogModelBridge {
  const cliPath = options.cliPath ?? "codex";
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  const maxBufferBytes = options.maxBufferBytes ?? 25 * 1024 * 1024;
  const sandbox = options.sandbox ?? "read-only";
  const provider = options.provider ?? "openai";

  return {
    async completeDijieDialogMessage(input): Promise<DijieOpenClawDialogModelResult> {
      const selectedModel = selectedModelForInput(input, options);
      const args = [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-rules",
        "--sandbox",
        sandbox,
      ];
      if (selectedModel) {
        args.push("--model", selectedModel);
      }
      args.push(input.message);

      try {
        const { stdout } = await execFileAsync(cliPath, args, {
          cwd: options.cwd,
          timeout: timeoutMs,
          maxBuffer: maxBufferBytes,
        });
        const events = jsonEventsFromCodexOutput(stdout);
        const reply = replyFromCodexEvents(events);
        if (!reply) {
          throw new Error("Codex CLI 没有返回 assistant 文本。");
        }
        return {
          reply,
          usage: usageFromCodexEvents(events, selectedModel, provider),
        };
      } catch (error) {
        const bridgeError = new Error(`Codex CLI 模型桥调用失败：${sanitizeCliError(error)}`);
        (bridgeError as Error & { cause?: unknown }).cause = error;
        throw bridgeError;
      }
    },
  };
}

export function createDijieCodexCliModelBridgeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DijieOpenClawDialogModelBridge | undefined {
  const enabled =
    env.DIJIE_DIALOG_MODEL_BRIDGE ??
    env.DIJIE_MODEL_BRIDGE ??
    env.DIJIE_OPENCLAW_MODEL_BRIDGE ??
    env.DIJIE_OPENCLAW_MODEL_BRIDGE_MODE;
  if (enabled !== "codex" && enabled !== "codex-cli") {
    return undefined;
  }

  return createDijieCodexCliModelBridge({
    cliPath: env.DIJIE_CODEX_CLI_PATH,
    model: env.DIJIE_CODEX_MODEL,
    fastModel: env.DIJIE_CODEX_FAST_MODEL,
    provider: env.DIJIE_CODEX_PROVIDER,
    cwd: env.DIJIE_CODEX_WORKDIR,
    sandbox:
      env.DIJIE_CODEX_SANDBOX === "workspace-write" ||
      env.DIJIE_CODEX_SANDBOX === "danger-full-access" ||
      env.DIJIE_CODEX_SANDBOX === "read-only"
        ? env.DIJIE_CODEX_SANDBOX
        : undefined,
    timeoutMs: env.DIJIE_CODEX_TIMEOUT_MS
      ? Number.parseInt(env.DIJIE_CODEX_TIMEOUT_MS, 10)
      : undefined,
  });
}
