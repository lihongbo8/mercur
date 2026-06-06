import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_listing" ("id" text not null, "package_id" text not null, "package_version" text not null, "owner_id" text null, "developer_ref" text not null, "listing_owner_ref" text not null, "billing_beneficiary_ref" text not null, "title" text not null, "subtitle" text null, "description" text null, "category" text null, "listing_status" text check ("listing_status" in ('draft', 'proposed', 'published', 'delisted', 'archived')) not null, "review_state" text check ("review_state" in ('draft', 'submitted', 'needs_changes', 'approved', 'rejected')) not null, "capabilities" jsonb not null, "manifest_summary" jsonb not null, "pricing" jsonb not null, "role_token_pricing" jsonb not null, "scopes" jsonb not null, "confirmation_points" integer not null default 0, "submitted_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_listing_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_package_id" ON "dijie_role_listing" ("package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_package_version" ON "dijie_role_listing" ("package_version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_owner_id" ON "dijie_role_listing" ("owner_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_developer_ref" ON "dijie_role_listing" ("developer_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_listing_status" ON "dijie_role_listing" ("listing_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_review_state" ON "dijie_role_listing" ("review_state") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_deleted_at" ON "dijie_role_listing" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_role_listing" cascade;`);
  }
}
