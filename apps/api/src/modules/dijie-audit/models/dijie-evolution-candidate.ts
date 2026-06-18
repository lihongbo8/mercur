import { model } from "@medusajs/framework/utils";

const DijieEvolutionCandidate = model.define("dijie_evolution_candidate", {
  id: model.id({ prefix: "djevo" }).primaryKey(),
  candidate_id: model.text().searchable(),
  candidate_version: model.number(),
  target: model.enum([
    "capability_rubric",
    "failure_mode_library",
    "test_example_library",
    "dispatch_strategy",
    "role_improvement",
    "judge_prompt",
    "few_shot",
  ]),
  status: model.enum([
    "pending",
    "approved",
    "rejected",
    "applied",
  ]),
  summary: model.text(),
  rationale: model.text(),
  evidence_refs: model.json(),
  package_id: model.text().searchable().nullable(),
  execution_id: model.text().searchable().nullable(),
  payload: model.json(),
});

export default DijieEvolutionCandidate;
