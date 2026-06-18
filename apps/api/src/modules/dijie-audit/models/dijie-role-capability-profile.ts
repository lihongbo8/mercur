import { model } from "@medusajs/framework/utils";

const DijieRoleCapabilityProfile = model.define("dijie_role_capability_profile", {
  id: model.id({ prefix: "djcap" }).primaryKey(),
  profile_key: model.text().searchable(),
  profile_version: model.number(),
  package_id: model.text().searchable(),
  package_version: model.text(),
  role_listing_id: model.text().searchable().nullable(),
  overall_score: model.number(),
  capabilities: model.json(),
  failure_modes: model.json(),
  dispatch_hints: model.json(),
  evaluator_adapters: model.json(),
  payload: model.json(),
});

export default DijieRoleCapabilityProfile;
