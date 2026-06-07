import { model } from "@medusajs/framework/utils";

const DijieLedgerEntry = model.define("dijie_ledger_entry", {
  id: model.id({ prefix: "djledger" }).primaryKey(),
  account_id: model.text().searchable(),
  billing_account_id: model.text().searchable(),
  source: model.enum(["dialog_usage", "main_system_usage", "role_usage", "role_marketplace"]),
  usage_kind: model.enum([
    "model_tokens",
    "tool_execution",
    "runtime_resource",
    "download",
    "install",
    "other",
  ]),
  surface: model
    .enum([
      "buyer_storefront",
      "user_center",
      "developer_center",
      "admin_review",
      "openclaw_main",
      "openclaw_local",
    ])
    .nullable(),
  mode: model.enum(["user", "developer", "review"]).nullable(),
  subject: model.json(),
  meters: model.json(),
  currency: model.text(),
  gross_amount_cents: model.number(),
  platform_receivable_cents: model.number(),
  developer_receivable_cents: model.number(),
  model_provider: model.text().searchable().nullable(),
  model_id: model.text().searchable().nullable(),
  model_pricing_known: model.boolean().default(false),
  model_pricing_source: model.text().nullable(),
  provider_cost_cents: model.number().nullable(),
  provider_cost_currency: model.text().nullable(),
  role_listing_id: model.text().searchable().nullable(),
  package_id: model.text().searchable().nullable(),
  execution_id: model.text().searchable().nullable(),
  entitlement_id: model.text().searchable().nullable(),
  developer_ref: model.text().searchable().nullable(),
  occurred_at: model.dateTime(),
});

export default DijieLedgerEntry;
