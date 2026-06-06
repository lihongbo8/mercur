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

function request(authContext: Record<string, unknown>, query: Record<string, unknown> = {}) {
  return {
    auth_context: authContext,
    query,
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return {
          listDijieDialogSessionsForAccount: async (input: { accountId?: string }) => {
            const sessions = [
              {
                id: "djdlg_1",
                account_id: "acct_user",
                account_type: "buyer",
                surface: "buyer_storefront",
                mode: "user",
                billing_account_id: "acct_user",
                subject: { roleListingId: "djrole_image_qc" },
                capability_policy: { meteringPolicy: { metered: true } },
                title: "有没有美工岗位",
                last_message_at: new Date("2026-06-05T01:00:00.000Z"),
              },
              {
                id: "djdlg_other",
                account_id: "acct_other",
                account_type: "buyer",
                surface: "buyer_storefront",
                mode: "user",
                billing_account_id: "acct_other",
                subject: { roleListingId: "djrole_other" },
                capability_policy: { meteringPolicy: { metered: true } },
                title: "别的岗位",
                last_message_at: new Date("2026-06-05T02:00:00.000Z"),
              },
            ];
            return input.accountId
              ? sessions.filter((session) => session.account_id === input.accountId)
              : sessions;
          },
        };
      },
    },
  };
}

describe("GET /dijie/dialog/sessions", () => {
  it("returns safe session summaries for the current account", async () => {
    const res = response();

    await GET(request({ actor_id: "acct_user" }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      sessions: [
        {
          id: "djdlg_1",
          accountId: "acct_user",
          surface: "buyer_storefront",
          title: "有没有美工岗位",
        },
      ],
    });
  });

  it("lets scoped local staff list only matching role sessions", async () => {
    const res = response();

    await GET(
      request({
        actor_id: "local_operator",
        actor_type: "member",
        metadata: {
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
      sessions: [
        {
          id: "djdlg_1",
          accountId: "acct_user",
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("djdlg_other");
  });

  it("requires an authenticated account", async () => {
    const res = response();

    await GET(request({}) as never, res as never);

    expect(res.statusCode).toBe(401);
  });
});
