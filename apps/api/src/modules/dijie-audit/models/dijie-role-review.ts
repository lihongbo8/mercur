import { model } from "@medusajs/framework/utils";

const DijieRoleReview = model.define("dijie_role_review", {
  id: model.id({ prefix: "djreview" }).primaryKey(),
  role_listing_id: model.text().searchable(),
  reviewer_id: model.text().searchable().nullable(),
  role_standard_decision: model.enum(["pending", "pass", "needs_changes", "reject"]),
  safety_compliance_decision: model.enum(["pending", "pass", "needs_changes", "reject"]),
  pricing_reasonability_decision: model.enum(["pending", "pass", "needs_changes", "reject"]),
  final_result: model.enum(["pending", "approved", "needs_changes", "rejected"]),
  summary: model.text().nullable(),
  records: model.json(),
  finalized_at: model.dateTime().nullable(),
});

export default DijieRoleReview;
