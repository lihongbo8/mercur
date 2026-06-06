import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604003000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_entitlement" ("id" text not null, "actor_id" text not null, "role_listing_id" text not null, "package_id" text not null, "package_version" text not null, "developer_ref" text not null, "listing_owner_ref" text not null, "billing_beneficiary_ref" text not null, "entitlement_status" text check ("entitlement_status" in ('authorized', 'revoked')) not null, "source" text check ("source" in ('zero_price', 'checkout')) not null, "order_id" text null, "pricing" jsonb not null, "role_token_pricing" jsonb not null, "authorized_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_entitlement_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_entitlement_actor_id" ON "dijie_role_entitlement" ("actor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_entitlement_role_listing_id" ON "dijie_role_entitlement" ("role_listing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_entitlement_actor_role" ON "dijie_role_entitlement" ("actor_id", "role_listing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_entitlement_status" ON "dijie_role_entitlement" ("entitlement_status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_entitlement_deleted_at" ON "dijie_role_entitlement" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_role_entitlement" cascade;`);
  }
}
