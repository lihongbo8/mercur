import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import { PATCH } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function request(input: {
  actorId?: string;
  actorType?: string;
  managerProfile?: Record<string, unknown>;
  body?: Record<string, unknown>;
  accountId?: string;
  store?: Record<string, unknown>;
}) {
  return {
    auth_context: input.actorId
      ? { actor_id: input.actorId, actor_type: input.actorType ?? "member" }
      : undefined,
    params: { accountId: input.accountId ?? "member_001" },
    body: input.body ?? {},
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return (
          input.store ?? {
            async retrieveDijieAccountAccessProfile() {
              return input.managerProfile;
            },
            async upsertDijieAccountAccessProfile(body: Record<string, unknown>) {
              return {
                ok: true,
                value: {
                  profile: {
                    id: "djacct_member_001",
                    account_id: body.accountId,
                    account_level: body.accountLevel,
                    local_system_access: body.localSystemAccess,
                    data_scopes: body.dataScopes,
                    configured_by: body.configuredBy,
                    configured_at: new Date("2026-06-05T10:00:00.000Z"),
                  },
                },
              };
            },
          }
        );
      },
    },
  };
}

describe("PATCH /dijie/local/accounts/:accountId/access", () => {
  it("lets a local admin configure member data scopes", async () => {
    const res = response();

    await PATCH(
      request({
        actorId: "local_admin",
        managerProfile: {
          account_id: "local_admin",
          account_level: "admin",
          local_system_access: true,
          data_scopes: [],
        },
        body: {
          accountLevel: "operator",
          localSystemAccess: true,
          dataScopes: ["role:djrole_image_qc"],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      profile: {
        accountId: "member_001",
        accountLevel: "operator",
        localSystemAccess: true,
        dataScopes: ["role:djrole_image_qc"],
        configuredBy: "local_admin",
      },
    });
  });

  it("rejects ordinary members", async () => {
    const res = response();

    await PATCH(
      request({
        actorId: "member_other",
        body: {
          accountLevel: "operator",
          localSystemAccess: true,
          dataScopes: ["role:djrole_image_qc"],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有配置本地账号权限的权限。",
    });
  });

  it("does not allow local admins to assign marketplace review scopes", async () => {
    const res = response();

    await PATCH(
      request({
        actorId: "local_admin",
        actorType: "user",
        body: {
          accountLevel: "admin",
          localSystemAccess: true,
          dataScopes: ["review:*"],
        },
        store: {
          async retrieveDijieAccountAccessProfile() {
            return undefined;
          },
          async upsertDijieAccountAccessProfile() {
            return {
              ok: false,
              status: 400,
              error:
                "本地账号数据权限只能包含 role/package/developer/execution/entitlement 范围。",
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "本地账号数据权限只能包含 role/package/developer/execution/entitlement 范围。",
    });
  });
});
