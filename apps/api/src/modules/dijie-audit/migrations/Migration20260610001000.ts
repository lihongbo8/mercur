import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260610001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_catalog_item" ("id" text not null, "catalog_ref" text not null, "kind" text check ("kind" in ('skill', 'tool', 'api', 'mcp', 'provider', 'adapter', 'capability')) not null, "name" text not null, "version" text not null, "description" text not null, "source" text check ("source" in ('platform_builtin', 'openclaw', 'opencloud', 'internal_build', 'github', 'mcp_registry', 'npm', 'other')) not null, "catalog_status" text check ("catalog_status" in ('draft', 'pending_review', 'approved', 'rejected', 'disabled')) not null, "permissions" jsonb not null, "risk_level" text check ("risk_level" in ('low', 'medium', 'high')) not null, "audit_policy" jsonb not null, "tags" jsonb not null, "provides" jsonb not null, "keywords" jsonb not null, "payload" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "reviewed_at" timestamptz null, "reviewed_by" text null, "deleted_at" timestamptz null, constraint "dijie_catalog_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dijie_catalog_item_catalog_ref" ON "dijie_catalog_item" ("catalog_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_catalog_item_kind" ON "dijie_catalog_item" ("kind") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_catalog_item_status" ON "dijie_catalog_item" ("catalog_status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_catalog_review_request" ("id" text not null, "review_key" text not null, "catalog_ref" text null, "need" text not null, "kind" text check ("kind" in ('skill', 'tool', 'api', 'mcp', 'provider', 'adapter', 'capability')) not null, "source" text check ("source" in ('role_gap', 'opencloud', 'openclaw', 'github', 'mcp_registry', 'npm', 'internal_build')) not null, "review_status" text check ("review_status" in ('pending_review', 'approved', 'rejected', 'request_changes')) not null, "role_package_id" text null, "role_listing_id" text null, "requested_by" text null, "submitted_at" timestamptz not null, "reviewed_at" timestamptz null, "reviewed_by" text null, "review_note" text null, "candidate" jsonb not null, "risk_summary" jsonb not null, "payload" jsonb not null, "deleted_at" timestamptz null, constraint "dijie_catalog_review_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dijie_catalog_review_request_review_key" ON "dijie_catalog_review_request" ("review_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_catalog_review_request_status" ON "dijie_catalog_review_request" ("review_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_catalog_review_request_package" ON "dijie_catalog_review_request" ("role_package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_catalog_review_request_listing" ON "dijie_catalog_review_request" ("role_listing_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_catalog_review_request" cascade;`);
    this.addSql(`drop table if exists "dijie_catalog_item" cascade;`);
  }
}
