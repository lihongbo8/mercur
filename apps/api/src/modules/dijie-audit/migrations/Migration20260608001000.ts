import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260608001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "dijie_role_listing" add column if not exists "usage_instructions" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "dijie_role_listing" drop column if exists "usage_instructions";`,
    );
  }
}
