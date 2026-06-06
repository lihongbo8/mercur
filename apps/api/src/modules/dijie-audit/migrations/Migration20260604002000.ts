import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604002000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_review" ("id" text not null, "role_listing_id" text not null, "reviewer_id" text null, "role_standard_decision" text check ("role_standard_decision" in ('pending', 'pass', 'needs_changes', 'reject')) not null, "safety_compliance_decision" text check ("safety_compliance_decision" in ('pending', 'pass', 'needs_changes', 'reject')) not null, "pricing_reasonability_decision" text check ("pricing_reasonability_decision" in ('pending', 'pass', 'needs_changes', 'reject')) not null, "final_result" text check ("final_result" in ('pending', 'approved', 'needs_changes', 'rejected')) not null, "summary" text null, "records" jsonb not null, "finalized_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_review_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_review_role_listing_id" ON "dijie_role_review" ("role_listing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_review_reviewer_id" ON "dijie_role_review" ("reviewer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_review_deleted_at" ON "dijie_role_review" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_role_review" cascade;`);
  }
}
