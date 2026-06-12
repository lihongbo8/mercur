import { model } from "@medusajs/framework/utils";

const DijieCatalogItem = model.define("dijie_catalog_item", {
  id: model.id({ prefix: "djcat" }).primaryKey(),
  catalog_ref: model.text().searchable(),
  kind: model.enum(["skill", "tool", "api", "mcp", "provider", "adapter", "capability"]),
  name: model.text().searchable(),
  version: model.text().searchable(),
  description: model.text(),
  source: model.enum([
    "platform_builtin",
    "openclaw",
    "opencloud",
    "internal_build",
    "github",
    "mcp_registry",
    "npm",
    "other",
  ]),
  catalog_status: model.enum(["draft", "pending_review", "approved", "rejected", "disabled"]),
  permissions: model.json(),
  risk_level: model.enum(["low", "medium", "high"]),
  audit_policy: model.json(),
  tags: model.json(),
  provides: model.json(),
  keywords: model.json(),
  payload: model.json(),
  reviewed_at: model.dateTime().nullable(),
  reviewed_by: model.text().searchable().nullable(),
});

export default DijieCatalogItem;
