import { model } from "@medusajs/framework/utils";

const DijieRoleFeedbackPacket = model.define("dijie_role_feedback_packet", {
  id: model.id({ prefix: "djfb" }).primaryKey(),
  packet_id: model.text().searchable(),
  packet_version: model.number(),
  execution_id: model.text().searchable().nullable(),
  entitlement_id: model.text().nullable(),
  device_id: model.text().nullable(),
  workspace_ref: model.text().nullable(),
  local_gateway_id: model.text().nullable(),
  mode: model.enum(["developer_package", "authorized_execution"]),
  role_listing_id: model.text().searchable().nullable(),
  package_id: model.text().searchable(),
  package_version: model.text(),
  developer_ref: model.text().searchable().nullable(),
  status: model.enum(["completed", "failed", "cancelled", "timed_out"]),
  produced_at: model.dateTime(),
  started_at: model.dateTime(),
  ended_at: model.dateTime(),
  summary: model.text(),
  changed_files: model.json(),
  artifacts: model.json(),
  tool_usage: model.json(),
  model_proxy_usage: model.json().nullable(),
  cost_usage: model.json().nullable(),
  risk_events: model.json(),
  evolution_suggestions: model.json(),
  error: model.json().nullable(),
  payload: model.json(),
});

export default DijieRoleFeedbackPacket;
