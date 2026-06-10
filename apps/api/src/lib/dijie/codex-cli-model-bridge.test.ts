import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { createDijieDeveloperDialogContext, getDijieDialogBillingPolicy } from "./dialog-context";
import {
  createDijieCodexCliModelBridge,
  createDijieCodexCliModelBridgeFromEnv,
} from "./codex-cli-model-bridge";

async function writeFakeCodex(script: string) {
  const dir = await mkdtemp(join(tmpdir(), "dijie-codex-cli-"));
  const path = join(dir, "codex");
  await writeFile(path, script);
  await chmod(path, 0o700);
  return path;
}

describe("Dijie Codex CLI model bridge", () => {
  it("stays disabled until explicitly selected by env", () => {
    expect(createDijieCodexCliModelBridgeFromEnv({})).toBeUndefined();
    expect(
      createDijieCodexCliModelBridgeFromEnv({
        DIJIE_DIALOG_MODEL_BRIDGE: "codex-cli",
      }),
    ).toBeDefined();
    expect(
      createDijieCodexCliModelBridgeFromEnv({
        DIJIE_OPENCLAW_MODEL_BRIDGE: "codex",
      }),
    ).toBeDefined();
  });

  it("runs Codex exec JSONL and normalizes reply and usage", async () => {
    const cliPath = await writeFakeCodex(`#!/bin/sh
printf '%s\\n' 'Reading additional input from stdin...' \\
  '{"type":"thread.started","thread_id":"t1"}' \\
  '{"type":"turn.started"}' \\
  '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"直接回答"}}' \\
  '{"type":"turn.completed","usage":{"input_tokens":101,"cached_input_tokens":7,"output_tokens":13}}'
`);
    const bridge = createDijieCodexCliModelBridge({ cliPath, model: "gpt-5.5" });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    const result = await bridge.completeDijieDialogMessage({
      context,
      billingPolicy: getDijieDialogBillingPolicy(context),
      latencyClass: "standard",
      message: "普通问题",
      fallbackReply: "fallback",
      roles: [],
    });

    expect(result.reply).toBe("直接回答");
    expect(result.usage).toMatchObject({
      provider: "openai",
      model: "gpt-5.5",
      requestCount: 1,
      promptTokens: 101,
      cacheReadTokens: 7,
      completionTokens: 13,
      totalTokens: 121,
    });
  });

  it("uses the fast model for fast interaction turns", async () => {
    const argsFile = join(tmpdir(), `dijie-codex-args-${Date.now()}.txt`);
    const cliPath = await writeFakeCodex(`#!/bin/sh
printf '%s' "$@" > "${argsFile}"
printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"fast"}}' '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}'
`);
    const bridge = createDijieCodexCliModelBridge({
      cliPath,
      model: "gpt-5.5",
      fastModel: "gpt-5.5-mini",
    });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    await bridge.completeDijieDialogMessage({
      context,
      billingPolicy: getDijieDialogBillingPolicy(context),
      latencyClass: "fast_interaction",
      message: "快问答",
      fallbackReply: "fallback",
      roles: [],
    });

    const args = await Bun.file(argsFile).text().catch(() => "");
    expect(args).toContain("--model");
    expect(args).toContain("gpt-5.5-mini");
  });

  it("surfaces sanitized Codex CLI failures", async () => {
    const cliPath = await writeFakeCodex(`#!/bin/sh
printf '\\033[31mCodex failed\\033[0m access=raw-access refresh=raw-refresh bearer raw-bearer' >&2
exit 42
`);
    const bridge = createDijieCodexCliModelBridge({ cliPath });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    let thrown: Error | undefined;
    try {
      await bridge.completeDijieDialogMessage({
        context,
        billingPolicy: getDijieDialogBillingPolicy(context),
        message: "普通问题",
        fallbackReply: "fallback",
        roles: [],
      });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toContain("Codex CLI 模型桥调用失败");
    expect(thrown?.message).toContain("Codex failed");
    expect(thrown?.message).not.toContain("\u001b");
    expect(thrown?.message).not.toContain("raw-access");
    expect(thrown?.message).not.toContain("raw-refresh");
    expect(thrown?.message).not.toContain("raw-bearer");
  });
});
