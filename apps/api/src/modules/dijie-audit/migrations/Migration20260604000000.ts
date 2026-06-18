import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_package" ("id" text not null, "package_id" text not null, "package_version" text not null, "owner_id" text null, "uploaded_at" timestamptz not null, "manifest_summary" jsonb not null, "file_manifest" jsonb not null, "package_files" jsonb not null, "validation_issues" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_package_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_package_id" ON "dijie_role_package" ("package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_package_version" ON "dijie_role_package" ("package_version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_owner_id" ON "dijie_role_package" ("owner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_deleted_at" ON "dijie_role_package" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_role_package" cascade;`);
  }
}
