import { model } from "@medusajs/framework/utils";

const DijieCatalogReviewRequest = model.define("dijie_catalog_review_request", {
  id: model.id({ prefix: "djcatrev" }).primaryKey(),
  review_key: model.text().searchable(),
  catalog_ref: model.text().searchable().nullable(),
  need: model.text().searchable(),
  kind: model.enum(["skill", "tool", "api", "mcp", "provider", "adapter", "capability"]),
  source: model.enum([
    "role_gap",
    "opencloud",
    "openclaw",
    "github",
    "mcp_registry",
    "npm",
    "internal_build",
  ]),
  review_status: model.enum(["pending_review", "approved", "rejected", "request_changes"]),
  role_package_id: model.text().searchable().nullable(),
  role_listing_id: model.text().searchable().nullable(),
  requested_by: model.text().searchable().nullable(),
  submitted_at: model.dateTime(),
  reviewed_at: model.dateTime().nullable(),
  reviewed_by: model.text().searchable().nullable(),
  review_note: model.text().nullable(),
  candidate: model.json(),
  risk_summary: model.json(),
  payload: model.json(),
});

export default DijieCatalogReviewRequest;
