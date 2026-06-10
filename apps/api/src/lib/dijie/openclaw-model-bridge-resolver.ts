import type { MedusaRequest } from "@medusajs/framework/http";
import {
  DIJIE_OPENCLAW_MODEL_BRIDGE,
  type DijieOpenClawDialogModelBridge,
} from "./dialog-model-bridge";
import { createDijieCodexCliModelBridgeFromEnv } from "./codex-cli-model-bridge";
import { createDijieOpenClawCliModelBridgeFromEnv } from "./openclaw-cli-model-bridge";

export function isDijieOpenClawDialogModelBridge(
  value: unknown,
): value is DijieOpenClawDialogModelBridge {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { completeDijieDialogMessage?: unknown })
      .completeDijieDialogMessage === "function"
  );
}

export function resolveDijieOpenClawDialogModelBridge(
  req: MedusaRequest,
): DijieOpenClawDialogModelBridge | undefined {
  try {
    const bridge = req.scope.resolve(DIJIE_OPENCLAW_MODEL_BRIDGE) as unknown;
    if (isDijieOpenClawDialogModelBridge(bridge)) {
      return bridge;
    }
  } catch {
    // Fall through to the cloud-configured CLI bridge.
  }

  return (
    createDijieCodexCliModelBridgeFromEnv() ??
    createDijieOpenClawCliModelBridgeFromEnv()
  );
}
