import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "bun:test";
import {
  createDijieOpenClawCliModelBridge,
  createDijieOpenClawCliModelBridgeFromEnv,
} from "./openclaw-cli-model-bridge";
import { createDijieDeveloperDialogContext, getDijieDialogBillingPolicy } from "./dialog-context";

async function writeFakeOpenClaw(script: string) {
  const dir = await mkdtemp(join(tmpdir(), "dijie-openclaw-cli-"));
  const path = join(dir, "openclaw");
  await writeFile(path, script);
  await chmod(path, 0o700);
  return path;
}

describe("Dijie OpenClaw CLI model bridge", () => {
  it("stays disabled until explicitly selected by env", () => {
    expect(createDijieOpenClawCliModelBridgeFromEnv({})).toBeUndefined();
    expect(
      createDijieOpenClawCliModelBridgeFromEnv({
        DIJIE_OPENCLAW_MODEL_BRIDGE: "cli",
      }),
    ).toBeDefined();
  });

  it("runs OpenClaw model inference through the CLI and normalizes reply and usage", async () => {
    const cliPath = await writeFakeOpenClaw(`#!/bin/sh
printf '{"reply":"role package json","model":"openai/gpt-5.4","usage":{"inputTokens":11,"outputTokens":13,"totalTokens":24}}'
`);
    const bridge = createDijieOpenClawCliModelBridge({ cliPath, model: "openai/gpt-5.4" });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    const result = await bridge.completeDijieDialogMessage({
      context,
      billingPolicy: getDijieDialogBillingPolicy(context),
      message: "生成岗位包",
      fallbackReply: "fallback",
      roles: [],
    });

    expect(result.reply).toBe("role package json");
    expect(result.usage).toMatchObject({
      provider: "openai",
      model: "gpt-5.4",
      promptTokens: 11,
      completionTokens: 13,
      totalTokens: 24,
    });
  });

  it("extracts reply text from OpenClaw CLI JSON outputs", async () => {
    const cliPath = await writeFakeOpenClaw(`#!/bin/sh
printf '%s' '{"ok":true,"capability":"model.run","transport":"local","provider":"openai","model":"gpt-5.5","attempts":[],"outputs":[{"text":"{\\"reply\\":\\"ok\\"}","mediaUrl":null}]}'
`);
    const bridge = createDijieOpenClawCliModelBridge({ cliPath });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    const result = await bridge.completeDijieDialogMessage({
      context,
      billingPolicy: getDijieDialogBillingPolicy(context),
      message: "ping",
      fallbackReply: "fallback",
      roles: [],
    });

    expect(result.reply).toBe('{"reply":"ok"}');
    expect(result.usage).toMatchObject({
      provider: "openai",
      model: "gpt-5.5",
      requestCount: 1,
    });
  });

  it("surfaces sanitized OpenClaw CLI failures", async () => {
    const cliPath = await writeFakeOpenClaw(`#!/bin/sh
printf '\\033[31mConfig invalid\\033[0m\\n(node:123) Warning: noisy\\nUse \`node --trace-warnings ...\` to show details\\nprovider_auth=secret-token token raw-secret' >&2
exit 42
`);
    const bridge = createDijieOpenClawCliModelBridge({ cliPath });
    const context = createDijieDeveloperDialogContext({ developerAccountId: "dev_1" });

    let thrown: Error | undefined;
    try {
      await bridge.completeDijieDialogMessage({
        context,
        billingPolicy: getDijieDialogBillingPolicy(context),
        message: "生成岗位包",
        fallbackReply: "fallback",
        roles: [],
      });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toContain("OpenClaw 模型桥调用失败");
    expect(thrown?.message).toContain("Config invalid");
    expect(thrown?.message).not.toContain("\u001b");
    expect(thrown?.message).not.toContain("Warning");
    expect(thrown?.message).not.toContain("secret-token");
    expect(thrown?.message).not.toContain("raw-secret");
  });
});
