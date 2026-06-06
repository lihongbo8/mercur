import { model } from "@medusajs/framework/utils";

const DijieDialogMessage = model.define("dijie_dialog_message", {
  id: model.id({ prefix: "djmsg" }).primaryKey(),
  session_id: model.text().searchable(),
  account_id: model.text().searchable(),
  message_role: model.enum(["user", "assistant"]),
  content: model.text(),
  grounding: model.json().nullable(),
  model_called: model.boolean().default(false),
  model_usage: model.json().nullable(),
  ledger_entry_id: model.text().searchable().nullable(),
  occurred_at: model.dateTime(),
});

export default DijieDialogMessage;
