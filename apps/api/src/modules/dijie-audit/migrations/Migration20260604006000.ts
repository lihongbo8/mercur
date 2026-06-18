import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604006000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "model_provider" text null;`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "model_id" text null;`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "model_pricing_known" boolean not null default false;`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "model_pricing_source" text null;`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "provider_cost_cents" integer null;`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add column if not exists "provider_cost_currency" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_model_provider" ON "dijie_ledger_entry" ("model_provider") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_ledger_entry_model_id" ON "dijie_ledger_entry" ("model_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_dijie_ledger_entry_model_id";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_dijie_ledger_entry_model_provider";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "provider_cost_currency";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "provider_cost_cents";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "model_pricing_source";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "model_pricing_known";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "model_id";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop column if exists "model_provider";`);
  }
}
