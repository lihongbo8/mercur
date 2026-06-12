import { model } from "@medusajs/framework/utils";

const DijieRoleListing = model.define("dijie_role_listing", {
  id: model.id({ prefix: "djrole" }).primaryKey(),
  package_id: model.text().searchable(),
  package_version: model.text().searchable(),
  owner_id: model.text().searchable().nullable(),
  developer_ref: model.text().searchable(),
  listing_owner_ref: model.text().searchable(),
  billing_beneficiary_ref: model.text().searchable(),
  title: model.text().searchable(),
  subtitle: model.text().nullable(),
  description: model.text().nullable(),
  usage_instructions: model.text().nullable(),
  category: model.text().searchable().nullable(),
  category_ref: model.text().searchable().nullable(),
  listing_status: model.enum([
    "draft",
    "proposed",
    "published",
    "delisted",
    "archived",
  ]),
  review_state: model.enum([
    "draft",
    "submitted",
    "needs_changes",
    "approved",
    "rejected",
  ]),
  capabilities: model.json(),
  manifest_summary: model.json(),
  pricing: model.json(),
  role_token_pricing: model.json(),
  scopes: model.json(),
  confirmation_points: model.number().default(0),
  submitted_at: model.dateTime().nullable(),
  published_at: model.dateTime().nullable(),
});

export default DijieRoleListing;
