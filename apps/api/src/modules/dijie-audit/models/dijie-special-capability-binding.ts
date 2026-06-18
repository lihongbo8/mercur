import { model } from "@medusajs/framework/utils";

const DijieSpecialCapabilityBinding = model.define("dijie_special_capability_binding", {
  id: model.id({ prefix: "djcapbind" }).primaryKey(),
  binding_key: model.text().searchable(),
  review_request_id: model.text().searchable(),
  catalog_ref: model.text().searchable(),
  need: model.text().searchable(),
  kind: model.enum(["skill", "tool", "api", "mcp", "provider", "adapter", "capability"]),
  role_package_id: model.text().searchable().nullable(),
  role_listing_id: model.text().searchable(),
  category_ref: model.text().searchable().nullable(),
  binding_status: model.enum(["bound", "disabled"]),
  bound_by: model.text().searchable().nullable(),
  bound_at: model.dateTime(),
  payload: model.json(),
});

export default DijieSpecialCapabilityBinding;
