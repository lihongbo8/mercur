import type { ExecArgs } from "@medusajs/framework/types";
import { Client } from "pg";

const DEFAULT_LEGACY_ROLE_LISTING_IDS = [
  "djrole_01KTG17DEK2WVM5NSS00198TP2",
  "djrole_01KTH4X8QEEZYTKVQ7J75G141C",
  "djrole_01KTNAF2592K3XC8FXKG8N56D9",
];

type RoleListingRow = {
  id: string;
  title: string | null;
  listing_status: string;
  review_state: string;
  deleted_at: Date | string | null;
};

type ProductProjectionRow = {
  id: string;
  title: string | null;
  status: string | null;
  role_listing_id: string | null;
  deleted_at: Date | string | null;
};

type CountRow = {
  count: string;
};

function argsList(args: ExecArgs["args"]): string[] {
  if (Array.isArray(args)) {
    return args.map(String);
  }
  if (typeof args === "string") {
    return [args];
  }
  if (args && typeof args === "object") {
    return Object.entries(args as Record<string, unknown>).flatMap(
      ([key, value]) => {
        if (Array.isArray(value)) {
          return value.map(String);
        }
        if (value === true) {
          return [`--${key}`];
        }
        if (value === false || value === undefined || value === null) {
          return [];
        }
        return [`--${key}=${String(value)}`, String(value)];
      },
    );
  }
  return [];
}

function requestedRoleListingIds(args: string[]): string[] {
  const idsArg = args.find((arg) => arg.startsWith("--ids="));
  const ids = idsArg
    ? idsArg
        .slice("--ids=".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : DEFAULT_LEGACY_ROLE_LISTING_IDS;
  return [...new Set(ids)];
}

function checkoutProductIds(roleListingIds: string[]): string[] {
  return roleListingIds.map((roleListingId) => `prod_checkout_${roleListingId}`);
}

async function matchingProducts(client: Client, roleListingIds: string[]) {
  const productIds = [...roleListingIds, ...checkoutProductIds(roleListingIds)];
  return client.query<ProductProjectionRow>(
    `select id,
            title,
            status,
            coalesce(
              metadata #>> '{dijieRole,roleListingId}',
              metadata #>> '{dijieRole,role_listing_id}'
            ) as role_listing_id,
            deleted_at
     from product
     where id = any($1::text[])
        or metadata #>> '{dijieRole,roleListingId}' = any($2::text[])
        or metadata #>> '{dijieRole,role_listing_id}' = any($2::text[])
     order by created_at asc`,
    [productIds, roleListingIds],
  );
}

async function countRows(client: Client, table: string, roleListingIds: string[]) {
  const result = await client.query<CountRow>(
    `select count(*)::text as count
     from ${table}
     where role_listing_id = any($1::text[])
       and deleted_at is null`,
    [roleListingIds],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function cleanupLegacyRoles(params: {
  client: Client;
  roleListingIds: string[];
}) {
  const { client, roleListingIds } = params;
  const productIds = [...roleListingIds, ...checkoutProductIds(roleListingIds)];

  const listings = await client.query<{ id: string }>(
    `update dijie_role_listing
     set listing_status = 'archived',
         review_state = 'rejected',
         deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
     where id = any($1::text[])
       and deleted_at is null
     returning id`,
    [roleListingIds],
  );

  const products = await client.query<{ id: string }>(
    `update product
     set status = case when status = 'published' then 'draft' else status end,
         metadata = jsonb_set(
           jsonb_set(
             coalesce(metadata, '{}'::jsonb),
             '{dijieRole,listingStatus}',
             to_jsonb('archived'::text),
             true
           ),
           '{dijieRole,reviewState}',
           to_jsonb('rejected'::text),
           true
         ),
         deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
     where deleted_at is null
       and (
         id = any($1::text[])
         or metadata #>> '{dijieRole,roleListingId}' = any($2::text[])
         or metadata #>> '{dijieRole,role_listing_id}' = any($2::text[])
       )
     returning id`,
    [productIds, roleListingIds],
  );

  const entitlements = await client.query<{ id: string }>(
    `update dijie_role_entitlement
     set entitlement_status = 'revoked',
         updated_at = now()
     where role_listing_id = any($1::text[])
       and entitlement_status = 'authorized'
       and deleted_at is null
     returning id`,
    [roleListingIds],
  );

  return {
    roleListingsArchived: listings.rowCount ?? listings.rows.length,
    productsSoftDeleted: products.rowCount ?? products.rows.length,
    entitlementsRevoked: entitlements.rowCount ?? entitlements.rows.length,
  };
}

export default async function cleanDijieLegacyRoles({ args }: ExecArgs) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const parsedArgs = argsList(args);
  const apply =
    parsedArgs.includes("--apply") ||
    parsedArgs.includes("apply") ||
    process.env.DIJIE_APPLY === "true";
  const roleListingIds = requestedRoleListingIds(parsedArgs);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const listings = await client.query<RoleListingRow>(
      `select id, title, listing_status, review_state, deleted_at
       from dijie_role_listing
       where id = any($1::text[])
       order by created_at asc`,
      [roleListingIds],
    );
    const products = await matchingProducts(client, roleListingIds);
    const authorizedEntitlements = await client.query<CountRow>(
      `select count(*)::text as count
       from dijie_role_entitlement
       where role_listing_id = any($1::text[])
         and entitlement_status = 'authorized'
         and deleted_at is null`,
      [roleListingIds],
    );
    const auditRecords = await countRows(
      client,
      "dijie_audit_record",
      roleListingIds,
    );
    const ledgerEntries = await countRows(
      client,
      "dijie_ledger_entry",
      roleListingIds,
    );

    const before = {
      roleListingIds,
      roleListings: listings.rows,
      productProjections: products.rows,
      authorizedEntitlements: Number(authorizedEntitlements.rows[0]?.count ?? 0),
      auditRecordsPreserved: auditRecords,
      ledgerEntriesPreserved: ledgerEntries,
    };

    if (!apply) {
      console.log(
        JSON.stringify({
          ok: true,
          mode: "dry-run",
          before,
          applyHint:
            "Run with --apply to archive listings, soft-delete role products, and revoke active entitlements. Audit and ledger facts are preserved.",
        }, null, 2),
      );
      return;
    }

    await client.query("begin");
    try {
      const changed = await cleanupLegacyRoles({ client, roleListingIds });
      await client.query("commit");
      console.log(
        JSON.stringify({
          ok: true,
          mode: "applied",
          before,
          changed,
          preserved: {
            auditRecords,
            ledgerEntries,
          },
        }, null, 2),
      );
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}
