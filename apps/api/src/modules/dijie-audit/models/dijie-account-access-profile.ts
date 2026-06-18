import { model } from "@medusajs/framework/utils";

const DijieAccountAccessProfile = model.define("dijie_account_access_profile", {
  id: model.id({ prefix: "djacct" }).primaryKey(),
  account_id: model.text().searchable(),
  account_level: model.enum(["super_admin", "admin", "operator", "viewer", "member"]),
  local_system_access: model.boolean(),
  data_scopes: model.json(),
  configured_by: model.text().searchable().nullable(),
  configured_at: model.dateTime(),
});

export default DijieAccountAccessProfile;
