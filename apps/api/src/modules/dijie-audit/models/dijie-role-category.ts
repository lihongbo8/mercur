import { model } from "@medusajs/framework/utils";

const DijieRoleCategory = model.define("dijie_role_category", {
  id: model.id({ prefix: "djcatg" }).primaryKey(),
  category_ref: model.text().searchable(),
  name: model.text().searchable(),
  version: model.text().searchable(),
  description: model.text(),
  category_status: model.enum(["draft", "pending_review", "approved", "disabled"]),
  pack_binding: model.json(),
  risk_policy: model.json(),
  review_policy: model.json(),
  reviewed_at: model.dateTime().nullable(),
  reviewed_by: model.text().searchable().nullable(),
});

export default DijieRoleCategory;
