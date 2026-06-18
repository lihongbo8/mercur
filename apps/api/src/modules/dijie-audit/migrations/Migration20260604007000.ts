import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604007000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_package_draft" ("id" text not null, "owner_id" text not null, "draft_status" text check ("draft_status" in ('ready', 'blocked', 'submitted')) not null, "source_message" text not null, "package_id" text null, "package_version" text null, "generated_at" timestamptz not null, "manifest_summary" jsonb null, "file_manifest" jsonb not null, "package_files" jsonb not null, "capability_report" jsonb not null, "quality_report" jsonb not null, "upload_validation_issues" jsonb not null, "blocking_issues" jsonb not null, "model_usage" jsonb null, "submitted_package_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_package_draft_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_draft_owner_id" ON "dijie_role_package_draft" ("owner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_draft_status" ON "dijie_role_package_draft" ("draft_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_draft_package_id" ON "dijie_role_package_draft" ("package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_package_draft_generated_at" ON "dijie_role_package_draft" ("generated_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_role_package_draft" cascade;`);
  }
}
