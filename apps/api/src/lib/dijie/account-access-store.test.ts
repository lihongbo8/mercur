import { describe, expect, it } from "bun:test";
import {
  canManageDijieLocalAccounts,
  createDijieAccountAccessProfileReadModel,
  listDijieAccountAccessProfilesWithRepository,
  retrieveDijieAccountAccessProfileWithRepository,
  upsertDijieAccountAccessProfileWithRepository,
  type DijieAccountAccessProfileStorageRecord,
} from "./account-access-store";
import type { DijieAccessContext } from "./data-permissions";

function repository(
  profiles: Array<DijieAccountAccessProfileStorageRecord & { id: string }> = [],
) {
  return {
    async listDijieAccountAccessProfiles(filters?: Record<string, unknown>) {
      return profiles.filter((profile) =>
        filters?.account_id ? profile.account_id === filters.account_id : true,
      );
    },
    async createDijieAccountAccessProfiles(data: DijieAccountAccessProfileStorageRecord) {
      const created = { ...data, id: `djacct_${profiles.length + 1}` };
      profiles.push(created);
      return created;
    },
    async updateDijieAccountAccessProfiles(
      data: Partial<DijieAccountAccessProfileStorageRecord> & { id: string },
    ) {
      const index = profiles.findIndex((profile) => profile.id === data.id);
      if (index < 0) {
        throw new Error("missing profile");
      }
      profiles[index] = { ...profiles[index], ...data };
      return profiles[index];
    },
  };
}

describe("Dijie account access profiles", () => {
  it("creates and reads a local account access profile", async () => {
    const repo = repository();

    const result = await upsertDijieAccountAccessProfileWithRepository(repo, {
      accountId: "member_001",
      accountLevel: "operator",
      localSystemAccess: true,
      dataScopes: ["role:djrole_image_qc"],
      configuredBy: "local_admin",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        profile: {
          account_id: "member_001",
          account_level: "operator",
          local_system_access: true,
          data_scopes: ["role:djrole_image_qc"],
          configured_by: "local_admin",
        },
      },
    });
    const stored = await retrieveDijieAccountAccessProfileWithRepository(repo, {
      accountId: "member_001",
    });
    expect(createDijieAccountAccessProfileReadModel(stored!)).toMatchObject({
      accountId: "member_001",
      accountLevel: "operator",
      localSystemAccess: true,
      dataScopes: ["role:djrole_image_qc"],
    });
  });

  it("updates an existing profile instead of creating duplicates", async () => {
    const repo = repository([
      {
        id: "djacct_existing",
        account_id: "member_001",
        account_level: "viewer",
        local_system_access: false,
        data_scopes: [],
        configured_by: null,
        configured_at: new Date("2026-06-05T00:00:00.000Z"),
      },
    ]);

    const result = await upsertDijieAccountAccessProfileWithRepository(repo, {
      accountId: "member_001",
      accountLevel: "admin",
      localSystemAccess: true,
      dataScopes: ["*"],
      configuredBy: "local_admin",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        profile: {
          id: "djacct_existing",
          account_level: "admin",
          data_scopes: ["*"],
        },
      },
    });
  });

  it("lists safe local account access profiles for management readback", async () => {
    const repo = repository([
      {
        id: "djacct_member",
        account_id: "member_001",
        account_level: "viewer",
        local_system_access: false,
        data_scopes: ["role:djrole_image_qc"],
        configured_by: "local_admin",
        configured_at: new Date("2026-06-05T00:00:00.000Z"),
      },
    ]);

    await expect(listDijieAccountAccessProfilesWithRepository(repo)).resolves.toEqual([
      {
        id: "djacct_member",
        account_id: "member_001",
        account_level: "viewer",
        local_system_access: false,
        data_scopes: ["role:djrole_image_qc"],
        configured_by: "local_admin",
        configured_at: new Date("2026-06-05T00:00:00.000Z"),
      },
    ]);
  });

  it("rejects marketplace review scopes in local account profiles", async () => {
    const result = await upsertDijieAccountAccessProfileWithRepository(repository(), {
      accountId: "member_001",
      accountLevel: "admin",
      localSystemAccess: true,
      dataScopes: ["review:*"],
      configuredBy: "local_admin",
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "本地账号数据权限只能包含 role/package/developer/execution/entitlement 范围。",
    });
  });

  it("only local super admins and admins can manage local accounts", () => {
    const localAdmin: DijieAccessContext = {
      accountId: "local_admin",
      actorType: "user",
      billingAccountId: "local_admin",
      accountLevel: "admin",
      dataScopes: [],
      localSystemAccess: true,
      marketplaceOwnerAccess: false,
    };
    const marketplaceOwner: DijieAccessContext = {
      accountId: "marketplace_owner",
      actorType: "marketplace_owner",
      billingAccountId: "marketplace_owner",
      accountLevel: "member",
      dataScopes: [],
      localSystemAccess: false,
      marketplaceOwnerAccess: true,
    };

    expect(canManageDijieLocalAccounts(localAdmin)).toBe(true);
    expect(canManageDijieLocalAccounts(marketplaceOwner)).toBe(false);
  });
});
