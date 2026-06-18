import { model } from "@medusajs/framework/utils";

const DijieRolePackage = model.define("dijie_role_package", {
  id: model.id({ prefix: "djpkg" }).primaryKey(),
  package_id: model.text().searchable(),
  package_version: model.text().searchable(),
  owner_id: model.text().searchable().nullable(),
  uploaded_at: model.dateTime(),
  manifest_summary: model.json(),
  file_manifest: model.json(),
  package_files: model.json(),
  validation_issues: model.json().nullable(),
});

export default DijieRolePackage;
