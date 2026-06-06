import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604004000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_account_access_profile" ("id" text not null, "account_id" text not null, "account_level" text check ("account_level" in ('super_admin', 'admin', 'operator', 'viewer', 'member')) not null, "local_system_access" boolean not null, "data_scopes" jsonb not null, "configured_by" text null, "configured_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_account_access_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dijie_account_access_profile_account_id_unique" ON "dijie_account_access_profile" ("account_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_account_access_profile_account_level" ON "dijie_account_access_profile" ("account_level") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_account_access_profile_configured_by" ON "dijie_account_access_profile" ("configured_by") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_account_access_profile_deleted_at" ON "dijie_account_access_profile" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_account_access_profile" cascade;`);
  }
}
