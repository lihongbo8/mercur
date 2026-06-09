import { model } from "@medusajs/framework/utils";

const DijieRolePackageDraft = model.define("dijie_role_package_draft", {
  id: model.id({ prefix: "djdraft" }).primaryKey(),
  owner_id: model.text().searchable(),
  draft_status: model.enum(["partial", "ready", "blocked", "submitted"]),
  source_message: model.text(),
  package_id: model.text().searchable().nullable(),
  package_version: model.text().searchable().nullable(),
  generated_at: model.dateTime(),
  manifest_summary: model.json().nullable(),
  file_manifest: model.json(),
  package_files: model.json(),
  capability_report: model.json(),
  quality_report: model.json(),
  upload_validation_issues: model.json(),
  blocking_issues: model.json(),
  file_confirmations: model.json().nullable(),
  model_usage: model.json().nullable(),
  submitted_package_id: model.text().searchable().nullable(),
});

export default DijieRolePackageDraft;
