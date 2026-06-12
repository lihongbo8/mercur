import { Migration } from "@mikro-orm/migrations";

export class Migration20260612003000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "dijie_special_capability_binding" ("id" text not null, "binding_key" text not null, "review_request_id" text not null, "catalog_ref" text not null, "need" text not null, "kind" text check ("kind" in ('skill', 'tool', 'api', 'mcp', 'provider', 'adapter', 'capability')) not null, "role_package_id" text null, "role_listing_id" text not null, "category_ref" text null, "binding_status" text check ("binding_status" in ('bound', 'disabled')) not null, "bound_by" text null, "bound_at" timestamptz not null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_special_capability_binding_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dijie_special_capability_binding_key_unique" ON "dijie_special_capability_binding" ("binding_key") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dijie_special_capability_binding_listing" ON "dijie_special_capability_binding" ("role_listing_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dijie_special_capability_binding_review" ON "dijie_special_capability_binding" ("review_request_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_special_capability_binding" cascade;`);
  }
}
