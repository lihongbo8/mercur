import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../lib/dijie/audit-store";
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
  authContext?: Record<string, unknown>;
  profile?: Record<string, unknown>;
}) {
  return {
    auth_context: input.authContext,
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return {
          async retrieveDijieAccountAccessProfile() {
            return input.profile;
          },
        };
      },
    },
  };
}

describe("GET /dijie/account/access", () => {
  it("returns the current account access profile", async () => {
    const res = response();

    await GET(
      request({
        authContext: {
          actor_id: "member_001",
          actor_type: "member",
          metadata: { billingAccountId: "company_owner_001" },
        },
        profile: {
          id: "djacct_001",
          account_id: "member_001",
          account_level: "operator",
          local_system_access: true,
          data_scopes: ["role:djrole_image_qc"],
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      access: {
        accountId: "member_001",
        billingAccountId: "company_owner_001",
        accountLevel: "operator",
        localSystemAccess: true,
        dataScopes: ["role:djrole_image_qc"],
        marketplaceOwnerAccess: false,
      },
    });
  });

  it("requires an authenticated account", async () => {
    const res = response();

    await GET(request({}) as never, res as never);

    expect(res.statusCode).toBe(401);
  });
});
