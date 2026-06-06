import { model } from "@medusajs/framework/utils";

const DijieRoleEntitlement = model.define("dijie_role_entitlement", {
  id: model.id({ prefix: "djent" }).primaryKey(),
  actor_id: model.text().searchable(),
  role_listing_id: model.text().searchable(),
  package_id: model.text().searchable(),
  package_version: model.text(),
  developer_ref: model.text().searchable(),
  listing_owner_ref: model.text().searchable(),
  billing_beneficiary_ref: model.text().searchable(),
  entitlement_status: model.enum(["authorized", "revoked"]),
  source: model.enum(["zero_price", "checkout"]),
  order_id: model.text().nullable(),
  pricing: model.json(),
  role_token_pricing: model.json(),
  authorized_at: model.dateTime(),
});

export default DijieRoleEntitlement;
