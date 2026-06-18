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

function request(authContext: Record<string, unknown>) {
  return {
    auth_context: authContext,
    params: { sessionId: "djdlg_1" },
    scope: {
      resolve(name: string) {
        if (name !== DIJIE_AUDIT_MODULE) {
          throw new Error("unknown service");
        }
        return {
          retrieveDijieDialogSessionWithMessages: async (input: {
            sessionId: string;
            accountId?: string;
          }) => {
            if (input.accountId && input.accountId !== "acct_user") {
              return undefined;
            }
            return {
              session: {
                id: input.sessionId,
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
              messages: [
                {
                  id: "djmsg_1",
                  session_id: input.sessionId,
                  account_id: "acct_user",
                  message_role: "user",
                  content: "有没有美工岗位",
                  grounding: null,
                  model_called: false,
                  model_usage: null,
                  ledger_entry_id: null,
                  occurred_at: new Date("2026-06-05T01:00:00.000Z"),
                },
              ],
            };
          },
        };
      },
    },
  };
}

describe("GET /dijie/dialog/sessions/:sessionId", () => {
  it("returns safe session messages for the owning account", async () => {
    const res = response();

    await GET(request({ actor_id: "acct_user" }) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      session: {
        id: "djdlg_1",
        accountId: "acct_user",
      },
      messages: [
        {
          id: "djmsg_1",
          role: "user",
          content: "有没有美工岗位",
        },
      ],
    });
  });

  it("does not let ordinary accounts read another account session", async () => {
    const res = response();

    await GET(request({ actor_id: "acct_other" }) as never, res as never);

    expect(res.statusCode).toBe(404);
  });

  it("lets scoped local staff read matching role session messages", async () => {
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
      session: {
        id: "djdlg_1",
        accountId: "acct_user",
      },
      messages: [
        {
          id: "djmsg_1",
          content: "有没有美工岗位",
        },
      ],
    });
  });
});
