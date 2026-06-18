import { Migration } from "@mikro-orm/migrations";

export class Migration20260611002000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "dijie_role_category" ("id" text not null, "category_ref" text not null, "name" text not null, "version" text not null, "description" text not null, "category_status" text check ("category_status" in ('draft', 'pending_review', 'approved', 'disabled')) not null, "pack_binding" jsonb not null, "risk_policy" jsonb not null, "review_policy" jsonb not null, "reviewed_at" timestamptz null, "reviewed_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dijie_role_category_category_ref_unique" ON "dijie_role_category" ("category_ref") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dijie_role_category_status" ON "dijie_role_category" ("category_status") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `alter table if exists "dijie_role_listing" add column if not exists "category_ref" text null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dijie_role_listing_category_ref" ON "dijie_role_listing" ("category_ref") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_dijie_role_listing_category_ref";`);
    this.addSql(
      `alter table if exists "dijie_role_listing" drop column if exists "category_ref";`,
    );
    this.addSql(`drop table if exists "dijie_role_category" cascade;`);
  }
}
