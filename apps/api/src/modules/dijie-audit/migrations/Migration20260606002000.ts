import { Migration } from "@medusajs/framework/mikro-orm/migrations";

const SURFACE_CHECK =
  "'buyer_storefront', 'user_center', 'developer_center', 'admin_review', 'openclaw_main', 'openclaw_local'";

const LEGACY_SURFACE_CHECK =
  "'buyer_storefront', 'user_center', 'developer_center', 'admin_review', 'openclaw_local'";

export class Migration20260606002000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "dijie_dialog_session" drop constraint if exists "dijie_dialog_session_surface_check";`);
    this.addSql(`alter table if exists "dijie_dialog_session" add constraint "dijie_dialog_session_surface_check" check ("surface" in (${SURFACE_CHECK}));`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop constraint if exists "dijie_ledger_entry_surface_check";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add constraint "dijie_ledger_entry_surface_check" check ("surface" in (${SURFACE_CHECK}));`);
  }

  override async down(): Promise<void> {
    this.addSql(`update "dijie_dialog_session" set "surface" = 'openclaw_local' where "surface" = 'openclaw_main';`);
    this.addSql(`update "dijie_ledger_entry" set "surface" = 'openclaw_local' where "surface" = 'openclaw_main';`);
    this.addSql(`alter table if exists "dijie_dialog_session" drop constraint if exists "dijie_dialog_session_surface_check";`);
    this.addSql(`alter table if exists "dijie_dialog_session" add constraint "dijie_dialog_session_surface_check" check ("surface" in (${LEGACY_SURFACE_CHECK}));`);
    this.addSql(`alter table if exists "dijie_ledger_entry" drop constraint if exists "dijie_ledger_entry_surface_check";`);
    this.addSql(`alter table if exists "dijie_ledger_entry" add constraint "dijie_ledger_entry_surface_check" check ("surface" in (${LEGACY_SURFACE_CHECK}));`);
  }
}
