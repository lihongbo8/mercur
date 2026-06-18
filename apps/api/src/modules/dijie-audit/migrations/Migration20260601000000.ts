import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260601000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "dijie_role_feedback_packet" ("id" text not null, "packet_id" text not null, "packet_version" integer not null, "execution_id" text null, "entitlement_id" text null, "device_id" text null, "workspace_ref" text null, "local_gateway_id" text null, "mode" text check ("mode" in ('developer_package', 'authorized_execution')) not null, "role_listing_id" text null, "package_id" text not null, "package_version" text not null, "developer_ref" text null, "status" text check ("status" in ('completed', 'failed', 'cancelled', 'timed_out')) not null, "produced_at" timestamptz not null, "started_at" timestamptz not null, "ended_at" timestamptz not null, "summary" text not null, "changed_files" jsonb not null, "artifacts" jsonb not null, "tool_usage" jsonb not null, "model_proxy_usage" jsonb null, "cost_usage" jsonb null, "risk_events" jsonb not null, "evolution_suggestions" jsonb not null, "error" jsonb null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_feedback_packet_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_feedback_packet_packet_id" ON "dijie_role_feedback_packet" ("packet_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_feedback_packet_execution_id" ON "dijie_role_feedback_packet" ("execution_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_feedback_packet_role_listing_id" ON "dijie_role_feedback_packet" ("role_listing_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_feedback_packet_package_id" ON "dijie_role_feedback_packet" ("package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_feedback_packet_developer_ref" ON "dijie_role_feedback_packet" ("developer_ref") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_role_capability_profile" ("id" text not null, "profile_key" text not null, "profile_version" integer not null, "package_id" text not null, "package_version" text not null, "role_listing_id" text null, "updated_at" timestamptz not null default now(), "overall_score" integer not null, "capabilities" jsonb not null, "failure_modes" jsonb not null, "dispatch_hints" jsonb not null, "evaluator_adapters" jsonb not null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dijie_role_capability_profile_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_capability_profile_profile_key" ON "dijie_role_capability_profile" ("profile_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_capability_profile_package_id" ON "dijie_role_capability_profile" ("package_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_role_capability_profile_role_listing_id" ON "dijie_role_capability_profile" ("role_listing_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_memory_candidate" ("id" text not null, "candidate_id" text not null, "candidate_version" integer not null, "source" text check ("source" in ('scheduler_summary', 'role_feedback_packet', 'human_confirmation')) not null, "status" text check ("status" in ('pending', 'auto_approved', 'approved', 'rejected', 'archived')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "risk_level" text check ("risk_level" in ('low', 'medium', 'high', 'critical')) not null, "text" text not null, "evidence_refs" jsonb not null, "execution_id" text null, "package_id" text null, "payload" jsonb not null, "deleted_at" timestamptz null, constraint "dijie_memory_candidate_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_memory_candidate_candidate_id" ON "dijie_memory_candidate" ("candidate_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_memory_candidate_status" ON "dijie_memory_candidate" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_memory_candidate_execution_id" ON "dijie_memory_candidate" ("execution_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_memory_candidate_package_id" ON "dijie_memory_candidate" ("package_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dijie_evolution_candidate" ("id" text not null, "candidate_id" text not null, "candidate_version" integer not null, "target" text check ("target" in ('capability_rubric', 'failure_mode_library', 'test_example_library', 'dispatch_strategy', 'role_improvement', 'judge_prompt', 'few_shot')) not null, "status" text check ("status" in ('pending', 'approved', 'rejected', 'applied')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "summary" text not null, "rationale" text not null, "evidence_refs" jsonb not null, "package_id" text null, "execution_id" text null, "payload" jsonb not null, "deleted_at" timestamptz null, constraint "dijie_evolution_candidate_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_evolution_candidate_candidate_id" ON "dijie_evolution_candidate" ("candidate_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_evolution_candidate_status" ON "dijie_evolution_candidate" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_evolution_candidate_execution_id" ON "dijie_evolution_candidate" ("execution_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dijie_evolution_candidate_package_id" ON "dijie_evolution_candidate" ("package_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "dijie_evolution_candidate" cascade;`);
    this.addSql(`drop table if exists "dijie_memory_candidate" cascade;`);
    this.addSql(`drop table if exists "dijie_role_capability_profile" cascade;`);
    this.addSql(`drop table if exists "dijie_role_feedback_packet" cascade;`);
  }
}
