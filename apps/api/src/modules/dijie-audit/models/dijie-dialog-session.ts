import { model } from "@medusajs/framework/utils";

const DijieDialogSession = model.define("dijie_dialog_session", {
  id: model.id({ prefix: "djdlg" }).primaryKey(),
  account_id: model.text().searchable(),
  account_type: model.enum(["buyer", "developer", "admin"]),
  surface: model.enum([
    "buyer_storefront",
    "user_center",
    "developer_center",
    "admin_review",
    "openclaw_main",
    "openclaw_local",
  ]),
  mode: model.enum(["user", "developer", "review"]),
  billing_account_id: model.text().searchable(),
  subject: model.json(),
  capability_policy: model.json(),
  title: model.text().nullable(),
  last_message_at: model.dateTime(),
});

export default DijieDialogSession;
