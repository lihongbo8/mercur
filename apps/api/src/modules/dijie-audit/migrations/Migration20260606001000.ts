import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260606001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "dijie_role_package_draft" drop constraint if exists "dijie_role_package_draft_draft_status_check";`);
    this.addSql(`alter table if exists "dijie_role_package_draft" add constraint "dijie_role_package_draft_draft_status_check" check ("draft_status" in ('partial', 'ready', 'blocked', 'submitted'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "dijie_role_package_draft" drop constraint if exists "dijie_role_package_draft_draft_status_check";`);
    this.addSql(`update "dijie_role_package_draft" set "draft_status" = 'blocked' where "draft_status" = 'partial';`);
    this.addSql(`alter table if exists "dijie_role_package_draft" add constraint "dijie_role_package_draft_draft_status_check" check ("draft_status" in ('ready', 'blocked', 'submitted'));`);
  }
}
