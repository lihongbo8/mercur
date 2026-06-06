import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../lib/dijie/audit-store";
import { GET } from "./route";

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
}) {
  return {
    auth_context: input.actorId
      ? { actor_id: input.actorId, actor_type: input.actorType ?? "member" }
      : undefined,
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return {
          async retrieveDijieAccountAccessProfile() {
            return input.managerProfile;
          },
          async listDijieAccountAccessProfiles() {
            return [
              {
                id: "djacct_member_001",
                account_id: "member_001",
                account_level: "operator",
                local_system_access: true,
                data_scopes: ["role:djrole_image_qc"],
                configured_by: "local_admin",
                configured_at: new Date("2026-06-05T10:00:00.000Z"),
              },
            ];
          },
        };
      },
    },
  };
}

describe("GET /dijie/local/accounts/access-profiles", () => {
  it("lets local admins list safe account access profiles", async () => {
    const res = response();

    await GET(
      request({
        actorId: "local_admin",
        managerProfile: {
          account_id: "local_admin",
          account_level: "admin",
          local_system_access: true,
          data_scopes: [],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      profiles: [
        {
          accountId: "member_001",
          accountLevel: "operator",
          localSystemAccess: true,
          dataScopes: ["role:djrole_image_qc"],
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("review:");
  });

  it("does not let marketplace reviewers list local account profiles", async () => {
    const res = response();

    await GET(
      request({
        actorId: "marketplace_owner",
        actorType: "marketplace_owner",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      ok: false,
      error: "当前账号没有读取本地账号权限列表的权限。",
    });
  });
});
