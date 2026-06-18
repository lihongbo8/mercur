import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604005000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_dialog_session" ("id" text not null, "account_id" text not null, "account_type" text check ("account_type" in ('buyer', 'developer', 'admin')) not null, "surface" text check ("surface" in ('buyer_storefront', 'user_center', 'developer_center', 'admin_review', 'openclaw_local')) not null, "mode" text check ("mode" in ('user', 'developer', 'review')) not null, "billing_account_id" text not null, "subject" jsonb not null, "capability_policy" jsonb not null, "title" text null, "last_message_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_dialog_session_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_session_account_id" ON "dijie_dialog_session" ("account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_session_billing_account_id" ON "dijie_dialog_session" ("billing_account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_session_surface" ON "dijie_dialog_session" ("surface") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_session_last_message_at" ON "dijie_dialog_session" ("last_message_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_dialog_message" ("id" text not null, "session_id" text not null, "account_id" text not null, "message_role" text check ("message_role" in ('user', 'assistant')) not null, "content" text not null, "grounding" jsonb null, "model_called" boolean not null default false, "model_usage" jsonb null, "ledger_entry_id" text null, "occurred_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_dialog_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_message_session_id" ON "dijie_dialog_message" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_message_account_id" ON "dijie_dialog_message" ("account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_message_ledger_entry_id" ON "dijie_dialog_message" ("ledger_entry_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_dialog_message_occurred_at" ON "dijie_dialog_message" ("occurred_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_ledger_entry" ("id" text not null, "account_id" text not null, "billing_account_id" text not null, "source" text check ("source" in ('dialog_usage', 'main_system_usage', 'role_usage', 'role_marketplace')) not null, "usage_kind" text check ("usage_kind" in ('model_tokens', 'tool_execution', 'runtime_resource', 'download', 'install', 'other')) not null, "surface" text check ("surface" in ('buyer_storefront', 'user_center', 'developer_center', 'admin_review', 'openclaw_local')) null, "mode" text check ("mode" in ('user', 'developer', 'review')) null, "subject" jsonb not null, "meters" jsonb not null, "currency" text not null, "gross_amount_cents" integer not null, "platform_receivable_cents" integer not null, "developer_receivable_cents" integer not null, "role_listing_id" text null, "package_id" text null, "execution_id" text null, "entitlement_id" text null, "developer_ref" text null, "occurred_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_ledger_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_account_id" ON "dijie_ledger_entry" ("account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_billing_account_id" ON "dijie_ledger_entry" ("billing_account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_source" ON "dijie_ledger_entry" ("source") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_role_listing_id" ON "dijie_ledger_entry" ("role_listing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_execution_id" ON "dijie_ledger_entry" ("execution_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_entitlement_id" ON "dijie_ledger_entry" ("entitlement_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_developer_ref" ON "dijie_ledger_entry" ("developer_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_occurred_at" ON "dijie_ledger_entry" ("occurred_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_dialog_message" cascade;`);
    this.addSql(`drop table if exists "dijie_dialog_session" cascade;`);
    this.addSql(`drop table if exists "dijie_ledger_entry" cascade;`);
  }
}
