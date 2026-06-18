import { model } from "@medusajs/framework/utils";

const DijieMemoryCandidate = model.define("dijie_memory_candidate", {
  id: model.id({ prefix: "djmem" }).primaryKey(),
  candidate_id: model.text().searchable(),
  candidate_version: model.number(),
  source: model.enum(["scheduler_summary", "role_feedback_packet", "human_confirmation"]),
  status: model.enum([
    "pending",
    "auto_approved",
    "approved",
    "rejected",
    "archived",
  ]),
  risk_level: model.enum(["low", "medium", "high", "critical"]),
  text: model.text(),
  evidence_refs: model.json(),
  execution_id: model.text().searchable().nullable(),
  package_id: model.text().searchable().nullable(),
  payload: model.json(),
});

export default DijieMemoryCandidate;
