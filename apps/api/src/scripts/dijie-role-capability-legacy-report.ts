import type { ExecArgs } from "@medusajs/framework/types";
import { Client } from "pg";

import { listDijieRoleCapabilityIntegrationLegacyIssues } from "../lib/dijie/role-capability-integration";

type LegacyRoleListingRow = {
  id: string;
  title: string | null;
  listing_status: string;
  review_state: string;
  manifest_summary: unknown;
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

export default async function reportDijieRoleCapabilityLegacyIssues({
  args,
}: ExecArgs) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const parsedArgs = argsList(args);
  const failOnIssues =
    parsedArgs.includes("--fail-on-issues") ||
    parsedArgs.includes("fail-on-issues");
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const roles = await client.query<LegacyRoleListingRow>(
      `select id, title, listing_status, review_state, manifest_summary
       from dijie_role_listing
       where review_state = 'approved'
         and listing_status in ('published', 'delisted')
         and deleted_at is null
       order by created_at asc`,
    );

    const issues = listDijieRoleCapabilityIntegrationLegacyIssues(roles.rows);
    const report = {
      ok: issues.length === 0,
      checked: roles.rowCount ?? roles.rows.length,
      issueCount: issues.length,
      issues,
    };

    console.log(JSON.stringify(report, null, 2));

    if (failOnIssues && issues.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}
