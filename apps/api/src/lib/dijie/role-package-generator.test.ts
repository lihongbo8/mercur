import { describe, expect, it } from "bun:test";
import type {
  DijieDialogBillingPolicy,
  DijieDialogContext,
} from "./dialog-context";
import type { DijieOpenClawDialogModelBridge } from "./dialog-model-bridge";
import {
  extractDijieRolePackageJsonText,
  generateDijieRolePackageDraftWithModel,
  isDijieRolePackageGenerationIntent,
} from "./role-package-generator";

describe("Dijie role package generation intent", () => {
  it("detects explicit role package generation requests", () => {
    expect(
      isDijieRolePackageGenerationIntent(
        "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
      ),
    ).toBe(true);
  });

  it("does not treat negated generation wording as a heavy generation request", () => {
    expect(
      isDijieRolePackageGenerationIntent(
        "我想做智能门锁电商美工岗位。请用三条短句判断关键检查点，不要生成岗位包。",
      ),
    ).toBe(false);
    expect(
      isDijieRolePackageGenerationIntent(
        "不要生成文件，请把智能门锁电商美工岗位的开发工作拆成三步。",
      ),
    ).toBe(false);
  });
});

describe("Dijie role package model JSON extraction", () => {
  it("extracts a balanced JSON object from a model reply with surrounding prose", () => {
    const reply = [
      "下面是岗位包 JSON：",
      '{ "files": [{ "path": "role_package/manifest.json", "content": "{not a boundary}" }] }',
      "请查收。",
    ].join("\n");

    expect(JSON.parse(extractDijieRolePackageJsonText(reply))).toEqual({
      files: [
        {
          path: "role_package/manifest.json",
          content: "{not a boundary}",
        },
      ],
    });
  });

  it("extracts a model reply that escaped the whole JSON object", () => {
    const reply =
      '{\\"files\\":[{\\"path\\":\\"role_package/README.md\\",\\"content\\":\\"# README\\\\n```json\\\\n{\\\\\\"name\\\\\\":\\\\\\"智能门锁电商美工\\\\\\"}\\\\n```\\"}]}';

    expect(JSON.parse(extractDijieRolePackageJsonText(reply))).toEqual({
      files: [
        {
          path: "role_package/README.md",
          content: '# README\n```json\n{"name":"智能门锁电商美工"}\n```',
        },
      ],
    });
  });
});

describe("Dijie role package generation timeout", () => {
  it("fails closed when the model bridge does not return a stage", async () => {
    let bridgeAborted = false;
    const bridge: DijieOpenClawDialogModelBridge = {
      completeDijieDialogMessage: (input) => {
        input.signal?.addEventListener("abort", () => {
          bridgeAborted = true;
        });
        return new Promise(() => {});
      },
    };
    const context: DijieDialogContext = {
      accountId: "developer_123",
      accountType: "developer",
      surface: "developer_center",
      mode: "developer",
      subject: {},
      billingAccountId: "developer_123",
    };
    const billingPolicy: DijieDialogBillingPolicy = {
      billingAccountId: "developer_123",
      payerAccountId: "developer_123",
      metered: true,
      modelAllowed: true,
      chargedBy: "system_platform",
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
      note: "test",
    };

    const result = await generateDijieRolePackageDraftWithModel({
      bridge,
      context,
      billingPolicy,
      message: "请生成智能门锁电商美工岗位 role_package。",
      stageTimeoutMs: 5,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 504,
      issues: ["manifest: model_bridge_timeout"],
      diagnostics: {
        stageId: "manifest",
        stageLabel: "manifest.json",
      },
    });
    expect(bridgeAborted).toBe(true);
  });

  it("fails closed when the caller aborts a stage", async () => {
    const controller = new AbortController();
    const bridge: DijieOpenClawDialogModelBridge = {
      completeDijieDialogMessage: (input) => {
        setTimeout(() => controller.abort(), 5);
        return new Promise((_, reject) => {
          input.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      },
    };
    const context: DijieDialogContext = {
      accountId: "developer_123",
      accountType: "developer",
      surface: "developer_center",
      mode: "developer",
      subject: {},
      billingAccountId: "developer_123",
    };
    const billingPolicy: DijieDialogBillingPolicy = {
      billingAccountId: "developer_123",
      payerAccountId: "developer_123",
      metered: true,
      modelAllowed: true,
      chargedBy: "system_platform",
      billableModelUsage: true,
      ledgerSource: "developer_assist",
      requiresEntitlement: false,
      note: "test",
    };

    const result = await generateDijieRolePackageDraftWithModel({
      bridge,
      context,
      billingPolicy,
      message: "请生成智能门锁电商美工岗位 role_package。",
      signal: controller.signal,
      stageTimeoutMs: 10_000,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 499,
      issues: ["manifest: model_bridge_aborted"],
      diagnostics: {
        stageId: "manifest",
        stageLabel: "manifest.json",
      },
    });
  });
});
