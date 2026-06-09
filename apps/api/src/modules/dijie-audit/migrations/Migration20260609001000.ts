import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260609001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "dijie_role_package_draft" add column if not exists "file_confirmations" jsonb null;`,
    );
    this.addSql(
      `update "dijie_role_package_draft" set "file_confirmations" = '{}'::jsonb where "file_confirmations" is null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "dijie_role_package_draft" drop column if exists "file_confirmations";`,
    );
  }
}
